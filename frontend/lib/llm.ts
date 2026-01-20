import { API_BASE } from "./api";

/**
 * Envoie un message au LLM backend (mode conversation global)
 */
export async function llmChat(messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const res = await fetch(`${API_BASE}/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context: "global" }),
  });
  if (!res.ok) {
    throw new Error("Erreur LLM");
  }
  const data = await res.json();
  return data.response as string;
}
