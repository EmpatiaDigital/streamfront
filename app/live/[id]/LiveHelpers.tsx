"use client";

/**
 * LiveHelpers.tsx — sub-componentes de LivePage.
 */
import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, Video, VideoOff, X,
  ShoppingBag, ChevronDown, Shield, ShieldOff,
} from "lucide-react";
import "./helpers.css";

/* ═══════════════════════════════════════════════════════════════
   TIPOS
═══════════════════════════════════════════════════════════════ */
export type ChatMsg = {
  username: string;
  message:  string;
  ts?:      number;
};

export type GiftMsg = {
  from:   string;
  type:   string;
  amount: number;
};

export type Balance = Record<string, number>;

export type ViewerInfo = {
  name:      string;
  socketId?: string;
  isAdmin?:  boolean;
};

export type StageParticipant = {
  socketId:   string;
  name:       string;
  micMuted?:  boolean;
  camOff?:    boolean;
  micLocked?: boolean;
  camLocked?: boolean;
};

export type StageTileStream = {
  socketId:   string;
  name:       string;
  stream:     MediaStream;
  micMuted?:  boolean;
  camOff?:    boolean;
  micLocked?: boolean;
  camLocked?: boolean;
};

/* ═══════════════════════════════════════════════════════════════
   COLORES DE FONDO
═══════════════════════════════════════════════════════════════ */
export const BG_OPTIONS = [
  { label: "Negro",       value: "#000000" },
  { label: "Azul",        value: "#1a237e" },
  { label: "Celeste",     value: "#0288d1" },
  { label: "Verde claro", value: "#2e7d32" },
  { label: "Beige",       value: "#d7ccc8" },
  { label: "Gris oscuro", value: "#263238" },
  { label: "Violeta",     value: "#4a148c" },
  { label: "Rosa suave",  value: "#880e4f" },
];

interface BgPickerProps {
  current: string;
  onChange: (color: string) => void;
}

