"use client";

/**
 * StageLayout.tsx
 *
 * FIX: El tile con spotlight ahora aparece UNA SOLA VEZ.
 * - Con spotlight: tile grande arriba + los DEMÁS tiles en la fila de abajo.
 * - Sin spotlight: grid uniforme con todos los tiles.
 * La lógica anterior renderizaba el tile destacado tanto en
 * `stage-layout-spotlight` como en `stage-layout-grid`, produciéndolo dos veces.
 */

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, X, Star, StarOff } from "lucide-react";
import "./stage-layout.css";

export type StageTileStream = {
  socketId:   string;
  name:       string;
  stream:     MediaStream;
  micMuted?:  boolean;
  camOff?:    boolean;
  micLocked?: boolean;
  camLocked?: boolean;
};

interface StageTileVideoProps {
  stream:    MediaStream;
  muted:     boolean;
  camOff?:   boolean;
  mirrored?: boolean;
}

function StageTileVideo({ stream, muted, camOff, mirrored }: StageTileVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted     = muted;
    el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [stream, muted]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="stage-tile-video"
      style={{
        transform: mirrored ? "scaleX(-1)" : "none",
        opacity:   camOff ? 0 : 1,
      }}
    />
  );
}

interface StageLayoutProps {
  tiles:        StageTileStream[];
  isAuthority:  boolean;        // owner o admin
  isOwner:      boolean;        // solo el creador puede manejar spotlight
  spotlightId:  string | null;  // socketId del tile destacado
  mySocketId:   string;
  onRemove:     (socketId: string) => void;
  onMuteMic?:   (socketId: string, mute: boolean, lock: boolean) => void;
  onMuteCam?:   (socketId: string, off: boolean, lock: boolean) => void;
  onSpotlight?: (socketId: string | null) => void; // null = quitar destaque
}

const MAX_MOBILE  = 5;
const MAX_DESKTOP = 8;

