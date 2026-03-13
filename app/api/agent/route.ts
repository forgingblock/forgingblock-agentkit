import { AgentRequest, AgentResponse } from "@/app/types/api"
import { NextResponse } from "next/server"
import { createAgent } from "./create-agent"
import { Message, generateId, generateText } from "ai"
import { getSession, saveSession } from "@/app/lib/agent-session"

export async function POST(
  req: Request & { json: () => Promise<AgentRequest> }
): Promise<NextResponse<AgentResponse>> {

  try {

    const body = await req.json()

    let { sessionId, userMessage } = body

    if (!userMessage) {
      throw new Error("userMessage required")
    }

    // auto-create session if not provided
    if (!sessionId) {
      sessionId = crypto.randomUUID()
    }

    const agent = await createAgent()

    const history = getSession(sessionId)

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

    const { text, toolCalls, toolResults, finishReason } = result

    console.log("----- TOOL CALLS -----")
    console.dir(toolCalls, { depth: null })

    console.log("----- TOOL RESULTS -----")
    console.dir(toolResults, { depth: null })

    console.log("----- FINISH REASON -----")
    console.log(finishReason)

    console.log("----- FINAL TEXT -----")
    console.log(text)

    const updatedMessages: Message[] = [
      ...messages,
      {
        id: generateId(),
        role: "assistant",
        content: text
      }
    ]

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