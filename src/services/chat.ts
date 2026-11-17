import axios from "axios";
import { CHAT_BASE_URL } from "@/ENV";
import { getAccountId } from "@/lib/auth";
import type { ChatSessionResponse } from "@/types/chat";

/**
 * Chatoctopus is on a separate host from the MaxDiff API, so chat traffic gets
 * its own axios instance rather than borrowing the dashboard client's baseURL
 * and 401 interceptor — a chat hiccup should never sign the user out of the
 * dashboard. Mirrors coke_stills' services/chat.ts.
 */
const chatApi = axios.create({
  baseURL: CHAT_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

chatApi.interceptors.request.use((config) => {
  const accountId = getAccountId();
  if (accountId) {
    config.headers["account-id"] = accountId;
  }
  return config;
});

export async function fetchChatSession(chatId: string): Promise<ChatSessionResponse> {
  const { data } = await chatApi.get(`/${chatId}/?source=BOT`);
  return data;
}

/**
 * Enqueue a turn. Chatoctopus stores the USER message, invokes the bot webhook
 * (which is coke_eu's /result-chat), and appends the reply to the session — so
 * this resolves once the answer is stored, and the caller re-reads the session.
 */
export async function postChatMessage(
  chatId: string,
  userMessage: string
): Promise<void> {
  await chatApi.put(`/${chatId}/`, { user_message: userMessage });
}
