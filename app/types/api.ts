export type AgentRequest = {
  userMessage: string
  sessionId?: string
}

export type AgentResponse = {
  response?: string
  error?: string
  sessionId?: string
}