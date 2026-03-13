import { useState } from "react"
import { AgentRequest, AgentResponse } from "../types/api"

type ChatMessage = {
  text: string
  sender: "user" | "agent"
}

async function messageAgent(
  userMessage: string,
  sessionId?: string | null
): Promise<{ response: string; sessionId?: string }> {

  try {

    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage,
        sessionId
      } as AgentRequest)
    })

    const data = (await response.json()) as AgentResponse

    return {
      response: data.response ?? data.error ?? "Agent returned no response.",
      sessionId: data.sessionId
    }

  } catch (error) {

    console.error("Error communicating with agent:", error)

    return {
      response: "Error communicating with the agent."
    }
  }
}

export function useAgent() {

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const sendMessage = async (input: string) => {

    if (!input.trim()) return

    setMessages(prev => [
      ...prev,
      { text: input, sender: "user" }
    ])

    setIsThinking(true)

    const result = await messageAgent(input, sessionId)

    if (result.sessionId && !sessionId) {
      setSessionId(result.sessionId)
    }

    setMessages(prev => [
      ...prev,
      { text: result.response, sender: "agent" }
    ])

    setIsThinking(false)
  }

  return {
    messages,
    sendMessage,
    isThinking
  }
}