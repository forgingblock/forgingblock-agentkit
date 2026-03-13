import { AgentRequest, AgentResponse } from "@/app/types/api"
import { NextResponse } from "next/server"
import { createAgent } from "./create-agent"
import { Message, generateId, generateText } from "ai"
import { getSession, saveSession } from "@/app/lib/agent-session"

import {
  extractPaymentState,
  addPaymentState,
  removePaymentState
} from "@/app/lib/payment-state"

const CONFIRM_WORDS = [
  "confirm",
  "confirm payment",
  "yes",
  "pay now",
  "execute payment",
  "go ahead"
]

function isConfirmation(text: string) {
  const t = text.toLowerCase()
  return CONFIRM_WORDS.some(w => t.includes(w))
}

type ToolResult = {
  toolName: string
  result: string
}

export async function POST(
  req: Request & { json: () => Promise<AgentRequest> }
): Promise<NextResponse<AgentResponse>> {

  try {

    const body = await req.json()

    let { sessionId, userMessage } = body

    if (!userMessage) {
      throw new Error("userMessage required")
    }

    if (!sessionId) {
      sessionId = crypto.randomUUID()
    }

    const agent = await createAgent()

    const history = getSession(sessionId)

    const paymentState = extractPaymentState(history)

    // --------------------------------------------------
    // Confirmation shortcut
    // --------------------------------------------------

    if (paymentState && isConfirmation(userMessage)) {

      return NextResponse.json({
        sessionId,
        response: "Executing payment transaction..."
      })
    }

    // --------------------------------------------------
    // Normal agent flow
    // --------------------------------------------------

    const messages: Message[] = [
      ...history,
      {
        id: generateId(),
        role: "user",
        content: userMessage
      }
    ]

    console.log("----- SESSION -----", sessionId)

    console.log("----- MESSAGES -----")
    console.dir(messages, { depth: null })

    const result = await generateText({
      model: agent.model,
      system: agent.system,
      tools: agent.tools,
      messages,
      maxSteps: agent.maxSteps
    })

    const { text } = result

    const toolResults = result.toolResults as ToolResult[] | undefined

    console.log("----- TOOL RESULTS -----")
    console.dir(toolResults, { depth: null })

    console.log("----- FINAL TEXT -----")
    console.log(text)

    let updatedMessages: Message[] = [
      ...messages,
      {
        id: generateId(),
        role: "assistant",
        content: text
      }
    ]

    // --------------------------------------------------
    // Store payment state from create_payment
    // --------------------------------------------------

    if (toolResults) {

      for (const r of toolResults) {

        if (r.toolName === "create_payment") {

          try {

            const parsed = JSON.parse(r.result)

            if (parsed.recommendedTx && parsed.invoiceId) {

              updatedMessages = addPaymentState(updatedMessages, {
                invoiceId: parsed.invoiceId,
                recommendedTx: parsed.recommendedTx,
                verifyUrl: parsed.verifyUrl
              })

              console.log("Stored payment state", parsed.invoiceId)

            }

          } catch (err) {
            console.error("Failed parsing tool result", err)
          }
        }
      }
    }

    saveSession(sessionId, updatedMessages)

    return NextResponse.json({
      sessionId,
      response: text
    })

  } catch (error) {

    console.error("Agent error:", error)

    return NextResponse.json({
      error:
        error instanceof Error
          ? error.message
          : "Agent error"
    })
  }
}