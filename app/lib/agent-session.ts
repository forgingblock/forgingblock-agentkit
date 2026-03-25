import { Message } from "ai"

function getStore(): Map<string, Message[]> {
  const g = globalThis as any

  if (!g.__SESSION_STORE__) {
    g.__SESSION_STORE__ = new Map<string, Message[]>()
  }

  return g.__SESSION_STORE__
}

export function getSession(id: string): Message[] {
  const store = getStore()
  const session = store.get(id) ?? []

  console.log("GET SESSION:", id, session.length)

  return session
}

export function saveSession(id: string, messages: Message[]) {
  const store = getStore()

  console.log("SAVE SESSION:", id, messages.length)

  store.set(id, messages)
}