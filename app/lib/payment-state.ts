import { Message } from "ai"

const PREFIX = "PAYMENT_STATE:"

export function extractPaymentState(messages: Message[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]

    if (
      m.role === "system" &&
      typeof m.content === "string" &&
      m.content.startsWith(PREFIX)
    ) {
      try {
        const parsed = JSON.parse(m.content.slice(PREFIX.length))
        return parsed
      } catch (e) {
        console.error("Failed to parse PAYMENT_STATE:", e)
      }
    }
  }

  return null
}

export function addPaymentState(
  messages: Message[],
  state: any
): Message[] {

  const cleaned = removePaymentState(messages)

  const stateMessage: Message = {
    id: crypto.randomUUID(),
    role: "system" as const, // 🔥 CRITICAL FIX
    content: PREFIX + JSON.stringify(state)
  }

  return [...cleaned, stateMessage]
}

export function removePaymentState(messages: Message[]) {
  return messages.filter(m => {
    return !(
      m.role === "system" &&
      typeof m.content === "string" &&
      m.content.startsWith(PREFIX)
    )
  })
}