"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  Mic, MicOff, Video, VideoOff, Square, Send, Gift,
  X, Users, Radio, Clock, PhoneOff, ShoppingBag, Link, Link2Off,
} from "lucide-react";
import "./live.css";

const BACKEND = "https://stream-72mw.onrender.com";

type ChatMsg    = { username: string; message: string; at: string; avatar?: string };
type GiftMsg    = { from: string; type: string; amount: number; message?: string };
type LiveStatus = "waiting" | "live" | "ended";
type LiveData   = {
  _id: string; title: string; description?: string; category?: string;
  status: LiveStatus; hlsUrl?: string; vodUrl?: string; thumbnail?: string;
  streamKey?: string;
  user?: { _id: string; name: string; avatar?: string } | string;
};
type Balance    = Record<string, number>;
type ViewerInfo = { name: string; joinedAt: string };

const GIFT_EMOJIS: Record<string, string> = {
  corazon:  "❤️", estrella: "⭐", fuego:    "🔥",
  diamante: "💎", corona:   "👑", cohete:   "🚀",
};
const GIFT_LABELS: Record<string, string> = {
  corazon:  "Corazón",  estrella: "Estrella", fuego:    "Fuego",
  diamante: "Diamante", corona:   "Corona",   cohete:   "Cohete",
};
const GIFT_PRICE: Record<string, string> = {
  corazon:  "gratis", estrella: "gratis", fuego:    "gratis",
  diamante: "$0.99",  corona:   "$1.49",  cohete:   "$1.99",
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

  // ── Refs ──────────────────────────────────────────────────────────────────
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef      = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnsRef   = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerConnRef    = useRef<RTCPeerConnection | null>(null);
  const chatEndRef     = useRef<HTMLDivElement>(null);
  const streamReadyRef = useRef(false);
  const socketReadyRef = useRef(false);
  // Ref para reintentar play() si el autoplay falla
  const autoPlayRetryRef = useRef<(() => void) | null>(null);

  // ── Estado base ───────────────────────────────────────────────────────────
  const [live,        setLive]        = useState<LiveData | null>(null);
  const [isOwner,     setIsOwner]     = useState<boolean | null>(null);
  const [chat,        setChat]        = useState<ChatMsg[]>([]);
  const [msg,         setMsg]         = useState("");
  const [viewers,     setViewers]     = useState(0);
  const [giftAnim,    setGiftAnim]    = useState<GiftMsg | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [micOn,       setMicOn]       = useState(true);
  const [camOn,       setCamOn]       = useState(true);
  const [connected,   setConnected]   = useState(false);
  const [giftOpen,    setGiftOpen]    = useState(false);
  const [ending,      setEnding]      = useState(false);
  // Pantalla negra: mostrar botón "Tap para ver" cuando autoplay es bloqueado
  const [needsTap,    setNeedsTap]    = useState(false);

  // ── Estado viewers + compartir ────────────────────────────────────────────
  const [viewerList,   setViewerList]   = useState<ViewerInfo[]>([]);
  const [shareEnabled, setShareEnabled] = useState(true);
  const [copied,       setCopied]       = useState(false);
  const [showViewers,  setShowViewers]  = useState(false);

  // ── Estado gifts ──────────────────────────────────────────────────────────
  const [balance,     setBalance]     = useState<Balance>({
    corazon: 0, estrella: 0, fuego: 0, diamante: 0, corona: 0, cohete: 0,
  });
  const [buyOpen,     setBuyOpen]     = useState(false);
  const [buying,      setBuying]      = useState<string | null>(null);
  const [sendingGift, setSendingGift] = useState<string | null>(null);

  // ── URL para compartir ────────────────────────────────────────────────────
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/live/${id}`
    : "";

  // ── Limpieza total ────────────────────────────────────────────────────────
  const fullCleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    streamReadyRef.current = false;
    socketReadyRef.current = false;
    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    peerConnsRef.current.forEach((pc) => pc.close());
    peerConnsRef.current.clear();
    peerConnRef.current?.close();
    peerConnRef.current = null;
    autoPlayRetryRef.current = null;
  }, []);

  // ── Helper: intentar reproducir video remoto ──────────────────────────────
  // Esto resuelve la pantalla negra en Chrome/Safari por política de autoplay
  const tryPlayRemote = useCallback((videoEl: HTMLVideoElement) => {
    const attempt = () => {
      videoEl.play()
        .then(() => {
          setNeedsTap(false);
          autoPlayRetryRef.current = null;
        })
        .catch((err) => {
          // NotAllowedError = autoplay bloqueado, mostrar botón de tap
          if (err.name === "NotAllowedError" || err.name === "AbortError") {
            setNeedsTap(true);
            // Guardar ref para llamar al hacer tap
            autoPlayRetryRef.current = () => {
              videoEl.muted = false;
              videoEl.play()
                .then(() => setNeedsTap(false))
                .catch(() => {});
            };
          }
        });
    };
    attempt();
  }, []);

  // ── registerStreamer cuando ambos (socket + cámara) están listos ──────────
  const tryRegisterStreamer = useCallback(() => {
    if (!socketReadyRef.current || !streamReadyRef.current) return;
    if (!socketRef.current?.connected) return;
    const { name } = getStoredUser();
    socketRef.current.emit("live:registerStreamer", { liveId: id, username: name });
    console.log("📡 live:registerStreamer emitido");
  }, [id]);

  // ── PASO 1: Cargar live y determinar isOwner ──────────────────────────────
  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("token");
    const { id: myId } = getStoredUser();

    fetch(`${BACKEND}/api/live/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        const liveData: LiveData = data.live ?? data;
        if (!liveData?._id) { setError("Live no encontrado"); return; }
        setLive(liveData);
        const ownerId =
          typeof liveData.user === "object"
            ? String(liveData.user?._id ?? "")
            : String(liveData.user ?? "");
        const owner = !!myId && !!ownerId && myId === ownerId;
        setIsOwner(owner);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── PASO 1b: Cargar balance de gifts ─────────────────────────────────────
  useEffect(() => {
    if (isOwner === null || isOwner === true) return;
    const token = localStorage.getItem("token");
    fetch(`${BACKEND}/api/live/gifts/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (data.balance) setBalance(data.balance); })
      .catch(() => {});
  }, [isOwner]);

  // ── PASO 2: Crear PeerConnection streamer → viewer ────────────────────────
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
    },
    []
  );

  // ── PASO 3: Socket.IO ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || isOwner === null) return;

    const token = localStorage.getItem("token");
    const s = io(BACKEND, {
      auth: { token },
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    socketRef.current = s;

    s.on("connect", () => {
      socketReadyRef.current = true;
      s.emit("live:join", { liveId: id });
      if (isOwner) {
        tryRegisterStreamer();
      } else {
        s.emit("webrtc:viewerReady", { liveId: id });
      }
    });

    s.on("disconnect", () => { socketReadyRef.current = false; });

    s.on("live:chat",        (m: ChatMsg) => setChat((p) => [...p.slice(-199), m]));
    s.on("live:viewerCount", ({ count }: { count: number }) => setViewers(count));
    s.on("live:viewerList",  ({ viewers: vl }: { viewers: ViewerInfo[] }) => setViewerList(vl));
    s.on("live:shareState",  ({ enabled }: { enabled: boolean }) => setShareEnabled(enabled));

    s.on("live:gift", (g: GiftMsg) => {
      setGiftAnim(g);
      setTimeout(() => setGiftAnim(null), 3500);
    });
    s.on("live:ended", () => {
      fullCleanup();
      setLive((p) => (p ? { ...p, status: "ended" } : p));
    });

    // Streamer recibe viewer nuevo
    s.on("webrtc:newViewer", async ({ viewerSocketId }: { viewerSocketId: string }) => {
      if (!isOwner || !localStreamRef.current) return;
      const pc    = createStreamerPC(viewerSocketId, localStreamRef.current);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      s.emit("webrtc:offer", { targetSocketId: viewerSocketId, sdp: offer });
    });

    // ── FIX PANTALLA NEGRA: Viewer recibe oferta ──────────────────────────
    s.on("webrtc:offer", async ({
      streamerSocketId,
      sdp,
    }: {
      streamerSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (isOwner) return;
      peerConnRef.current?.close();

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnRef.current = pc;

      pc.ontrack = (e) => {
        const stream = e.streams[0];
        if (!stream) return;

        const videoEl = remoteVideoRef.current;
        if (!videoEl) return;

        // 1. Asignar el stream ANTES de llamar play()
        videoEl.srcObject = stream;

        // 2. Chrome necesita muted=true para autoplay sin interacción previa.
        //    Lo quitamos luego del primer play exitoso.
        videoEl.muted = true;

        // 3. Llamar play() explícitamente (autoPlay attr no siempre alcanza)
        videoEl.play()
          .then(() => {
            // Play exitoso con muted → quitar mute y mostrar video
            videoEl.muted = false;
            setConnected(true);
            setNeedsTap(false);
          })
          .catch((err) => {
            if (err.name === "AbortError") {
              // Interrumpido por otra llamada, reintentar
              setTimeout(() => tryPlayRemote(videoEl), 300);
              return;
            }
            // NotAllowedError: autoplay completamente bloqueado
            // Mostrar botón "Tap para ver" y guardar callback
            setConnected(true); // el stream está ahí, solo falta el play
            setNeedsTap(true);
            autoPlayRetryRef.current = () => {
              videoEl.muted = false;
              videoEl.play()
                .then(() => setNeedsTap(false))
                .catch(() => {});
            };
          });
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate)
          s.emit("webrtc:ice", { targetSocketId: streamerSocketId, candidate });
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") setConnected(true);
        if (state === "failed" || state === "disconnected") {
          setConnected(false);
          setNeedsTap(false);
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit("webrtc:answer", { targetSocketId: streamerSocketId, sdp: answer });
    });

    // Streamer recibe answer
    s.on("webrtc:answer", async ({
      viewerSocketId,
      sdp,
    }: {
      viewerSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (!isOwner) return;
      const pc = peerConnsRef.current.get(viewerSocketId);
      if (!pc || pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    // ICE candidates
    s.on("webrtc:ice", async ({
      fromSocketId,
      candidate,
    }: {
      fromSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      try {
        if (isOwner) {
          const pc = peerConnsRef.current.get(fromSocketId);
          if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          if (peerConnRef.current?.remoteDescription)
            await peerConnRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.warn("⚠️ ICE error:", e);
      }
    });

    return () => {
      s.emit("live:leave", { liveId: id });
      s.disconnect();
      socketRef.current  = null;
      socketReadyRef.current = false;
    };
  }, [id, isOwner, createStreamerPC, fullCleanup, tryRegisterStreamer, tryPlayRemote]);

  // ── PASO 4: Cámara del streamer ───────────────────────────────────────────
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

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const sendChat = () => {
    if (!msg.trim() || !id) return;
    const { name } = getStoredUser();
    socketRef.current?.emit("live:chat", { liveId: id, message: msg, username: name });
    setMsg("");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback para entornos sin clipboard API
      const el = document.createElement("input");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
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

  const sendGift = async (type: string, amount = 1) => {
    if (!id || sendingGift) return;
    if ((balance[type] ?? 0) < amount) { setBuyOpen(true); return; }
    setSendingGift(type);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND}/api/live/${id}/gift`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Error al enviar el regalo"); return; }
      setBalance((prev) => ({ ...prev, [type]: data.newBalance }));
      setGiftOpen(false);
    } catch {
      alert("Error de conexión al enviar el regalo");
    } finally {
      setSendingGift(null);
    }
  };

  const buyGift = async (type: string, quantity = 10) => {
    if (buying) return;
    setBuying(type);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND}/api/live/gifts/buy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type, quantity }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Error al comprar"); return; }
      if (data.balance) setBalance(data.balance);
    } catch {
      alert("Error de conexión");
    } finally {
      setBuying(null);
    }
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
    } catch {
      setEnding(false);
    }
  };

  const streamerName =
    typeof live?.user === "object" ? live.user?.name ?? "Streamer" : "Streamer";

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

  const status: LiveStatus = live.status;

  // ── Vista principal ───────────────────────────────────────────────────────
  return (
    <div className="live-root">

      {/* ══ Área de video ═══════════════════════════════════════════════════ */}
      <div className="live-video-area">

        {/* Video del streamer (owner) */}
        {isOwner && (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="live-video-el"
            style={{ display: camOn ? "block" : "none", transform: "scaleX(-1)" }}
          />
        )}

        {/* Video remoto (viewer) */}
        {!isOwner && (
          <>
            {/*
              KEY FIX pantalla negra:
              - playsInline: obligatorio en iOS para no fullscreen automático
              - autoPlay: hint al browser, pero NO garantiza reproducción
              - muted: empieza en mudo para bypassear autoplay policy de Chrome,
                       lo removemos en ontrack una vez que play() resuelve
              - El play() real lo maneja tryPlayRemote() en el evento ontrack del PC
            */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="live-video-el"
              style={{ display: connected ? "block" : "none" }}
            />

            {/* Overlay "Tap para ver" cuando autoplay fue bloqueado */}
            {connected && needsTap && (
              <button
                onClick={() => autoPlayRetryRef.current?.()}
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 12,
                  background: "rgba(0,0,0,0.55)",
                  border: "none", cursor: "pointer", zIndex: 10,
                  color: "#fff",
                }}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28,
                }}>
                  ▶
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                  Tocá para ver el stream
                </span>
              </button>
            )}

            {!connected && (
              <div className="live-video-placeholder">
                <Radio size={40} strokeWidth={1} />
                <span>{status === "live" ? "Conectando al stream…" : "Esperando que inicie…"}</span>
              </div>
            )}
          </>
        )}

        {isOwner && !camOn && (
          <div className="live-video-placeholder">
            <VideoOff size={40} strokeWidth={1} />
            <span>Cámara apagada</span>
          </div>
        )}

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

        {giftAnim && (
          <div className="live-gift-anim">
            <span className="live-gift-anim-emoji">{GIFT_EMOJIS[giftAnim.type] ?? "🎁"}</span>
            <p>
              <strong>{giftAnim.from}</strong>
              {" envió "}
              <strong>{GIFT_LABELS[giftAnim.type] ?? giftAnim.type}</strong>
              {" x"}{giftAnim.amount}
            </p>
          </div>
        )}

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
      </div>

      {/* ══ Panel de chat ═══════════════════════════════════════════════════ */}
      <div className="live-chat-panel">

        {/* Header */}
        <div className="live-chat-header">
          <span className="live-chat-title">Chat en vivo</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {viewers > 0 && (
              <button
                onClick={() => setShowViewers((v) => !v)}
                className="live-chat-sub"
                style={{
                  background: showViewers ? "rgba(124,58,237,0.2)" : "transparent",
                  border: "none", cursor: "pointer", borderRadius: 6, padding: "2px 6px",
                  display: "flex", alignItems: "center", gap: 4,
                  color: showViewers ? "#c4b5fd" : "inherit",
                }}
                title="Ver espectadores"
              >
                <Users size={11} strokeWidth={2} style={{ display: "inline", verticalAlign: "middle" }} />
                {viewers}
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

        {/* Panel colapsable de viewers online */}
        {showViewers && viewerList.length > 0 && (
          <div style={{
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(124,58,237,0.05)",
          }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
              VIENDO AHORA ({viewerList.length})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {viewerList.map((v, i) => (
                <span key={i} style={{
                  fontSize: 11, background: "rgba(124,58,237,0.2)",
                  color: "#c4b5fd", borderRadius: 10,
                  padding: "2px 8px", fontWeight: 600,
                }}>
                  {v.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Info del stream */}
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

        {/* Barra de compartir */}
        <div style={{
          padding: "7px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {/* Owner: toggle compartir */}
          {isOwner && (
            <button
              onClick={toggleShare}
              title={shareEnabled ? "Deshabilitar compartir" : "Habilitar compartir"}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 9px", borderRadius: 7,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${shareEnabled ? "rgba(163,230,53,0.4)" : "rgba(255,255,255,0.12)"}`,
                background: shareEnabled ? "rgba(163,230,53,0.1)" : "rgba(255,255,255,0.04)",
                color: shareEnabled ? "#a3e635" : "rgba(255,255,255,0.35)",
                transition: "all 0.15s", flexShrink: 0,
              }}
            >
              {shareEnabled
                ? <Link size={12} strokeWidth={2} />
                : <Link2Off size={12} strokeWidth={2} />}
              {shareEnabled ? "ON" : "OFF"}
            </button>
          )}

          {/* Botón copiar enlace */}
          {(shareEnabled || isOwner) ? (
            <button
              onClick={copyLink}
              style={{
                flex: 1, display: "flex", alignItems: "center",
                justifyContent: "center", gap: 5,
                padding: "4px 9px", borderRadius: 7,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${copied ? "rgba(163,230,53,0.4)" : "rgba(255,255,255,0.1)"}`,
                background: copied ? "rgba(163,230,53,0.1)" : "rgba(255,255,255,0.04)",
                color: copied ? "#a3e635" : "rgba(255,255,255,0.45)",
                transition: "all 0.15s",
              }}
            >
              <Link size={11} strokeWidth={2} />
              {copied ? "¡Enlace copiado!" : "Copiar enlace del stream"}
            </button>
          ) : (
            <span style={{
              flex: 1, fontSize: 11,
              color: "rgba(255,255,255,0.25)", fontStyle: "italic",
              textAlign: "center",
            }}>
              Compartir deshabilitado
            </span>
          )}
        </div>

        {/* Mensajes del chat */}
        <div className="live-chat-messages">
          {chat.length === 0 ? (
            <p className="live-chat-empty">Sé el primero en comentar 👋</p>
          ) : (
            chat.map((m, i) => (
              <div key={i} className="live-msg">
                <span className="live-msg-user">{m.username}:</span>
                <span className="live-msg-text">{m.message}</span>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Gift picker */}
        {!isOwner && status === "live" && giftOpen && (
          <div className="live-gift-picker">
            <div className="live-gift-picker-header">
              <span>Enviar regalo</span>
              <button onClick={() => setGiftOpen(false)} aria-label="Cerrar">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="live-gift-grid">
              {Object.entries(GIFT_EMOJIS).map(([type, emoji]) => {
                const stock = balance[type] ?? 0;
                const busy  = sendingGift === type;
                return (
                  <button
                    key={type}
                    className="live-gift-item"
                    onClick={() => sendGift(type, 1)}
                    disabled={busy}
                    style={{ opacity: stock === 0 ? 0.45 : 1 }}
                  >
                    <span className="live-gift-emoji">{busy ? "⏳" : emoji}</span>
                    <span className="live-gift-label">{GIFT_LABELS[type]}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, marginTop: 2,
                      color: stock > 0 ? "#a3e635" : "#f87171",
                    }}>
                      x{stock}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setGiftOpen(false); setBuyOpen(true); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                width: "100%", marginTop: 10, padding: "8px 0",
                background: "rgba(250,204,21,0.12)",
                border: "1px solid rgba(250,204,21,0.3)",
                borderRadius: 8, color: "#fbbf24",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              <ShoppingBag size={13} strokeWidth={2} />
              Comprar más gifts
            </button>
          </div>
        )}

        {/* Input de chat */}
        <div className="live-chat-actions">
          <div className="live-input-row">
            {!isOwner && status === "live" && (
              <button
                className={`live-action-btn live-action-gift${giftOpen ? " active" : ""}`}
                onClick={() => setGiftOpen((v) => !v)}
                title="Enviar regalo"
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

      {/* ══ Modal tienda de gifts ════════════════════════════════════════════ */}
      {buyOpen && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200, padding: 16,
        }}>
          <div style={{
            background: "#12121f",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, padding: 24,
            width: "100%", maxWidth: 360,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>Tienda de gifts</p>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  Comprá gifts para enviar en lives
                </p>
              </div>
              <button
                onClick={() => setBuyOpen(false)}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {Object.entries(GIFT_EMOJIS).map(([type, emoji]) => {
                const stock = balance[type] ?? 0;
                const busy  = buying === type;
                return (
                  <button
                    key={type}
                    onClick={() => buyGift(type, 10)}
                    disabled={busy}
                    style={{
                      display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 4,
                      padding: "12px 8px", borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: busy ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
                      cursor: busy ? "not-allowed" : "pointer",
                      transition: "background 0.15s", color: "#fff",
                    }}
                  >
                    <span style={{ fontSize: 26 }}>{busy ? "⏳" : emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{GIFT_LABELS[type]}</span>
                    <span style={{ fontSize: 10, color: stock > 0 ? "#a3e635" : "rgba(255,255,255,0.35)" }}>
                      Tenés: {stock}
                    </span>
                    <span style={{
                      fontSize: 10, marginTop: 2, padding: "2px 7px", borderRadius: 6,
                      background: GIFT_PRICE[type] === "gratis"
                        ? "rgba(163,230,53,0.15)" : "rgba(251,191,36,0.15)",
                      color: GIFT_PRICE[type] === "gratis" ? "#a3e635" : "#fbbf24",
                      fontWeight: 600,
                    }}>
                      {GIFT_PRICE[type] === "gratis" ? "+10 gratis" : `${GIFT_PRICE[type]} / 10`}
                    </span>
                  </button>
                );
              })}
            </div>
            <p style={{
              fontSize: 10, color: "rgba(255,255,255,0.3)",
              textAlign: "center", marginTop: 16, marginBottom: 0,
            }}>
              Los gifts "gratis" se suman sin costo. Los pagos reales requieren integrar un gateway de pagos.
            </p>
          </div>
        </div>
      )}

      {/* ── Estilos inline ─────────────────────────────────────────────────── */}
      <style>{`
        .live-end-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 8px; border: none;
          background: #ef4444; color: #fff; font-size: 12px;
          font-weight: 600; cursor: pointer; white-space: nowrap;
          transition: background 0.18s, opacity 0.18s, transform 0.12s;
        }
        .live-end-btn:hover:not(:disabled)  { background: #dc2626; transform: scale(1.03); }
        .live-end-btn:active:not(:disabled) { transform: scale(0.97); }
        .live-end-btn:disabled              { opacity: 0.6; cursor: not-allowed; }

        .live-back-btn {
          margin-top: 16px; padding: 8px 20px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.08); color: #fff;
          font-size: 14px; cursor: pointer; transition: background 0.18s;
        }
        .live-back-btn:hover { background: rgba(255,255,255,0.14); }

        @keyframes giftPop {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.4); }
          20%  { opacity: 1; transform: translate(-50%,-62%) scale(1.2); }
          80%  { opacity: 1; transform: translate(-50%,-62%) scale(1);   }
          100% { opacity: 0; transform: translate(-50%,-80%) scale(0.9); }
        }
        @keyframes live-blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}