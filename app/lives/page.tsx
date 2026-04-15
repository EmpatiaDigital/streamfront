"use client";
import { useState, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Radio, Video, VideoOff, Mic, MicOff, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import "./lives.css";

const BACKEND = "https://stream-72mw.onrender.com";

const CATEGORIES = [
  "Música", "Baile", "Arte", "Comedia",
  "Gaming", "Cocina", "Deporte", "Educación", "Otro",
];

export default function GoLivePage() {
  const { user } = useContext(AuthContext)!;
  const router   = useRouter();

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState("");
  const [catOpen,     setCatOpen]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  // Media states
  const videoRef     = useRef<HTMLVideoElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const [camOn,      setCamOn]      = useState(false);
  const [micOn,      setMicOn]      = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [permAsked,  setPermAsked]  = useState(false);

  if (!user) {
    router.push("/login");
    return null;
  }

  useEffect(() => {
    startMedia();
    return () => stopMedia();
  }, []);

  const startMedia = async () => {
    setMediaError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCamOn(true);
      setMicOn(true);
      setPermAsked(true);
    } catch (err: any) {
      setPermAsked(true);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMediaError("Permiso de cámara/micrófono denegado. Habilitalo en el navegador.");
      } else if (err.name === "NotFoundError") {
        setMediaError("No se encontró cámara o micrófono en este dispositivo.");
      } else {
        setMediaError("No se pudo acceder a la cámara/micrófono: " + err.message);
      }
    }
  };

  const stopMedia = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const handleStart = async () => {
    if (!title.trim()) return setError("El título es obligatorio.");
    if (!category)     return setError("Elegí una categoría.");
    if (!streamRef.current) return setError("Necesitás habilitar la cámara para transmitir.");
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND}/api/live`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Error al crear el vivo.");
      }

      const data = await res.json();
      router.push(`/live/${data.live._id}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="golive-root">
      <div className="golive-glow" />

      <div className="golive-card">
        {/* Header */}
        <div className="golive-header">
          <div className="golive-icon-wrap">
            <Radio size={28} className="golive-icon" />
            <span className="golive-icon-ring" />
          </div>
          <h1 className="golive-title">Iniciar transmisión</h1>
          <p className="golive-subtitle">
            Configurá tu vivo y conectate con tu audiencia
          </p>
        </div>

        {/* Preview REAL de cámara */}
        <div className="golive-preview">
          {mediaError ? (
            <div className="golive-media-error">
              <AlertCircle size={18} />
              <span>{mediaError}</span>
              <button className="golive-retry-btn" onClick={startMedia}>
                Reintentar
              </button>
            </div>
          ) : (
            <div className="golive-video-wrap">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`golive-video ${camOn ? "" : "golive-video--off"}`}
              />
              {!camOn && (
                <div className="golive-video-overlay">
                  <VideoOff size={32} />
                  <span>Cámara apagada</span>
                </div>
              )}
            </div>
          )}

          {/* Controles mic / cam */}
          <div className="golive-preview-badges">
            <button
              className={`golive-badge golive-badge--btn ${micOn ? "" : "golive-badge--off"}`}
              onClick={toggleMic}
              title={micOn ? "Silenciar micrófono" : "Activar micrófono"}
              disabled={!permAsked || !!mediaError}
            >
              {micOn ? <Mic size={13} /> : <MicOff size={13} />}
              {micOn ? "Mic activo" : "Mic silenciado"}
            </button>

            <button
              className={`golive-badge golive-badge--btn ${camOn ? "" : "golive-badge--off"}`}
              onClick={toggleCam}
              title={camOn ? "Apagar cámara" : "Encender cámara"}
              disabled={!permAsked || !!mediaError}
            >
              {camOn ? <Video size={13} /> : <VideoOff size={13} />}
              {camOn ? "Cam activa" : "Cam apagada"}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="golive-form">
          <div className="golive-field">
            <label className="golive-label">Título del vivo <span>*</span></label>
            <input
              className="golive-input"
              placeholder="¿De qué va tu transmisión?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
            <span className="golive-counter">{title.length}/80</span>
          </div>

          <div className="golive-field">
            <label className="golive-label">Descripción</label>
            <textarea
              className="golive-textarea"
              placeholder="Contale a tu audiencia qué pueden esperar…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
            />
            <span className="golive-counter">{description.length}/300</span>
          </div>

          <div className="golive-field">
            <label className="golive-label">Categoría <span>*</span></label>
            <div className="golive-select-wrap">
              <button
                className={`golive-select ${catOpen ? "open" : ""}`}
                onClick={() => setCatOpen((v) => !v)}
                type="button"
              >
                <span>{category || "Seleccioná una categoría"}</span>
                <ChevronDown size={15} className={`golive-chevron ${catOpen ? "open" : ""}`} />
              </button>
              {catOpen && (
                <div className="golive-dropdown">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      className={`golive-option ${category === c ? "selected" : ""}`}
                      onClick={() => { setCategory(c); setCatOpen(false); }}
                      type="button"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="golive-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            className="golive-btn"
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="golive-spin" />
                Iniciando…
              </>
            ) : (
              <>
                <span className="golive-btn-dot" />
                Comenzar vivo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}