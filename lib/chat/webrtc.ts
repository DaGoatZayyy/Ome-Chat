import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export type SignalPayload =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit }
  | { type: "hangup" };

export type WebRtcCallbacks = {
  onState?: (state: RTCPeerConnectionState) => void;
  onError?: (message: string) => void;
};

/**
 * WebRTC peer helper. Caller must first obtain an authenticated session and
 * a server-authorized matchId. The private Realtime topic is scoped to that match.
 * Authorization policies must verify that auth.uid() is one of its participants.
 */
export async function createMatchPeer(options: {
  supabase: SupabaseClient;
  matchId: string;
  accessToken: string;
  localStream: MediaStream;
  iceServers: RTCIceServer[];
  initiator: boolean;
  remoteVideo: HTMLVideoElement;
  callbacks?: WebRtcCallbacks;
}) {
  const { supabase, matchId, accessToken, localStream, iceServers, initiator, remoteVideo, callbacks } = options;
  await supabase.realtime.setAuth(accessToken);

  const peer = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 });
  let closed = false;
  let makingOffer = false;
  const pendingCandidates: RTCIceCandidateInit[] = [];

  peer.ontrack = (event) => {
    if (event.streams[0]) remoteVideo.srcObject = event.streams[0];
  };
  peer.onconnectionstatechange = () => {
    callbacks?.onState?.(peer.connectionState);
    if (peer.connectionState === "failed") callbacks?.onError?.("Video connection failed. Check TURN configuration or try again.");
  };
  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

  const channel: RealtimeChannel = supabase.channel(`match:${matchId}`, {
    config: { private: true, broadcast: { self: false, ack: true } },
  });

  const sendSignal = async (payload: SignalPayload) => {
    if (closed) return;
    const result = await channel.send({ type: "broadcast", event: "signal", payload });
    if (result !== "ok") callbacks?.onError?.("Could not send WebRTC signaling data.");
  };

  channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
    if (closed || !payload || typeof payload !== "object") return;
    try {
      const signal = payload as SignalPayload;
      if (signal.type === "offer" && !initiator) {
        await peer.setRemoteDescription(signal.sdp);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await sendSignal({ type: "answer", sdp: answer });
        while (pendingCandidates.length) await peer.addIceCandidate(pendingCandidates.shift()!);
      } else if (signal.type === "answer" && initiator) {
        await peer.setRemoteDescription(signal.sdp);
        while (pendingCandidates.length) await peer.addIceCandidate(pendingCandidates.shift()!);
      } else if (signal.type === "ice") {
        if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
        else pendingCandidates.push(signal.candidate);
      } else if (signal.type === "hangup") {
        await close();
      }
    } catch {
      callbacks?.onError?.("WebRTC signaling failed. Please end the chat and reconnect.");
    }
  });

  const subscribed = new Promise<void>((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(error ?? new Error("Realtime subscription failed."));
    });
  });
  await subscribed;

  peer.onicecandidate = (event) => {
    if (event.candidate) void sendSignal({ type: "ice", candidate: event.candidate.toJSON() });
  };

  async function close() {
    if (closed) return;
    closed = true;
    try { await channel.send({ type: "broadcast", event: "signal", payload: { type: "hangup" } }); } catch {}
    peer.ontrack = null;
    peer.onicecandidate = null;
    peer.close();
    remoteVideo.srcObject = null;
    await supabase.removeChannel(channel);
  }

  if (initiator) {
    makingOffer = true;
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal({ type: "offer", sdp: offer });
    } finally {
      makingOffer = false;
    }
  }
  void makingOffer;
  return { peer, channel, close };
}
