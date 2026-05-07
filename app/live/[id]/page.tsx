"use client";

import { useEffect, useRef, useState, useCallback, useContext } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  Mic, MicOff, Video, VideoOff, Square, Send, Gift,
  Users, Radio, Clock, PhoneOff, Link, Link2Off,
} from "lucide-react";
import "./live.css";

import { AuthContext } from "../../context/AuthContext";
import { BgPicker } from "../../ver/[id]/BgPicker";
import { useAuth } from "../hooks/useAuth";

import {
  ChatMessages,
  GiftPicker,
  GiftShopModal,
  StagePanel,
  StageSelfControls,
  GIFT_EMOJIS,
  GIFT_LABELS,
  type ChatMsg,
  type GiftMsg,
  type Balance,
  type ViewerInfo,
  type StageParticipant,
} from "./LiveHelpers";

// ── StageLayout (nuevo componente integrado) ──────────────────────────────────
import { StageLayout, type StageTileStream } from "./StageLayout";

const BACKEND = "https://stream-72mw.onrender.com";

type LiveStatus = "waiting" | "live" | "ended";
type LiveData = {
  _id: string; title: string; description?: string; category?: string;
  status: LiveStatus; hlsUrl?: string; vodUrl?: string; thumbnail?: string;
  streamKey?: string;
  user?: { _id: string; name: string; avatar?: string } | string;
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80",  username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  ],
};

function getStoredUser(): { id: string; name: string } {
  try {
    const token = localStorage.getItem("token");
    if (!token) return { id: "", name: "" };
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id:   String(payload?.id   ?? payload?._id      ?? ""),
      name: String(payload?.name ?? payload?.username ?? ""),
    };
  } catch {
    return { id: "", name: "" };
  }
}

