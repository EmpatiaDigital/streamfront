"use client";

/**
 * LiveHelpers.tsx
 *
 * Sub-componentes y tipos compartidos por LivePage.
 * Importa "./helpers.css" para sus propios estilos.
 *
 * Exporta:
 *   - ChatMessages
 *   - GiftPicker
 *   - GiftShopModal
 *   - StagePanel          (sidebar del owner)
 *   - StageTilesRow       (tiles de video sobre el stream principal)
 *   - StageSelfControls   (controles mic/cam del invitado en escenario)
 *   - Tipos y constantes de gifts
 */

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, X, ShoppingBag, ChevronDown } from "lucide-react";
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
};

export type StageParticipant = {
  socketId: string;
  name:     string;
  /** Estado gestionado localmente por el owner */
  micMuted?: boolean;
  camOff?:   boolean;
};

export type StageTileStream = {
  socketId: string;
  name:     string;
  stream:   MediaStream;
  /** Estado que el owner envía via socket */
  micMuted?: boolean;
  camOff?:   boolean;
};

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
          <div
            key={i}
            className={`live-msg ${isMe ? "live-msg--right" : "live-msg--left"}`}
          >
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
        <button onClick={onClose} aria-label="Cerrar">
          <X size={15} strokeWidth={2} />
        </button>
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
          <button className="live-shop-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="live-shop-grid">
          {GIFT_TYPES.map((type) => (
            <div key={type} className="live-shop-item">
              <span className="live-shop-emoji">{GIFT_EMOJIS[type]}</span>
              <div className="live-shop-info">
                <div className="live-shop-name">{GIFT_LABELS[type]}</div>
                <div className="live-shop-stock">Tenés: {balance[type] ?? 0}</div>
              </div>
              <button
                className="live-shop-buy-btn"
                onClick={() => onBuy(type)}
                disabled={!!buying}
              >
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
   STAGE PANEL  (sidebar del owner)
   ═══════════════════════════════════════════════════════════════ */
interface StagePanelProps {
  viewerList:        ViewerInfo[];
  stageParticipants: StageParticipant[];
  onInvite:          (viewer: ViewerInfo) => void;
  onRemove:          (socketId: string) => void;
  /** Silenciar mic de un participante (el owner lo envía via socket) */
  onMuteMic?:        (socketId: string, mute: boolean) => void;
  /** Apagar cam de un participante (el owner lo envía via socket) */
  onMuteCam?:        (socketId: string, off: boolean) => void;
}

export function StagePanel({
  viewerList,
  stageParticipants,
  onInvite,
  onRemove,
  onMuteMic,
  onMuteCam,
}: StagePanelProps) {
  const [open, setOpen] = useState(true);

  /* Viewers que aún NO están en el escenario */
  const stageIds  = new Set(stageParticipants.map((p) => p.socketId));
  const available = viewerList.filter((v) => v.socketId && !stageIds.has(v.socketId));

  return (
    <div className="live-stage-panel">
      {/* Header colapsable */}
      <div className="live-stage-panel-header" onClick={() => setOpen((v) => !v)}>
        <span className="live-stage-panel-title">
          🎬 Escenario ({stageParticipants.length})
        </span>
        <ChevronDown
          size={13}
          strokeWidth={2.5}
          className={`live-stage-panel-toggle${open ? " open" : ""}`}
        />
      </div>

      {open && (
        <>
          {/* Participantes activos */}
          {stageParticipants.length > 0 && (
            <div className="live-stage-slots">
              {stageParticipants.map((p) => (
                <div key={p.socketId} className="live-stage-slot">
                  <span className="live-stage-slot-dot" />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </span>

                  {/* Controles de admin */}
                  <div className="live-stage-slot-controls">
                    {/* Mic */}
                    {onMuteMic && (
                      <button
                        className={`live-stage-slot-ctrl mute${p.micMuted ? " active" : ""}`}
                        onClick={() => onMuteMic(p.socketId, !p.micMuted)}
                        title={p.micMuted ? "Activar mic" : "Silenciar mic"}
                      >
                        {p.micMuted ? "🔇" : "🎤"}
                      </button>
                    )}
                    {/* Cam */}
                    {onMuteCam && (
                      <button
                        className={`live-stage-slot-ctrl cam${p.camOff ? " active" : ""}`}
                        onClick={() => onMuteCam(p.socketId, !p.camOff)}
                        title={p.camOff ? "Activar cámara" : "Apagar cámara"}
                      >
                        {p.camOff ? "🚫" : "📷"}
                      </button>
                    )}
                    {/* Kick */}
                    <button
                      className="live-stage-slot-ctrl kick"
                      onClick={() => onRemove(p.socketId)}
                      title="Quitar del escenario"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selector de invitados */}
          {available.length > 0 && (
            <div className="live-stage-add-row">
              <select
                className="live-stage-invite-select"
                defaultValue=""
                onChange={(e) => {
                  const viewer = available.find((v) => v.socketId === e.target.value);
                  if (viewer) {
                    onInvite(viewer);
                    e.target.value = "";
                  }
                }}
              >
                <option value="" disabled>
                  ＋ Invitar al escenario…
                </option>
                {available.map((v) => (
                  <option key={v.socketId} value={v.socketId}>
                    {v.name}
                  </option>
                ))}
              </select>
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
   STAGE TILES ROW
   Tiles de video del escenario sobre el stream principal.
   Visibles para TODOS los usuarios.
   ═══════════════════════════════════════════════════════════════ */

/** Ref a video para srcObject */
function StageTileVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted     = true;   // tile propio del invitado → muted; el audio va por el stream principal
    el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transform: "scaleX(-1)" }}
    />
  );
}

interface StageTilesRowProps {
  tiles:    StageTileStream[];
  isOwner:  boolean;
  onRemove: (socketId: string) => void;
  /** Owner: silenciar mic de un participante */
  onMuteMic?: (socketId: string, mute: boolean) => void;
  /** Owner: apagar cam de un participante */
  onMuteCam?: (socketId: string, off: boolean) => void;
}

export function StageTilesRow({ tiles, isOwner, onRemove, onMuteMic, onMuteCam }: StageTilesRowProps) {
  if (tiles.length === 0) return null;

  return (
    <div
      className="live-stage-tiles"
      data-count={String(tiles.length)}
    >
      {tiles.map((tile) => (
        <div key={tile.socketId} className="live-stage-tile">
          <StageTileVideo stream={tile.stream} />

          {/* Nombre */}
          <span className="live-stage-tile-label">{tile.name}</span>

          {/* Controles del admin (solo owner, aparecen en hover / siempre en mobile) */}
          {isOwner && (
            <>
              {/* Controles mic/cam sobre el tile */}
              <div className="live-stage-tile-admin">
                {onMuteMic && (
                  <button
                    className={`live-stage-tile-ctrl ${tile.micMuted ? "mic-off" : "mic-on"}`}
                    onClick={() => onMuteMic(tile.socketId, !tile.micMuted)}
                    title={tile.micMuted ? "Activar mic" : "Silenciar mic"}
                  >
                    {tile.micMuted ? <MicOff size={10} strokeWidth={2.5} /> : <Mic size={10} strokeWidth={2.5} />}
                  </button>
                )}
                {onMuteCam && (
                  <button
                    className={`live-stage-tile-ctrl ${tile.camOff ? "cam-off" : "cam-on"}`}
                    onClick={() => onMuteCam(tile.socketId, !tile.camOff)}
                    title={tile.camOff ? "Activar cámara" : "Apagar cámara"}
                  >
                    {tile.camOff ? <VideoOff size={10} strokeWidth={2.5} /> : <Video size={10} strokeWidth={2.5} />}
                  </button>
                )}
              </div>

              {/* Botón expulsar */}
              <button
                className="live-stage-tile-remove"
                onClick={() => onRemove(tile.socketId)}
                title="Quitar del escenario"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </>
          )}

          {/* Badge mic silenciado (visible para todos) */}
          {tile.micMuted && (
            <div className="live-stage-tile-muted-badge" title="Mic silenciado">
              <MicOff size={9} strokeWidth={2.5} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAGE SELF CONTROLS
   Controles de mic/cam para el VIEWER que fue invitado al escenario.
   Se renderiza en LivePage sobre el área de video cuando el viewer
   está en el escenario (isOnStage === true).
   ═══════════════════════════════════════════════════════════════ */
interface StageSelfControlsProps {
  micOn:       boolean;
  camOn:       boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
}

export function StageSelfControls({ micOn, camOn, onToggleMic, onToggleCam }: StageSelfControlsProps) {
  return (
    <div className="live-stage-self-controls">
      <button
        className={`live-stage-self-btn${micOn ? "" : " off"}`}
        onClick={onToggleMic}
        title={micOn ? "Silenciar micrófono" : "Activar micrófono"}
      >
        {micOn
          ? <Mic size={18} strokeWidth={1.75} />
          : <MicOff size={18} strokeWidth={1.75} />
        }
      </button>
      <button
        className={`live-stage-self-btn${camOn ? "" : " off"}`}
        onClick={onToggleCam}
        title={camOn ? "Apagar cámara" : "Activar cámara"}
      >
        {camOn
          ? <Video size={18} strokeWidth={1.75} />
          : <VideoOff size={18} strokeWidth={1.75} />
        }
      </button>
    </div>
  );
}
