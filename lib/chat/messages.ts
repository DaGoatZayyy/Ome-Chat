import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export type ChatMessage = {
  id: string; match_id: string; sender_id: string; body: string; created_at: string;
};

export async function loadMatchMessages(matchId: string, accessToken: string): Promise<ChatMessage[]> {
  const response = await fetch(`/api/chat/messages?matchId=${encodeURIComponent(matchId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to load messages.");
  return result.messages as ChatMessage[];
}

export async function sendMatchMessage(matchId: string, body: string, accessToken: string): Promise<ChatMessage> {
  const response = await fetch("/api/chat/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ matchId, body }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to send message.");
  return result.message as ChatMessage;
}

export async function subscribeToMatchMessages(options: {
  supabase: SupabaseClient; matchId: string; accessToken: string; onMessage: (message: ChatMessage) => void;
}) {
  await options.supabase.realtime.setAuth(options.accessToken);
  const channel: RealtimeChannel = options.supabase.channel(`match:${options.matchId}`, {
    config: { private: true, broadcast: { self: false } },
  });
  channel.on("broadcast", { event: "message" }, ({ payload }) => {
    if (!payload || typeof payload !== "object") return;
    const message = payload as ChatMessage;
    if (message.match_id === options.matchId && typeof message.body === "string") options.onMessage(message);
  });
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(error ?? new Error("Realtime subscription failed."));
    });
  });
  return () => { void options.supabase.removeChannel(channel); };
}
