import { Message } from "ai"

const PREFIX = "PAYMENT_STATE:"

export function extractPaymentState(messages: Message[]) {
    for (const m of messages) {
        if (
            m.role === "system" &&
            typeof m.content === "string" &&
            m.content.startsWith(PREFIX)
        ) {
            try {
                return JSON.parse(m.content.replace(PREFIX, ""))
            } catch { }
        }
    }

    return null
}

export function addPaymentState(messages: Message[], state: any): Message[] {
    return [
        ...messages,
        {
            id: crypto.randomUUID(),
            role: "system",
            content: PREFIX + JSON.stringify(state)
        }
    ]
}

export function removePaymentState(messages: Message[]) {
    return messages.filter(
        m =>
            !(
                m.role === "system" &&
                typeof m.content === "string" &&
                m.content.startsWith(PREFIX)
            )
    )
}