export function BgPicker({ current, onChange }: BgPickerProps) {
  return (
    <div className="live-bg-picker">
      <span className="live-bg-picker-label">🎨 Fondo</span>
      <div className="live-bg-swatches">
        {BG_OPTIONS.map((o) => (
          <button
            key={o.value}
            className={`live-bg-swatch${current === o.value ? " active" : ""}`}
            style={{ background: o.value }}
            title={o.label}
            onClick={() => onChange(o.value)}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTES DE GIFTS
═══════════════════════════════════════════════════════════════ */
export const GIFT_EMOJIS: Record<string, string> = {
  corazon:  "❤️",
  estrella: "⭐",
  fuego:    "🔥",
  diamante: "💎",
  corona:   "👑",
  cohete:   "🚀",
};

export const GIFT_LABELS: Record<string, string> = {
  corazon:  "Corazón",
  estrella: "Estrella",
  fuego:    "Fuego",
  diamante: "Diamante",
  corona:   "Corona",
  cohete:   "Cohete",
};

const GIFT_TYPES = Object.keys(GIFT_EMOJIS);

/* ═══════════════════════════════════════════════════════════════
   CHAT MESSAGES
═══════════════════════════════════════════════════════════════ */
interface ChatMessagesProps {
  chat:          ChatMsg[];
  myUsername:    string;
  ownerUsername: string;
}

export function ChatMessages({ chat, myUsername, ownerUsername }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  if (chat.length === 0) {
    return (
      <div className="live-chat-messages">
        <p className="live-chat-empty">Sé el primero en comentar…</p>
        <div ref={bottomRef} />
      </div>
    );
  }

  return (
    <div className="live-chat-messages">
      {chat.map((m, i) => {
        const isMe    = m.username === myUsername;
        const isOwner = m.username === ownerUsername;
        return (
          <div key={i} className={`live-msg ${isMe ? "live-msg--right" : "live-msg--left"}`}>
            <span className="live-msg-name">
              {m.username}
              {isOwner && <span className="live-msg-owner-badge">HOST</span>}
            </span>
            <div className="live-msg-bubble">{m.message}</div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GIFT PICKER
═══════════════════════════════════════════════════════════════ */
interface GiftPickerProps {
  balance:      Balance;
  sendingGift:  string | null;
  onSend:       (type: string) => void;
  onClose:      () => void;
  onOpenShop:   () => void;
}

export function GiftPicker({ balance, sendingGift, onSend, onClose, onOpenShop }: GiftPickerProps) {
  return (
    <div className="live-gift-picker">
      <div className="live-gift-picker-header">
        <span>🎁 Enviar regalo</span>
        <button onClick={onClose} aria-label="Cerrar"><X size={15} strokeWidth={2} /></button>
      </div>
      <div className="live-gift-grid">
        {GIFT_TYPES.map((type) => (
          <button
            key={type}
            className="live-gift-item"
            onClick={() => onSend(type)}
            disabled={!!sendingGift}
            title={`${GIFT_LABELS[type]} (tenés ${balance[type] ?? 0})`}
          >
            <span className="live-gift-emoji">{GIFT_EMOJIS[type]}</span>
            <span className="live-gift-label">{GIFT_LABELS[type]}</span>
            <span className="live-gift-balance">x{balance[type] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="live-gift-shop-row">
        <button className="live-gift-shop-btn" onClick={onOpenShop}>
          <ShoppingBag size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
          Comprar más
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GIFT SHOP MODAL
═══════════════════════════════════════════════════════════════ */
interface GiftShopModalProps {
  balance: Balance;
  buying:  string | null;
  onBuy:   (type: string) => void;
  onClose: () => void;
}

export function GiftShopModal({ balance, buying, onBuy, onClose }: GiftShopModalProps) {
  return (
    <div className="live-shop-overlay" onClick={onClose}>
      <div className="live-shop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="live-shop-header">
          <span className="live-shop-title">🛍️ Tienda de regalos</span>
          <button className="live-shop-close" onClick={onClose}>✕</button>
        </div>
        <div className="live-shop-grid">
          {GIFT_TYPES.map((type) => (
            <div key={type} className="live-shop-item">
              <span className="live-shop-emoji">{GIFT_EMOJIS[type]}</span>
              <div className="live-shop-info">
                <div className="live-shop-name">{GIFT_LABELS[type]}</div>
                <div className="live-shop-stock">Tenés: {balance[type] ?? 0}</div>
              </div>
              <button className="live-shop-buy-btn" onClick={() => onBuy(type)} disabled={!!buying}>
                {buying === type ? "…" : "+10"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAGE PANEL — sidebar del owner / admin
═══════════════════════════════════════════════════════════════ */
interface StagePanelProps {
  viewerList:        ViewerInfo[];
  stageParticipants: StageParticipant[];
  onInvite:          (viewer: ViewerInfo) => void;
  onRemove:          (socketId: string) => void;
  onMuteMic?:        (socketId: string, mute: boolean, lock: boolean) => void;
  onMuteCam?:        (socketId: string, off: boolean, lock: boolean) => void;
  isOwner?:          boolean;
  adminList?:        string[];
  onSetAdmin?:       (socketId: string, isAdmin: boolean) => void;
}

export function StagePanel({
  viewerList,
  stageParticipants,
  onInvite,
  onRemove,
  onMuteMic,
  onMuteCam,
  isOwner,
  adminList = [],
  onSetAdmin,
}: StagePanelProps) {
  const [open, setOpen] = useState(true);
  const stageIds  = new Set(stageParticipants.map((p) => p.socketId));
  const available = viewerList.filter((v) => v.socketId && !stageIds.has(v.socketId));

  return (
    <div className="live-stage-panel">
      <div className="live-stage-panel-header" onClick={() => setOpen((v) => !v)}>
        <span className="live-stage-panel-title">🎬 Escenario ({stageParticipants.length})</span>
        <ChevronDown size={13} strokeWidth={2.5} className={`live-stage-panel-toggle${open ? " open" : ""}`} />
      </div>

      {open && (
        <>
          {stageParticipants.length > 0 && (
            <div className="live-stage-slots">
              {stageParticipants.map((p) => (
                <div key={p.socketId} className="live-stage-slot">
                  <span className="live-stage-slot-dot" />
                  <span className="live-stage-slot-name">{p.name}</span>
                  <div className="live-stage-slot-controls">
                    {onMuteMic && (
                      <button
                        className={`live-stage-slot-ctrl${p.micMuted ? " active" : ""}${p.micLocked ? " locked" : ""}`}
                        onClick={() => onMuteMic(p.socketId, !p.micMuted, p.micLocked ?? false)}
                        onDoubleClick={(e) => { e.preventDefault(); onMuteMic(p.socketId, true, !(p.micLocked ?? false)); }}
                        title={p.micLocked ? "Mic bloqueado (doble clic para desbloquear)" : p.micMuted ? "Activar mic" : "Silenciar mic (doble clic = bloquear)"}
                      >
                        {p.micLocked ? "🔒" : p.micMuted ? <MicOff size={10} /> : <Mic size={10} />}
                      </button>
                    )}
                    {onMuteCam && (
                      <button
                        className={`live-stage-slot-ctrl${p.camOff ? " active" : ""}${p.camLocked ? " locked" : ""}`}
                        onClick={() => onMuteCam(p.socketId, !p.camOff, p.camLocked ?? false)}
                        onDoubleClick={(e) => { e.preventDefault(); onMuteCam(p.socketId, true, !(p.camLocked ?? false)); }}
                        title={p.camLocked ? "Cam bloqueada (doble clic para desbloquear)" : p.camOff ? "Activar cámara" : "Apagar cámara (doble clic = bloquear)"}
                      >
                        {p.camLocked ? "🔒" : p.camOff ? <VideoOff size={10} /> : <Video size={10} />}
                      </button>
                    )}
                    <button className="live-stage-slot-ctrl kick" onClick={() => onRemove(p.socketId)} title="Quitar">
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {available.length > 0 && (
            <div className="live-stage-add-row">
              <select
                className="live-stage-invite-select"
                defaultValue=""
                onChange={(e) => {
                  const viewer = available.find((v) => v.socketId === e.target.value);
                  if (viewer) { onInvite(viewer); e.target.value = ""; }
                }}
              >
                <option value="" disabled>＋ Invitar al escenario…</option>
                {available.map((v) => (
                  <option key={v.socketId} value={v.socketId}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          {isOwner && viewerList.length > 0 && (
            <div className="live-stage-admin-section">
              <p className="live-stage-admin-label">👮 Admins del live</p>
              {viewerList.filter((v) => v.socketId).map((v) => {
                const isAdm = adminList.includes(v.socketId!);
                return (
                  <div key={v.socketId} className="live-stage-admin-row">
                    <span className="live-stage-admin-name">{v.name}</span>
                    <button
                      className={`live-stage-admin-btn${isAdm ? " active" : ""}`}
                      onClick={() => onSetAdmin?.(v.socketId!, !isAdm)}
                    >
                      {isAdm ? <><ShieldOff size={10} /> Quitar</> : <><Shield size={10} /> Admin</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {stageParticipants.length === 0 && available.length === 0 && (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", padding: "0 12px 10px", margin: 0 }}>
              No hay espectadores disponibles.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAGE TILE VIDEO
   - El owner ve el video muteado (él escucha el audio via el stream WebRTC principal)
   - Los viewers NO-owner lo escuchan (muted=false)
═══════════════════════════════════════════════════════════════ */
interface StageTileVideoProps {
  stream:  MediaStream;
  /** Si true, silencia el audio en el elemento <video> para evitar eco */
  muted:   boolean;
  camOff?: boolean;
}

function StageTileVideo({ stream, muted, camOff }: StageTileVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted     = muted;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [stream, muted]);

  // Cuando camOff cambia, no necesitamos reemplazar el srcObject;
  // el track ya fue deshabilitado en origen. Solo ocultamos el video.
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={{
        width: "100%", height: "100%", objectFit: "cover", display: "block",
        transform: "scaleX(-1)",
        opacity: camOff ? 0 : 1,
        transition: "opacity 0.3s",
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAGE TILES ROW
═══════════════════════════════════════════════════════════════ */
interface StageTilesRowProps {
  tiles:      StageTileStream[];
  /** true si quien ve esto es el owner o un admin */
  isAuthority: boolean;
  onRemove:   (socketId: string) => void;
  onMuteMic?: (socketId: string, mute: boolean, lock: boolean) => void;
  onMuteCam?: (socketId: string, off: boolean, lock: boolean) => void;
  /** socketId propio del viewer (para mutear su propia tile y evitar eco) */
  mySocketId?: string;
}

export function StageTilesRow({
  tiles,
  isAuthority,
  onRemove,
  onMuteMic,
  onMuteCam,
  mySocketId,
}: StageTilesRowProps) {
  if (tiles.length === 0) return null;

  return (
    <div className="live-stage-tiles" data-count={String(tiles.length)}>
      {tiles.map((tile) => {
        // El viewer que emite su propio stream no se escucha a sí mismo (eco)
        const shouldMute = tile.socketId === mySocketId || isAuthority;

        return (
          <div key={tile.socketId} className="live-stage-tile">
            <StageTileVideo
              stream={tile.stream}
              muted={shouldMute}
              camOff={tile.camOff}
            />

            {/* Placeholder cuando cam está apagada */}
            {tile.camOff && (
              <div className="live-stage-tile-cam-off">
                <VideoOff size={18} strokeWidth={1.5} />
                <span>{tile.name}</span>
              </div>
            )}

            {/* Nombre siempre visible */}
            <span className="live-stage-tile-label">{tile.name}</span>

            {/* Controles del authority (owner/admin) */}
            {isAuthority && (
              <>
                <div className="live-stage-tile-admin">
                  {onMuteMic && (
                    <button
                      className={`live-stage-tile-ctrl ${tile.micMuted ? "mic-off" : "mic-on"}${tile.micLocked ? " locked" : ""}`}
                      onClick={() => onMuteMic(tile.socketId, !tile.micMuted, tile.micLocked ?? false)}
                      onDoubleClick={(e) => { e.preventDefault(); onMuteMic(tile.socketId, true, !(tile.micLocked ?? false)); }}
                      title={tile.micLocked ? "Mic bloqueado" : tile.micMuted ? "Activar mic" : "Silenciar mic"}
                    >
                      {tile.micLocked
                        ? <span style={{ fontSize: 9 }}>🔒</span>
                        : tile.micMuted
                          ? <MicOff size={10} strokeWidth={2.5} />
                          : <Mic size={10} strokeWidth={2.5} />}
                    </button>
                  )}
                  {onMuteCam && (
                    <button
                      className={`live-stage-tile-ctrl ${tile.camOff ? "cam-off" : "cam-on"}${tile.camLocked ? " locked" : ""}`}
                      onClick={() => onMuteCam(tile.socketId, !tile.camOff, tile.camLocked ?? false)}
                      onDoubleClick={(e) => { e.preventDefault(); onMuteCam(tile.socketId, true, !(tile.camLocked ?? false)); }}
                      title={tile.camLocked ? "Cam bloqueada" : tile.camOff ? "Activar cámara" : "Apagar cámara"}
                    >
                      {tile.camLocked
                        ? <span style={{ fontSize: 9 }}>🔒</span>
                        : tile.camOff
                          ? <VideoOff size={10} strokeWidth={2.5} />
                          : <Video size={10} strokeWidth={2.5} />}
                    </button>
                  )}
                </div>
                <button className="live-stage-tile-remove" onClick={() => onRemove(tile.socketId)} title="Quitar">
                  <X size={11} strokeWidth={2.5} />
                </button>
              </>
            )}

            {/* Badge mic silenciado (visible para todos) */}
            {tile.micMuted && (
              <div className="live-stage-tile-muted-badge">
                <MicOff size={9} strokeWidth={2.5} />
                {tile.micLocked && <span style={{ fontSize: 7, marginLeft: 1 }}>🔒</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAGE SELF CONTROLS — controles del viewer invitado
═══════════════════════════════════════════════════════════════ */
interface StageSelfControlsProps {
  micOn:       boolean;
  camOn:       boolean;
  micLocked:   boolean;
  camLocked:   boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
}

export function StageSelfControls({
  micOn, camOn, micLocked, camLocked, onToggleMic, onToggleCam,
}: StageSelfControlsProps) {
  return (
    <div className="live-stage-self-controls">
      <button
        className={`live-stage-self-btn${micOn ? "" : " off"}${micLocked ? " locked" : ""}`}
        onClick={micLocked ? undefined : onToggleMic}
        disabled={micLocked}
        title={micLocked ? "El host bloqueó tu micrófono" : micOn ? "Silenciar micrófono" : "Activar micrófono"}
      >
        {micOn && !micLocked ? <Mic size={18} strokeWidth={1.75} /> : <MicOff size={18} strokeWidth={1.75} />}
        {micLocked && <span className="live-stage-self-lock">🔒</span>}
      </button>
      <button
        className={`live-stage-self-btn${camOn ? "" : " off"}${camLocked ? " locked" : ""}`}
        onClick={camLocked ? undefined : onToggleCam}
        disabled={camLocked}
        title={camLocked ? "El host bloqueó tu cámara" : camOn ? "Apagar cámara" : "Activar cámara"}
      >
        {camOn && !camLocked ? <Video size={18} strokeWidth={1.75} /> : <VideoOff size={18} strokeWidth={1.75} />}
        {camLocked && <span className="live-stage-self-lock">🔒</span>}
      </button>
    </div>
  );
}
