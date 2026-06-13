export const OVERVIEW_MARKER = "__CS_OVERVIEW__";

export type Conversation = { id: number; title: string; created_at: string };

export type ChatMsg = {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
