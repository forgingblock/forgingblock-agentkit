import { AgentRequest, AgentResponse } from "@/app/types/api"
import { NextResponse } from "next/server"
import { createAgent } from "./create-agent"
import { Message, generateId, generateText } from "ai"
import { getSession, saveSession } from "@/app/lib/agent-session"
import { isWoocommerceUrl } from "@/app/lib/url-woocommerce"
import { extractPaymentState, addPaymentState } from "@/app/lib/payment-state"

const STOP_WORDS = new Set([
  "find",
  "search",
  "browse",
  "list",
  "catalog",
  "on",
  "in",
  "for",
  "the",
  "a",
  "an",
  "me",
  "show",
  "give",
  "want",
  "to",
  "at"
])

function isConfirmation(text: string) {
  const t = text.trim().toLowerCase()
  return (
    t === "confirm" ||
    t === "yes" ||
    t === "pay" ||
    t === "pay now" ||
    t === "execute" ||
    t === "execute payment" ||
    t.includes("confirm")
  )
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

    if (!userMessage) throw new Error("userMessage required")
    if (!sessionId) sessionId = crypto.randomUUID()

    const agent = await createAgent()
    const history = getSession(sessionId)

    const paymentState = extractPaymentState(history)

    // confirm
    if (paymentState && isConfirmation(userMessage)) {

      const tx = await generateText({
        model: agent.model,
        system: agent.system,
        tools: agent.tools,
        messages: [
          {
            role: "user",
            content: `
Transfer ${paymentState.amount} ${paymentState.tokenSymbol}
to ${paymentState.destinationAddress}

Use ERC20 transfer with token address ${paymentState.tokenAddress}
`
          }
        ],
        toolChoice: {
          type: "tool",
          toolName: "ERC20ActionProvider_transfer"
        },
        maxSteps: 1
      })

      const txResult = (tx.toolResults as ToolResult[] | undefined)
        ?.find(r => r.toolName === "ERC20ActionProvider_transfer")

      saveSession(sessionId, [])

      if (txResult) {
        return NextResponse.json({
          sessionId,
          response: txResult.result
        })
      }

      return NextResponse.json({
        sessionId,
        response: "transaction failed"
      })
    }

    const messages: Message[] = [
      ...history,
      {
        id: generateId(),
        role: "user" as const,
        content: userMessage
      }
    ]
    let base: string | null = null
    const classification = isWoocommerceUrl(userMessage)

    if (classification && (classification.isWooCandidate || classification.isForgingBlockWoo)) {
      try {
        base = new URL(classification.url).origin
      } catch {
        base = null
      }
    }

    // woo
    const hasUrl = classification && (classification.isWooCandidate || classification.isForgingBlockWoo)
    const isBuyIntent = /buy|purchase|checkout|pay/i.test(userMessage)
    const isSearchIntent = /find|search|browse|list|catalog/i.test(userMessage)
    if (isSearchIntent && base) {

      const raw = userMessage
        .replace(/https?:\/\/\S+/g, "")
        .toLowerCase()

      const query = raw
        .split(/\s+/)
        .filter((w: string) => w && !STOP_WORDS.has(w))
        .map((w: string) => w.replace(/s$/, ""))
        .join(" ")
        .trim()

      const isAdvancedQuery = /cheaper|under|below|price|cheapest|less than/i.test(userMessage)

      if (!isAdvancedQuery) {
        const search = await generateText({
          model: agent.model,
          system: agent.system,
          tools: agent.tools,
          messages: [
            {
              role: "user",
              content: JSON.stringify({ base, query })
            }
          ],
          toolChoice: {
            type: "tool",
            toolName: "woo_search_products"
          },
          maxSteps: 1
        })

        const searchResult = (search.toolResults as ToolResult[] | undefined)
          ?.find(r => r.toolName === "woo_search_products")

        if (searchResult) {
          const data = JSON.parse(searchResult.result || "{}")

          return NextResponse.json({
            sessionId,
            response: JSON.stringify(data, null, 2)
          })
        }
      }

      const res = await fetch(
        `${base}/wp-json/forgingblock/v1/agent/products`
      )

      const data = await res.json()

      const filtered = data.items.filter((p: any) => {
        if (/cheaper|under|below|less than/i.test(userMessage)) {
          const match = userMessage.match(/(\d+(\.\d+)?)/)
          if (match) {
            const price = parseFloat(match[1])
            return p.price_float <= price
          }
        }
        return true
      })

      return NextResponse.json({
        sessionId,
        response: JSON.stringify(filtered, null, 2)
      })
    }
    if (hasUrl && isBuyIntent) {

      const url = classification.url

      const woo = await generateText({
        model: agent.model,
        system: agent.system,
        tools: agent.tools,
        messages: [
          { role: "user", content: `woo_prepare_checkout ${url}` }
        ],
        toolChoice: { type: "tool", toolName: "woo_prepare_checkout" },
        maxSteps: 1
      })

      const wooResult = (woo.toolResults as ToolResult[] | undefined)
        ?.find(r => r.toolName === "woo_prepare_checkout")

      if (!wooResult) throw new Error("woo failed")

      const wooData = JSON.parse(wooResult.result || "{}")

      if (wooData.error) {
        return NextResponse.json({
          sessionId,
          response: `checkout failed: ${wooData.error}`
        })
      }

      const payment = await generateText({
        model: agent.model,
        system: agent.system,
        tools: agent.tools,
        messages: [
          { role: "user", content: `create_payment ${wooData.invoice_url}` }
        ],
        toolChoice: { type: "tool", toolName: "create_payment" },
        maxSteps: 1
      })

      const paymentResult = (payment.toolResults as ToolResult[] | undefined)
        ?.find(r => r.toolName === "create_payment")

      if (!paymentResult) throw new Error("create_payment failed")

      const p = JSON.parse(paymentResult.result || "{}")

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant" as const,
        content: `
Invoice URL:
${p.invoiceUrl}

Network:
${p.network?.name}

Token:
${p.token.symbol}

Amount:
${p.amount.decimal} ${p.token.symbol}

Payment Address:
${p.paymentAddress}

Confirm to execute payment.
`
      }

      const updatedMessages = addPaymentState(
        [...messages, assistantMessage],
        {
          invoiceId: p.invoiceId,
          amount: p.amount.decimal,
          tokenSymbol: p.token.symbol,
          tokenAddress: p.token.address,
          destinationAddress: p.paymentAddress,
          verifyUrl: p.verifyUrl,
          network: p.network?.name
        }
      )

      saveSession(sessionId, updatedMessages)

      return NextResponse.json({
        sessionId,
        response: assistantMessage.content
      })
    }

    // normal + hybrid
    const result = await generateText({
      model: agent.model,
      system: agent.system,
      tools: agent.tools,
      messages,
      maxSteps: agent.maxSteps
    })

    const toolResults = result.toolResults as ToolResult[] | undefined

    let updatedMessages: Message[] = [
      ...messages,
      {
        id: generateId(),
        role: "assistant" as const,
        content: result.text
      }
    ]

    let paymentParsed: any = null

    // tool path
    if (toolResults) {
      for (const r of toolResults) {
        if (r.toolName === "create_payment") {
          try {
            const parsed = JSON.parse(r.result || "{}")
            if (parsed.invoiceId && parsed.token && parsed.amount) {
              paymentParsed = parsed
            }
          } catch { }
        }
      }
    }

    // fallback path
    if (!paymentParsed) {
      const match = result.text.match(
        /https:\/\/api\.forgingblock\.io\/api\/v1\/invoice\?id=[a-z0-9-]+/i
      )

      if (match) {
        const payment = await generateText({
          model: agent.model,
          system: agent.system,
          tools: agent.tools,
          messages: [
            { role: "user", content: `create_payment ${match[0]}` }
          ],
          toolChoice: { type: "tool", toolName: "create_payment" },
          maxSteps: 1
        })

        const fallbackResult = (payment.toolResults as ToolResult[] | undefined)
          ?.find(r => r.toolName === "create_payment")

        if (fallbackResult) {
          try {
            const parsed = JSON.parse(fallbackResult.result || "{}")
            if (parsed.invoiceId && parsed.token && parsed.amount) {
              paymentParsed = parsed
            }
          } catch { }
        }
      }
    }

    let responseText = result.text

    if (paymentParsed) {
      updatedMessages = addPaymentState(updatedMessages, {
        invoiceId: paymentParsed.invoiceId,
        amount: paymentParsed.amount.decimal,
        tokenSymbol: paymentParsed.token.symbol,
        tokenAddress: paymentParsed.token.address,
        destinationAddress: paymentParsed.paymentAddress,
        verifyUrl: paymentParsed.verifyUrl,
        network: paymentParsed.network?.name
      })

      responseText = `
Invoice URL:
${paymentParsed.invoiceUrl}

Network:
${paymentParsed.network?.name}

Token:
${paymentParsed.token.symbol}

Amount:
${paymentParsed.amount.decimal} ${paymentParsed.token.symbol}

Payment Address:
${paymentParsed.paymentAddress}

Confirm to execute payment.
`
    }

    saveSession(sessionId, updatedMessages)

    return NextResponse.json({
      sessionId,
      response: responseText
    })

  } catch (error) {
    console.error("agent error", error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : "agent error"
    })
  }
}