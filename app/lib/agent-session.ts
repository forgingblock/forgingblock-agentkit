import { Message } from "ai"

const sessions = new Map<string, Message[]>()

export function getSession(id: string): Message[] {
  return sessions.get(id) ?? []
}

export function saveSession(id: string, messages: Message[]) {
  sessions.set(id, messages)
}
