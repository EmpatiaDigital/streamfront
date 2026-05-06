/**
 * LiveHelpers.tsx
 * Componentes auxiliares para la página de live:
 *  - useUserColor: asigna colores estables por username
 *  - ChatBubble: burbuja de chat izquierda/derecha
 *  - ChatMessages: lista de mensajes
 *  - GiftPicker: panel de regalos
 *  - StagePanel: escenario multi-usuario (owner invita hasta 8 viewers)
 */

import { useMemo, useRef, useEffect } from "react";
import { X, ShoppingBag, Gift } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos compartidos
// ─────────────────────────────────────────────────────────────────────────────
export type ChatMsg = {
  username: string;
  message: string;
  at: string;
  avatar?: string;
};

export type GiftMsg = {
  from: string;
  type: string;
  amount: number;
  message?: string;
};

export type ViewerInfo = {
  name: string;
  joinedAt: string;
  socketId?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Paleta de colores para usernames
// ─────────────────────────────────────────────────────────────────────────────
const USER_COLORS = [
  "#60a5fa", // azul
  "#f472b6", // rosa
  "#34d399", // verde
  "#fb923c", // naranja
  "#a78bfa", // violeta
  "#fbbf24", // amarillo
  "#38bdf8", // celeste
  "#f87171", // rojo suave
  "#4ade80", // verde lima
  "#e879f9", // fucsia
  "#94a3b8", // gris azul
  "#2dd4bf", // turquesa
];

/** Hook que retorna un color estable por username */
export function useUserColor() {
  const cache = useRef<Map<string, string>>(new Map());
  return function getColor(username: string): string {
    if (!cache.current.has(username)) {
      // hash simple del nombre → índice
      let hash = 0;
      for (let i = 0; i < username.length; i++) {
        hash = (hash * 31 + username.charCodeAt(i)) & 0xffffffff;
      }
      const idx = Math.abs(hash) % USER_COLORS.length;
      cache.current.set(username, USER_COLORS[idx]);
    }
    return cache.current.get(username)!;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatBubble
// ─────────────────────────────────────────────────────────────────────────────
interface ChatBubbleProps {
  msg: ChatMsg;
  isSelf: boolean;
  isOwner: boolean;
  color: string;
}

export function ChatBubble({ msg, isSelf, isOwner, color }: ChatBubbleProps) {
  const side = isSelf ? "live-msg--right" : "live-msg--left";
  return (
    <div className={`live-msg ${side}`}>
      <span className="live-msg-name" style={{ color }}>
        {msg.username}
        {isOwner && (
          <span className="live-msg-owner-badge">HOST</span>
        )}
      </span>
      <div className="live-msg-bubble">
        {msg.message}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatMessages
// ─────────────────────────────────────────────────────────────────────────────
interface ChatMessagesProps {
  chat: ChatMsg[];
  myUsername: string;
  ownerUsername: string;
}

export function ChatMessages({ chat, myUsername, ownerUsername }: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const getColor = useUserColor();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  return (
    <div className="live-chat-messages">
      {chat.length === 0 ? (
        <p className="live-chat-empty">Sé el primero en comentar 👋</p>
      ) : (
        chat.map((m, i) => (
          <ChatBubble
            key={i}
            msg={m}
            isSelf={m.username === myUsername}
            isOwner={m.username === ownerUsername}
            color={getColor(m.username)}
          />
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gift data
// ─────────────────────────────────────────────────────────────────────────────
export const GIFT_EMOJIS: Record<string, string> = {
  corazon:  "❤️", estrella: "⭐", fuego:    "🔥",
  diamante: "💎", corona:   "👑", cohete:   "🚀",
};
export const GIFT_LABELS: Record<string, string> = {
  corazon:  "Corazón",  estrella: "Estrella", fuego:    "Fuego",
  diamante: "Diamante", corona:   "Corona",   cohete:   "Cohete",
};
export const GIFT_PRICE: Record<string, string> = {
  corazon:  "gratis", estrella: "gratis", fuego:    "gratis",
  diamante: "$0.99",  corona:   "$1.49",  cohete:   "$1.99",
};

// ─────────────────────────────────────────────────────────────────────────────
// GiftPicker
// ─────────────────────────────────────────────────────────────────────────────
export type Balance = Record<string, number>;

interface GiftPickerProps {
  balance: Balance;
  sendingGift: string | null;
  onSend: (type: string) => void;
  onClose: () => void;
  onOpenShop: () => void;
}

export function GiftPicker({
  balance, sendingGift, onSend, onClose, onOpenShop,
}: GiftPickerProps) {
  return (
    <div className="live-gift-picker">
      <div className="live-gift-picker-header">
        <span>Enviar regalo</span>
        <button onClick={onClose} aria-label="Cerrar">
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
              onClick={() => onSend(type)}
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
        onClick={onOpenShop}
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GiftShopModal
// ─────────────────────────────────────────────────────────────────────────────
interface GiftShopModalProps {
  balance: Balance;
  buying: string | null;
  onBuy: (type: string) => void;
  onClose: () => void;
}

export function GiftShopModal({ balance, buying, onBuy, onClose }: GiftShopModalProps) {
  return (
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
            onClick={onClose}
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
                onClick={() => onBuy(type)}
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StagePanel — El owner invita hasta 8 viewers al escenario
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_STAGE_PARTICIPANTS = 8;

export interface StageParticipant {
  socketId: string;
  name: string;
}

interface StagePanelProps {
  /** Lista completa de viewers conectados */
  viewerList: ViewerInfo[];
  /** Participantes actualmente en el escenario */
  stageParticipants: StageParticipant[];
  /** Agregar viewer al escenario */
  onInvite: (viewer: ViewerInfo) => void;
  /** Quitar viewer del escenario */
  onRemove: (socketId: string) => void;
}

export function StagePanel({
  viewerList, stageParticipants, onInvite, onRemove,
}: StagePanelProps) {
  const stageIds = useMemo(
    () => new Set(stageParticipants.map((p) => p.socketId)),
    [stageParticipants]
  );

  const availableViewers = viewerList.filter(
    (v) => v.socketId && !stageIds.has(v.socketId!)
  );

  const isFull = stageParticipants.length >= MAX_STAGE_PARTICIPANTS;

  return (
    <div className="live-stage-panel">
      <div className="live-stage-panel-header">
        <span className="live-stage-panel-title">
          🎙 Escenario ({stageParticipants.length}/{MAX_STAGE_PARTICIPANTS})
        </span>
      </div>

      {/* Slots ocupados */}
      {stageParticipants.length > 0 && (
        <div className="live-stage-slots">
          {stageParticipants.map((p) => (
            <div key={p.socketId} className="live-stage-slot">
              <span className="live-stage-slot-dot" />
              {p.name}
              <button
                className="live-stage-slot-remove"
                onClick={() => onRemove(p.socketId)}
                title={`Quitar a ${p.name} del escenario`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selector para invitar */}
      {!isFull && availableViewers.length > 0 && (
        <div className="live-stage-add-row">
          <select
            className="live-stage-invite-select"
            value=""
            onChange={(e) => {
              const viewer = availableViewers.find((v) => v.socketId === e.target.value);
              if (viewer) onInvite(viewer);
            }}
          >
            <option value="" disabled>+ Invitar al escenario…</option>
            {availableViewers.map((v) => (
              <option key={v.socketId} value={v.socketId!}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isFull && (
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "0 12px 8px", margin: 0 }}>
          Escenario lleno (máx. {MAX_STAGE_PARTICIPANTS})
        </p>
      )}

      {!isFull && availableViewers.length === 0 && (
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "0 12px 8px", margin: 0 }}>
          No hay viewers disponibles para invitar
        </p>
      )}
    </div>
  );
}