export default function LivePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const authCtx    = useContext(AuthContext);
 const myUsername =
  authCtx?.user?.name?.trim() ||
  authCtx?.user?.username?.trim() ||
  getStoredUser().name ||
  "";

  // ── Refs ──────────────────────────────────────────────────────────────────
  const localVideoRef    = useRef<HTMLVideoElement>(null);
  const remoteVideoRef   = useRef<HTMLVideoElement>(null);
  const socketRef        = useRef<Socket | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const stageStreamRef   = useRef<MediaStream | null>(null);
  const peerConnsRef     = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerConnRef      = useRef<RTCPeerConnection | null>(null);
  const stagePCsRef      = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamReadyRef   = useRef(false);
  const socketReadyRef   = useRef(false);
  const autoPlayRetryRef = useRef<(() => void) | null>(null);
  const mySocketIdRef    = useRef<string>("");

  // ── Estado base ───────────────────────────────────────────────────────────
  const [live,      setLive]      = useState<LiveData | null>(null);
  const [isOwner,   setIsOwner]   = useState<boolean | null>(null);
  const [chat,      setChat]      = useState<ChatMsg[]>([]);
  const [msg,       setMsg]       = useState("");
  const [viewers,   setViewers]   = useState(0);
  const [giftAnim,  setGiftAnim]  = useState<GiftMsg | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [micOn,     setMicOn]     = useState(true);
  const [camOn,     setCamOn]     = useState(true);
  const [connected, setConnected] = useState(false);
  const [giftOpen,  setGiftOpen]  = useState(false);
  const [ending,    setEnding]    = useState(false);
  const [needsTap,  setNeedsTap]  = useState(false);

  // ── Viewers / compartir ───────────────────────────────────────────────────
  const [viewerList,   setViewerList]   = useState<ViewerInfo[]>([]);
  const [shareEnabled, setShareEnabled] = useState(true);
  const [copied,       setCopied]       = useState(false);
  const [showViewers,  setShowViewers]  = useState(false);

  // ── Fondo personalizable ──────────────────────────────────────────────────
  const [bgColor, setBgColor] = useState("#000000");

  // ── Gifts ─────────────────────────────────────────────────────────────────
  const [balance,     setBalance]     = useState<Balance>({
    corazon: 0, estrella: 0, fuego: 0, diamante: 0, corona: 0, cohete: 0,
  });
  const [buyOpen,     setBuyOpen]     = useState(false);
  const [buying,      setBuying]      = useState<string | null>(null);
  const [sendingGift, setSendingGift] = useState<string | null>(null);

  // ── Escenario ─────────────────────────────────────────────────────────────
  const [stageParticipants, setStageParticipants] = useState<StageParticipant[]>([]);
  const [stageTiles,        setStageTiles]        = useState<StageTileStream[]>([]);
  const [isOnStage,         setIsOnStage]         = useState(false);
  const [stageMicOn,        setStageMicOn]        = useState(true);
  const [stageCamOn,        setStageCamOn]        = useState(true);
  const [stageMicLocked,    setStageMicLocked]    = useState(false);
  const [stageCamLocked,    setStageCamLocked]    = useState(false);

  // ── Spotlight (nuevo) ─────────────────────────────────────────────────────
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  // ── Admin ─────────────────────────────────────────────────────────────────
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [adminList, setAdminList] = useState<string[]>([]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/live/${id}`
    : "";

  const streamerName =
    typeof live?.user === "object" ? live.user?.name ?? "Streamer" : "Streamer";

  // ── Limpieza ──────────────────────────────────────────────────────────────
  const fullCleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    stageStreamRef.current?.getTracks().forEach((t) => t.stop());
    stageStreamRef.current = null;
    streamReadyRef.current = false;
    socketReadyRef.current = false;
    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    peerConnsRef.current.forEach((pc) => pc.close());
    peerConnsRef.current.clear();
    peerConnRef.current?.close();
    peerConnRef.current = null;
    stagePCsRef.current.forEach((pc) => pc.close());
    stagePCsRef.current.clear();
    autoPlayRetryRef.current = null;
    setIsOnStage(false);
    setStageMicLocked(false);
    setStageCamLocked(false);
    setSpotlightId(null);
  }, []);

  const tryPlayRemote = useCallback((videoEl: HTMLVideoElement) => {
    videoEl.play()
      .then(() => { setNeedsTap(false); autoPlayRetryRef.current = null; })
      .catch((err) => {
        if (err.name === "NotAllowedError" || err.name === "AbortError") {
          setNeedsTap(true);
          autoPlayRetryRef.current = () => {
            videoEl.muted = false;
            videoEl.play().then(() => setNeedsTap(false)).catch(() => {});
          };
        }
      });
  }, []);

  const tryRegisterStreamer = useCallback(() => {
    if (!socketReadyRef.current || !streamReadyRef.current) return;
    if (!socketRef.current?.connected) return;
    const { name } = getStoredUser();
    socketRef.current.emit("live:registerStreamer", { liveId: id, username: name });
  }, [id]);

  // ── Fetch live ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("token");
    const { id: myId } = getStoredUser();
    fetch(`${BACKEND}/api/live/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        const liveData: LiveData = data.live ?? data;
        if (!liveData?._id) { setError("Live no encontrado"); return; }
        setLive(liveData);
        const ownerId =
          typeof liveData.user === "object"
            ? String(liveData.user?._id ?? "")
            : String(liveData.user ?? "");
        setIsOwner(!!myId && !!ownerId && myId === ownerId);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Balance gifts ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOwner === null || isOwner === true) return;
    const token = localStorage.getItem("token");
    fetch(`${BACKEND}/api/live/gifts/balance`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.balance) setBalance(data.balance); })
      .catch(() => {});
  }, [isOwner]);

  // ── createStreamerPC ──────────────────────────────────────────────────────
  const createStreamerPC = useCallback(
    (viewerSocketId: string, stream: MediaStream): RTCPeerConnection => {
      peerConnsRef.current.get(viewerSocketId)?.close();
      const pc = new RTCPeerConnection(RTC_CONFIG);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = ({ candidate }) => {
        if (candidate)
          socketRef.current?.emit("webrtc:ice", { targetSocketId: viewerSocketId, candidate });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed")
          peerConnsRef.current.delete(viewerSocketId);
      };
      peerConnsRef.current.set(viewerSocketId, pc);
      return pc;
    }, []
  );

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || isOwner === null) return;
    const token = localStorage.getItem("token");
    const s = io(BACKEND, { auth: { token }, reconnectionDelay: 1000, reconnectionAttempts: 5 });
    socketRef.current = s;

  s.on("connect", () => {
  socketReadyRef.current = true;
  mySocketIdRef.current  = s.id ?? "";
  const name =
    authCtx?.user?.name?.trim() ||
    authCtx?.user?.username?.trim() ||
    getStoredUser().name;
  s.emit("live:join", { liveId: id, username: name }); // ← agregá username
  if (isOwner) {
    tryRegisterStreamer();
  } else {
    s.emit("webrtc:viewerReady", { liveId: id });
  }
});
    s.on("disconnect", () => { socketReadyRef.current = false; });

    // ── Eventos generales ─────────────────────────────────────────────────
    s.on("live:chat",        (m: ChatMsg) => setChat((p) => [...p.slice(-199), m]));
    s.on("live:viewerCount", ({ count }: { count: number }) => setViewers(count));
    s.on("live:viewerList",  ({ viewers: vl }: { viewers: ViewerInfo[] }) => setViewerList(vl));
    s.on("live:shareState",  ({ enabled }: { enabled: boolean }) => setShareEnabled(enabled));
    s.on("live:camState",    ({ on }: { on: boolean }) => { if (!isOwner) setCamOn(on); });

    s.on("live:gift", (g: GiftMsg) => {
      setGiftAnim(g);
      setTimeout(() => setGiftAnim(null), 3500);
    });

    s.on("live:ended", () => {
      fullCleanup();
      setLive((p) => (p ? { ...p, status: "ended" } : p));
    });

    s.on("live:adminList",    ({ admins }: { admins: string[] }) => setAdminList(admins));
    s.on("live:youAreAdmin",  () => setIsAdmin(true));
    s.on("live:adminRevoked", () => setIsAdmin(false));

    // ── stageUpdate ───────────────────────────────────────────────────────
    s.on("live:stageUpdate", ({ participants }: { participants: StageParticipant[] }) => {
      setStageParticipants(participants);
      setStageTiles((prev) => {
        const ids = new Set(participants.map((p) => p.socketId));
        return prev
          .filter((t) => ids.has(t.socketId))
          .map((t) => {
            const p = participants.find((x) => x.socketId === t.socketId);
            return p ? { ...t, micMuted: p.micMuted, camOff: p.camOff, micLocked: p.micLocked, camLocked: p.camLocked } : t;
          });
      });
    });

    // ── Spotlight (nuevo) ─────────────────────────────────────────────────
    // El servidor puede emitir "stage:spotlight" para sincronizar el estado
    // entre todos los viewers cuando el owner cambia el destacado.
    s.on("stage:spotlight", ({ socketId }: { socketId: string | null }) => {
      setSpotlightId(socketId);
    });

    // ── Owner silencia mic del invitado ───────────────────────────────────
    s.on("stage:adminMuteMic", ({ mute, lock }: { mute: boolean; lock: boolean }) => {
      const stream = stageStreamRef.current;
      if (stream) stream.getAudioTracks().forEach((t) => { t.enabled = !mute; });
      setStageMicOn(!mute);
      setStageMicLocked(lock);
      s.emit("stage:selfState", { liveId: id, micOn: !mute, camOn: stageCamOn });
    });

    s.on("stage:adminMuteCam", ({ off, lock }: { off: boolean; lock: boolean }) => {
      const stream = stageStreamRef.current;
      if (stream) stream.getVideoTracks().forEach((t) => { t.enabled = !off; });
      setStageCamOn(!off);
      setStageCamLocked(lock);
      s.emit("stage:selfState", { liveId: id, micOn: stageMicOn, camOn: !off });
    });

    // ── WebRTC principal ──────────────────────────────────────────────────
    s.on("webrtc:newViewer", async ({ viewerSocketId }: { viewerSocketId: string }) => {
      if (!isOwner || !localStreamRef.current) return;
      const pc    = createStreamerPC(viewerSocketId, localStreamRef.current);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      s.emit("webrtc:offer", { targetSocketId: viewerSocketId, sdp: offer });
    });

    s.on("webrtc:offer", async ({
      streamerSocketId, sdp,
    }: { streamerSocketId: string; sdp: RTCSessionDescriptionInit }) => {
      if (isOwner) return;
      peerConnRef.current?.close();
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnRef.current = pc;

      pc.ontrack = (e) => {
        const stream  = e.streams[0];
        const videoEl = remoteVideoRef.current;
        if (!stream || !videoEl) return;
        videoEl.srcObject = stream;
        videoEl.muted     = true;
        videoEl.play()
          .then(() => { videoEl.muted = false; setConnected(true); setNeedsTap(false); })
          .catch((err) => {
            if (err.name === "AbortError") { setTimeout(() => tryPlayRemote(videoEl), 300); return; }
            setConnected(true); setNeedsTap(true);
            autoPlayRetryRef.current = () => {
              videoEl.muted = false;
              videoEl.play().then(() => setNeedsTap(false)).catch(() => {});
            };
          });
      };
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) s.emit("webrtc:ice", { targetSocketId: streamerSocketId, candidate });
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") setConnected(true);
        if (state === "failed" || state === "disconnected") { setConnected(false); setNeedsTap(false); }
      };
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit("webrtc:answer", { targetSocketId: streamerSocketId, sdp: answer });
    });

    s.on("webrtc:answer", async ({
      viewerSocketId, sdp,
    }: { viewerSocketId: string; sdp: RTCSessionDescriptionInit }) => {
      if (!isOwner) return;
      const pc = peerConnsRef.current.get(viewerSocketId);
      if (!pc || pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    s.on("webrtc:ice", async ({
      fromSocketId, candidate,
    }: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
      try {
        if (isOwner) {
          const pc = peerConnsRef.current.get(fromSocketId);
          if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          if (peerConnRef.current?.remoteDescription)
            await peerConnRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) { console.warn("webrtc:ice error:", e); }
    });

    // ── WebRTC escenario ──────────────────────────────────────────────────

    s.on("stage:invited", async ({ ownerSocketId }: { ownerSocketId: string }) => {
      if (isOwner) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stageStreamRef.current = stream;

        setStageMicOn(true);
        setStageCamOn(true);
        setStageMicLocked(false);
        setStageCamLocked(false);
        setIsOnStage(true);

        stagePCsRef.current.get("owner")?.close();
        const pc = new RTCPeerConnection(RTC_CONFIG);
        stagePCsRef.current.set("owner", pc);

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.onicecandidate = ({ candidate }) => {
          if (candidate) s.emit("stage:ice", { targetSocketId: ownerSocketId, candidate });
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "closed") {
            stagePCsRef.current.delete("owner");
            setIsOnStage(false);
            setStageMicLocked(false);
            setStageCamLocked(false);
            stageStreamRef.current?.getTracks().forEach((t) => t.stop());
            stageStreamRef.current = null;
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit("stage:offer", {
          targetSocketId: ownerSocketId,
          fromName:       myUsername,
          sdp:            offer,
        });
      } catch (err) {
        console.warn("stage:invited — no se pudo acceder a la cámara:", err);
      }
    });

    s.on("stage:offer", async ({
      fromSocketId, fromName, sdp,
    }: { fromSocketId: string; fromName: string; sdp: RTCSessionDescriptionInit }) => {
      if (!isOwner && !isAdmin) return;
      stagePCsRef.current.get(fromSocketId)?.close();
      const pc = new RTCPeerConnection(RTC_CONFIG);
      stagePCsRef.current.set(fromSocketId, pc);

      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (!stream) return;
        setStageTiles((prev) => {
          const exists = prev.find((t) => t.socketId === fromSocketId);
          if (exists) return prev.map((t) => t.socketId === fromSocketId ? { ...t, stream } : t);
          return [...prev, { socketId: fromSocketId, name: fromName, stream }];
        });
      };
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) s.emit("stage:ice", { targetSocketId: fromSocketId, candidate });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          stagePCsRef.current.delete(fromSocketId);
          setStageTiles((prev) => prev.filter((t) => t.socketId !== fromSocketId));
          // Limpiar spotlight si el tile desconectado era el destacado
          setSpotlightId((prev) => (prev === fromSocketId ? null : prev));
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit("stage:answer", { targetSocketId: fromSocketId, sdp: answer });
    });

    s.on("stage:answer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      if (isOwner) return;
      const pc = stagePCsRef.current.get("owner");
      if (!pc || pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    s.on("stage:ice", async ({
      fromSocketId, candidate,
    }: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
      try {
        if (isOwner || isAdmin) {
          const pc = stagePCsRef.current.get(fromSocketId);
          if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          const pc = stagePCsRef.current.get("owner");
          if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) { console.warn("stage:ice error:", e); }
    });

    s.on("stage:removed", () => {
      stagePCsRef.current.get("owner")?.close();
      stagePCsRef.current.delete("owner");
      stageStreamRef.current?.getTracks().forEach((t) => t.stop());
      stageStreamRef.current = null;
      setIsOnStage(false);
      setStageMicLocked(false);
      setStageCamLocked(false);
    });

    return () => {
      s.emit("live:leave", { liveId: id });
      s.disconnect();
      socketRef.current      = null;
      socketReadyRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isOwner, createStreamerPC, fullCleanup, tryRegisterStreamer, tryPlayRemote, myUsername]);

  // ── Cámara del streamer (owner) ───────────────────────────────────────────
  useEffect(() => {
    if (!isOwner || !id) return;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        streamReadyRef.current = true;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        tryRegisterStreamer();
      })
      .catch((err) => {
        setError(
          err.name === "NotAllowedError"
            ? "Permiso de cámara/micrófono denegado"
            : "No se pudo acceder a la cámara/micrófono"
        );
      });
    return () => fullCleanup();
  }, [isOwner, id, fullCleanup, tryRegisterStreamer]);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const sendChat = () => {
    if (!msg.trim() || !id) return;
    socketRef.current?.emit("live:chat", { liveId: id, message: msg, username: myUsername });
    setMsg("");
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); }
    catch {
      const el = document.createElement("input");
      el.value = shareUrl;
      document.body.appendChild(el); el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const toggleShare = () => {
    const next = !shareEnabled;
    setShareEnabled(next);
    socketRef.current?.emit("live:setShare", { liveId: id, enabled: next });
  };

  const sendGift = async (type: string) => {
    if (!id || sendingGift) return;
    if ((balance[type] ?? 0) < 1) { setBuyOpen(true); return; }
    setSendingGift(type);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND}/api/live/${id}/gift`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: 1 }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Error al enviar el regalo"); return; }
      setBalance((prev) => ({ ...prev, [type]: data.newBalance }));
      setGiftOpen(false);
    } catch { alert("Error de conexión al enviar el regalo"); }
    finally   { setSendingGift(null); }
  };

  const buyGift = async (type: string) => {
    if (buying) return;
    setBuying(type);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND}/api/live/gifts/buy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type, quantity: 10 }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Error al comprar"); return; }
      if (data.balance) setBalance(data.balance);
    } catch { alert("Error de conexión"); }
    finally   { setBuying(null); }
  };

  const toggleMic = () => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMicOn(t.enabled);
  };

  const toggleCam = () => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setCamOn(t.enabled);
    socketRef.current?.emit("live:camState", { liveId: id, on: t.enabled });
  };

  const endLive = async () => {
    if (!id || ending) return;
    if (!window.confirm("¿Querés finalizar el live? Esta acción no se puede deshacer.")) return;
    setEnding(true);
    try {
      fullCleanup();
      const token = localStorage.getItem("token");
      await fetch(`${BACKEND}/api/live/${id}/end`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      socketRef.current?.emit("live:ownerEnd", { liveId: id });
      socketRef.current?.emit("live:leave",    { liveId: id });
      socketRef.current?.disconnect();
      socketRef.current = null;
      setLive((p) => (p ? { ...p, status: "ended" } : p));
      setTimeout(() => router.push("/"), 1500);
    } catch { setEnding(false); }
  };

  // ── Escenario acciones ────────────────────────────────────────────────────
  const inviteToStage = (viewer: ViewerInfo) => {
    if (!viewer.socketId) return;
    socketRef.current?.emit("stage:invite", { liveId: id, targetSocketId: viewer.socketId });
  };

  const removeFromStage = (socketId: string) => {
    stagePCsRef.current.get(socketId)?.close();
    stagePCsRef.current.delete(socketId);
    setStageTiles((prev) => prev.filter((t) => t.socketId !== socketId));
    // Limpiar spotlight si se quita al destacado
    setSpotlightId((prev) => (prev === socketId ? null : prev));
    socketRef.current?.emit("stage:remove", { liveId: id, targetSocketId: socketId });
  };

  const adminMuteMic = (socketId: string, mute: boolean, lock: boolean) => {
    setStageParticipants((prev) =>
      prev.map((p) => p.socketId === socketId ? { ...p, micMuted: mute, micLocked: lock } : p)
    );
    setStageTiles((prev) =>
      prev.map((t) => t.socketId === socketId ? { ...t, micMuted: mute, micLocked: lock } : t)
    );
    socketRef.current?.emit("stage:adminMuteMic", { liveId: id, targetSocketId: socketId, mute, lock });
  };

  const adminMuteCam = (socketId: string, off: boolean, lock: boolean) => {
    setStageParticipants((prev) =>
      prev.map((p) => p.socketId === socketId ? { ...p, camOff: off, camLocked: lock } : p)
    );
    setStageTiles((prev) =>
      prev.map((t) => t.socketId === socketId ? { ...t, camOff: off, camLocked: lock } : t)
    );
    socketRef.current?.emit("stage:adminMuteCam", { liveId: id, targetSocketId: socketId, off, lock });
  };

  // El viewer alterna su propio mic (solo si no está bloqueado)
  const toggleStageMic = () => {
    if (stageMicLocked) return;
    const stream = stageStreamRef.current;
    if (!stream) return;
    const next = !stageMicOn;
    stream.getAudioTracks().forEach((t) => { t.enabled = next; });
    setStageMicOn(next);
    socketRef.current?.emit("stage:selfState", { liveId: id, micOn: next, camOn: stageCamOn });
  };

  const toggleStageCam = () => {
    if (stageCamLocked) return;
    const stream = stageStreamRef.current;
    if (!stream) return;
    const next = !stageCamOn;
    stream.getVideoTracks().forEach((t) => { t.enabled = next; });
    setStageCamOn(next);
    socketRef.current?.emit("stage:selfState", { liveId: id, micOn: stageMicOn, camOn: next });
  };

  const setAdminForViewer = (targetSocketId: string, isAdminFlag: boolean) => {
    socketRef.current?.emit("live:setAdmin", { liveId: id, targetSocketId, isAdmin: isAdminFlag });
    setAdminList((prev) =>
      isAdminFlag ? [...prev, targetSocketId] : prev.filter((s) => s !== targetSocketId)
    );
  };

  // ── Spotlight: solo el owner puede cambiarlo ──────────────────────────────
  // Si el servidor no soporta "stage:spotlight" todavía, el cambio es
  // solo local (el owner lo ve) y puede ignorarse del lado server.
  const handleSpotlight = (socketId: string | null) => {
    setSpotlightId(socketId);
    // Emitir al servidor para sincronizar con los demás viewers
    socketRef.current?.emit("stage:spotlight", { liveId: id, socketId });
  };

  // ── Renders condicionales ─────────────────────────────────────────────────
  if (loading)
    return (
      <div className="live-center">
        <Radio size={36} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.3)" }} />
        <p>Cargando live…</p>
      </div>
    );

  if (error || !live)
    return (
      <div className="live-center">
        <VideoOff size={36} strokeWidth={1.5} style={{ color: "#f87171" }} />
        <p style={{ color: "#f87171" }}>{error ?? "Live no encontrado"}</p>
      </div>
    );

  if (live.status === "ended")
    return (
      <div className="live-ended">
        <Square size={40} strokeWidth={1} style={{ color: "rgba(255,255,255,0.2)" }} />
        <h2>Live finalizado</h2>
        <p>Este stream ya terminó.</p>
        {live.vodUrl && <video src={live.vodUrl} controls className="live-vod" />}
        <button className="live-back-btn" onClick={() => router.back()}>Volver</button>
      </div>
    );

  const status = live.status;

  // ── Vista principal ───────────────────────────────────────────────────────
  return (
    <div className="live-root">

      {/* ══ Área de video ═══════════════════════════════════════════════════ */}
      <div className="live-video-area" style={{ background: bgColor }}>

        {/* Video local del streamer (owner) */}
        {isOwner && (
          <video
            ref={localVideoRef}
            autoPlay muted playsInline
            className="live-video-el"
            style={{ display: camOn ? "block" : "none", transform: "scaleX(-1)" }}
          />
        )}

        {/* Video remoto (viewer normal) */}
        {!isOwner && (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay playsInline muted
              className="live-video-el"
              style={{ display: (connected && camOn) ? "block" : "none" }}
            />
            {connected && camOn && needsTap && (
              <button className="live-tap-btn" onClick={() => autoPlayRetryRef.current?.()}>
                <div className="live-tap-icon">▶</div>
                <span className="live-tap-label">Tocá para ver el stream</span>
              </button>
            )}
            {connected && !camOn && (
              <div className="live-video-placeholder">
                <VideoOff size={40} strokeWidth={1} />
                <span>Cámara apagada</span>
              </div>
            )}
            {!connected && (
              <div className="live-video-placeholder">
                <Radio size={40} strokeWidth={1} />
                <span>{status === "live" ? "Conectando al stream…" : "Esperando que inicie…"}</span>
              </div>
            )}
          </>
        )}

        {/* Owner: placeholder cam off */}
        {isOwner && !camOn && (
          <div className="live-video-placeholder">
            <VideoOff size={40} strokeWidth={1} />
            <span>Cámara apagada</span>
          </div>
        )}

        {/*
          ══ Tiles del escenario — StageLayout reemplaza StageTilesRow ══
          Recibe todos los props del layout avanzado:
          - spotlight, responsive (mobile/desktop), avatares, mirroring propio,
            controles de authority, y limpieza al desconectar.
        */}
        <StageLayout
          tiles={stageTiles}
          isAuthority={!!isOwner || isAdmin}
          isOwner={!!isOwner}
          spotlightId={spotlightId}
          mySocketId={mySocketIdRef.current}
          onRemove={removeFromStage}
          onMuteMic={(!!isOwner || isAdmin) ? adminMuteMic : undefined}
          onMuteCam={(!!isOwner || isAdmin) ? adminMuteCam : undefined}
          onSpotlight={isOwner ? handleSpotlight : undefined}
        />

        {/* Badges */}
        {status === "live" && (
          <div className="live-badge-viewers">
            <span className="live-rec-dot" /> EN VIVO
            <span className="live-badge-sep">·</span>
            <Users size={12} strokeWidth={2} />{viewers}
          </div>
        )}
        {status === "waiting" && (
          <div className="live-badge-waiting">
            <Clock size={12} strokeWidth={2} /> PRÓXIMAMENTE
          </div>
        )}

        {/* Badge admin */}
        {!isOwner && isAdmin && (
          <div className="live-badge-viewers" style={{ top: 40, background: "rgba(124,58,237,0.85)" }}>
            👮 Admin
          </div>
        )}

        {/* Gift anim */}
        {giftAnim && (
          <div className="live-gift-anim">
            <span className="live-gift-anim-emoji">{GIFT_EMOJIS[giftAnim.type] ?? "🎁"}</span>
            <p>
              <strong>{giftAnim.from}</strong>{" envió "}
              <strong>{GIFT_LABELS[giftAnim.type] ?? giftAnim.type}</strong>{" x"}{giftAnim.amount}
            </p>
          </div>
        )}

        {/* Selector de fondo (owner y admin) */}
        {(isOwner || isAdmin) && (
          <BgPicker current={bgColor} onChange={setBgColor} />
        )}

        {/* Controles del owner */}
        {isOwner && (
          <div className="live-owner-controls">
            <button onClick={toggleMic} className={`live-ctrl-btn${micOn ? "" : " off"}`}>
              {micOn ? <Mic size={18} strokeWidth={1.75} /> : <MicOff size={18} strokeWidth={1.75} />}
            </button>
            <button onClick={toggleCam} className={`live-ctrl-btn${camOn ? "" : " off"}`}>
              {camOn ? <Video size={18} strokeWidth={1.75} /> : <VideoOff size={18} strokeWidth={1.75} />}
            </button>
          </div>
        )}

        {/* Controles del viewer invitado al escenario */}
        {!isOwner && isOnStage && (
          <StageSelfControls
            micOn={stageMicOn}
            camOn={stageCamOn}
            micLocked={stageMicLocked}
            camLocked={stageCamLocked}
            onToggleMic={toggleStageMic}
            onToggleCam={toggleStageCam}
          />
        )}
      </div>

      {/* ══ Panel de chat ═══════════════════════════════════════════════════ */}
      <div className="live-chat-panel">

        <div className="live-chat-header">
          <span className="live-chat-title">Chat en vivo</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {viewers > 0 && (
              <button
                onClick={() => setShowViewers((v) => !v)}
                className="live-chat-sub"
                style={{
                  background: showViewers ? "rgba(124,58,237,0.18)" : "transparent",
                  border: "none", cursor: "pointer", borderRadius: 6, padding: "2px 6px",
                  display: "flex", alignItems: "center", gap: 4,
                  color: showViewers ? "#c4b5fd" : "inherit",
                }}
              >
                <Users size={11} strokeWidth={2} />{viewers}
              </button>
            )}
            {isOwner && (
              <button onClick={endLive} disabled={ending} className="live-end-btn">
                <PhoneOff size={14} strokeWidth={2} />
                {ending ? "Finalizando…" : "Finalizar live"}
              </button>
            )}
          </div>
        </div>

        {showViewers && viewerList.length > 0 && (
          <div className="live-viewers-panel">
            <p className="live-viewers-label">Viendo ahora ({viewerList.length})</p>
            <div className="live-viewers-chips">
              {viewerList.map((v, i) => (
                <span key={i} className="live-viewer-chip">
                  {v.name}
                  {adminList.includes(v.socketId ?? "") && (
                    <span title="Admin" style={{ marginLeft: 3, fontSize: 9 }}>👮</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="live-stream-info">
          <div className="live-stream-info-row">
            {status === "live"    && <span className="live-pill live-pill-live">LIVE</span>}
            {status === "waiting" && <span className="live-pill live-pill-waiting">PRONTO</span>}
            <span className="live-stream-title">{live.title}</span>
          </div>
          <span className="live-stream-meta">
            {streamerName}{live.category ? ` · ${live.category}` : ""}
          </span>
        </div>

        {/* Panel del escenario — owner y admins */}
        {(isOwner || isAdmin) && status === "live" && (
          <StagePanel
            viewerList={viewerList}
            stageParticipants={stageParticipants}
            onInvite={inviteToStage}
            onRemove={removeFromStage}
            onMuteMic={adminMuteMic}
            onMuteCam={adminMuteCam}
            isOwner={!!isOwner}
            adminList={adminList}
            onSetAdmin={isOwner ? setAdminForViewer : undefined}
          />
        )}

        <div className="live-share-bar">
          {isOwner && (
            <button
              className={`live-share-toggle ${shareEnabled ? "on" : "off"}`}
              onClick={toggleShare}
            >
              {shareEnabled ? <Link size={12} strokeWidth={2} /> : <Link2Off size={12} strokeWidth={2} />}
              {shareEnabled ? "ON" : "OFF"}
            </button>
          )}
          {(shareEnabled || isOwner) ? (
            <button className={`live-share-copy ${copied ? "copied" : "default"}`} onClick={copyLink}>
              <Link size={11} strokeWidth={2} />
              {copied ? "¡Enlace copiado!" : "Copiar enlace del stream"}
            </button>
          ) : (
            <span className="live-share-disabled">Compartir deshabilitado</span>
          )}
        </div>

        <ChatMessages chat={chat} myUsername={myUsername} ownerUsername={streamerName} />

        {!isOwner && status === "live" && giftOpen && (
          <GiftPicker
            balance={balance}
            sendingGift={sendingGift}
            onSend={sendGift}
            onClose={() => setGiftOpen(false)}
            onOpenShop={() => { setGiftOpen(false); setBuyOpen(true); }}
          />
        )}

        <div className="live-chat-actions">
          <div className="live-input-row">
            {!isOwner && status === "live" && (
              <button
                className={`live-action-btn live-action-gift${giftOpen ? " active" : ""}`}
                onClick={() => setGiftOpen((v) => !v)}
              >
                <Gift size={16} strokeWidth={1.75} />
              </button>
            )}
            <input
              className="live-input"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder={status === "live" ? "Escribe un mensaje…" : "El live no está activo"}
              disabled={status !== "live"}
              maxLength={200}
            />
            <button
              className="live-send-btn"
              onClick={sendChat}
              disabled={status !== "live" || !msg.trim()}
            >
              <Send size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {buyOpen && (
        <GiftShopModal
          balance={balance}
          buying={buying}
          onBuy={buyGift}
          onClose={() => setBuyOpen(false)}
        />
      )}
    </div>
  );
}