export function StageLayout({
  tiles,
  isAuthority,
  isOwner,
  spotlightId,
  mySocketId,
  onRemove,
  onMuteMic,
  onMuteCam,
  onSpotlight,
}: StageLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (tiles.length === 0) return null;

  const maxTiles = isMobile ? MAX_MOBILE : MAX_DESKTOP;

  /**
   * CORRECCIÓN DEL BUG DE DUPLICADO:
   *
   * Antes:
   *   - spotlightTile  → se renderizaba en stage-layout-spotlight
   *   - restTiles      → tiles sin el destacado → se renderizaban en stage-layout-row
   *   - !spotlightTile → TODOS los tiles en stage-layout-grid
   *
   * El problema: cuando había spotlight activo se ejecutaban AMBAS ramas
   * (stage-layout-spotlight + stage-layout-grid) porque la condición
   * `!spotlightTile` era false pero el grid también se renderizaba con
   * `visibleRest` que incluía tiles sin el destacado, y en algunos
   * refactors previos el grid se renderizaba siempre.
   *
   * Solución: usar una sola variable `hasSpotlight` y renderizar
   * EXCLUSIVAMENTE una de las dos ramas (spotlight+row ó grid).
   */
  const hasSpotlight  = !!spotlightId && tiles.some((t) => t.socketId === spotlightId);
  const spotlightTile = hasSpotlight ? tiles.find((t) => t.socketId === spotlightId)! : null;

  // Los tiles que NO son el destacado
  const restTiles   = hasSpotlight
    ? tiles.filter((t) => t.socketId !== spotlightId)
    : tiles;

  const visibleRest = restTiles.slice(0, maxTiles - (hasSpotlight ? 1 : 0));
  const hiddenCount = restTiles.length - visibleRest.length;

  // ── Render de un tile individual ──────────────────────────────────────────
  const renderTile = (tile: StageTileStream, isSpotlight = false) => {
    // Solo mutear el tile PROPIO para evitar eco.
    // NUNCA mutear los tiles ajenos — eso silencia el audio de todos los invitados.
    // isAuthority no tiene nada que ver con el mute local del elemento <video>.
    const shouldMute    = tile.socketId === mySocketId;
    const isSpotlighted = tile.socketId === spotlightId;

    return (
      <div
        key={tile.socketId}
        className={[
          "stage-tile",
          isSpotlight ? "stage-tile--spotlight" : "",
        ].filter(Boolean).join(" ")}
      >
        <StageTileVideo
          stream={tile.stream}
          muted={shouldMute}
          camOff={tile.camOff}
          mirrored={tile.socketId === mySocketId}
        />

        {/* Overlay cuando la cámara está apagada */}
        {tile.camOff && (
          <div className="stage-tile-cam-off">
            <div className="stage-tile-avatar">
              {(tile.name || "?").charAt(0).toUpperCase()}
            </div>
            <span>{tile.name}</span>
          </div>
        )}

        {/* Nombre + badge de mic */}
        <div className="stage-tile-footer">
          <span className="stage-tile-name">
            {isSpotlighted && <span className="stage-tile-star">★</span>}
            {tile.name}
          </span>
          {tile.micMuted && (
            <span className="stage-tile-mic-badge">
              <MicOff size={9} strokeWidth={2.5} />
              {tile.micLocked && <span style={{ fontSize: 7 }}>🔒</span>}
            </span>
          )}
        </div>

        {/* Controles de authority (owner / admin) */}
        {isAuthority && (
          <div className="stage-tile-controls">

            {/* Spotlight — solo el owner */}
            {isOwner && onSpotlight && (
              <button
                className={`stage-tile-ctrl stage-tile-ctrl--spotlight${isSpotlighted ? " active" : ""}`}
                onClick={() => onSpotlight(isSpotlighted ? null : tile.socketId)}
                title={isSpotlighted ? "Quitar destaque" : "Destacar en escenario"}
              >
                {isSpotlighted
                  ? <StarOff size={10} strokeWidth={2.5} />
                  : <Star    size={10} strokeWidth={2.5} />}
              </button>
            )}

            {/* Mic */}
            {onMuteMic && (
              <button
                className={[
                  "stage-tile-ctrl",
                  tile.micMuted  ? "active" : "",
                  tile.micLocked ? "locked" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onMuteMic(tile.socketId, !tile.micMuted, tile.micLocked ?? false)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onMuteMic(tile.socketId, true, !(tile.micLocked ?? false));
                }}
                title={
                  tile.micLocked ? "Mic bloqueado (doble clic = desbloquear)" :
                  tile.micMuted  ? "Activar mic" :
                  "Silenciar mic (doble clic = bloquear)"
                }
              >
                {tile.micLocked
                  ? <span style={{ fontSize: 9 }}>🔒</span>
                  : tile.micMuted
                    ? <MicOff size={10} strokeWidth={2.5} />
                    : <Mic    size={10} strokeWidth={2.5} />}
              </button>
            )}

            {/* Cam */}
            {onMuteCam && (
              <button
                className={[
                  "stage-tile-ctrl",
                  tile.camOff    ? "active" : "",
                  tile.camLocked ? "locked" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onMuteCam(tile.socketId, !tile.camOff, tile.camLocked ?? false)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onMuteCam(tile.socketId, true, !(tile.camLocked ?? false));
                }}
                title={
                  tile.camLocked ? "Cam bloqueada (doble clic = desbloquear)" :
                  tile.camOff    ? "Activar cámara" :
                  "Apagar cámara (doble clic = bloquear)"
                }
              >
                {tile.camLocked
                  ? <span style={{ fontSize: 9 }}>🔒</span>
                  : tile.camOff
                    ? <VideoOff size={10} strokeWidth={2.5} />
                    : <Video    size={10} strokeWidth={2.5} />}
              </button>
            )}

            {/* Quitar del escenario */}
            <button
              className="stage-tile-ctrl stage-tile-ctrl--remove"
              onClick={() => onRemove(tile.socketId)}
              title="Quitar del escenario"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  //
  // CON spotlight → renderiza solo:
  //   1. stage-layout-spotlight  (el tile grande)
  //   2. stage-layout-row        (los DEMÁS tiles pequeños)
  //
  // SIN spotlight → renderiza solo:
  //   1. stage-layout-grid       (todos los tiles en cuadrícula uniforme)
  //
  // Estas dos ramas son MUTUAMENTE EXCLUYENTES; no hay forma de que un
  // tile aparezca dos veces.

  return (
    <div className={`stage-layout${hasSpotlight ? " stage-layout--has-spotlight" : ""}`}>

      {hasSpotlight ? (
        /* ── Modo spotlight ── */
        <>
          {/* Tile grande */}
          <div className="stage-layout-spotlight">
            {renderTile(spotlightTile!, true)}
          </div>

          {/* Fila de tiles restantes (pueden ser 0) */}
          {visibleRest.length > 0 && (
            <div
              className="stage-layout-row"
              data-count={String(Math.min(visibleRest.length, maxTiles))}
            >
              {visibleRest.map((tile) => renderTile(tile, false))}
              {hiddenCount > 0 && (
                <div className="stage-tile stage-tile--hidden-count">
                  <span>+{hiddenCount}</span>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* ── Modo grid (sin spotlight) ── */
        <div
          className="stage-layout-grid"
          data-count={String(Math.min(tiles.length, maxTiles))}
        >
          {tiles.slice(0, maxTiles).map((tile) => renderTile(tile, false))}
          {tiles.length > maxTiles && (
            <div className="stage-tile stage-tile--hidden-count">
              <span>+{tiles.length - maxTiles}</span>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
