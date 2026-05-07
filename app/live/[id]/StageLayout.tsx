"use client";

/**
 * StageLayout.tsx
 * Componente para visualizar y controlar el escenario del live.
 * - Spotlight: el owner puede destacar un participante como principal.
 * - Responsive: máx 5 tiles en mobile, 8 en desktop.
 * - El destacado siempre ocupa el lugar principal.
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
  stream:  MediaStream;
  muted:   boolean;
  camOff?: boolean;
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
        opacity: camOff ? 0 : 1,
      }}
    />
  );
}

interface StageLayoutProps {
  tiles:        StageTileStream[];
  isAuthority:  boolean;        // owner o admin
  isOwner:      boolean;        // solo el creador puede hacer spotlight
  spotlightId:  string | null;  // socketId del destacado actual
  mySocketId:   string;
  onRemove:     (socketId: string) => void;
  onMuteMic?:   (socketId: string, mute: boolean, lock: boolean) => void;
  onMuteCam?:   (socketId: string, off: boolean, lock: boolean) => void;
  onSpotlight?: (socketId: string | null) => void; // null = quitar
}

const MAX_MOBILE = 5;
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

  // Spotlight tile primero
  const spotlightTile = spotlightId ? tiles.find((t) => t.socketId === spotlightId) : null;
  const restTiles     = tiles.filter((t) => t.socketId !== spotlightId);
  const visibleRest   = restTiles.slice(0, maxTiles - (spotlightTile ? 1 : 0));
  const hiddenCount   = restTiles.length - visibleRest.length;

  const renderTile = (tile: StageTileStream, isSpotlight = false) => {
    const shouldMute = tile.socketId === mySocketId || isAuthority;
    const isSpotlighted = tile.socketId === spotlightId;

    return (
      <div
        key={tile.socketId}
        className={`stage-tile${isSpotlight ? " stage-tile--spotlight" : ""}${isSpotlighted && !isSpotlight ? " stage-tile--spotlighted-mini" : ""}`}
      >
        <StageTileVideo
          stream={tile.stream}
          muted={shouldMute}
          camOff={tile.camOff}
          mirrored={tile.socketId === mySocketId}
        />

        {tile.camOff && (
          <div className="stage-tile-cam-off">
            <div className="stage-tile-avatar">
              {tile.name.charAt(0).toUpperCase()}
            </div>
            <span>{tile.name}</span>
          </div>
        )}

        {/* Nombre */}
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

        {/* Controles authority */}
        {isAuthority && (
          <div className="stage-tile-controls">
            {/* Spotlight — solo owner */}
            {isOwner && onSpotlight && (
              <button
                className={`stage-tile-ctrl stage-tile-ctrl--spotlight${isSpotlighted ? " active" : ""}`}
                onClick={() => onSpotlight(isSpotlighted ? null : tile.socketId)}
                title={isSpotlighted ? "Quitar destaque" : "Destacar en escenario"}
              >
                {isSpotlighted ? <StarOff size={10} strokeWidth={2.5} /> : <Star size={10} strokeWidth={2.5} />}
              </button>
            )}

            {onMuteMic && (
              <button
                className={`stage-tile-ctrl${tile.micMuted ? " active" : ""}${tile.micLocked ? " locked" : ""}`}
                onClick={() => onMuteMic(tile.socketId, !tile.micMuted, tile.micLocked ?? false)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onMuteMic(tile.socketId, true, !(tile.micLocked ?? false));
                }}
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
                className={`stage-tile-ctrl${tile.camOff ? " active" : ""}${tile.camLocked ? " locked" : ""}`}
                onClick={() => onMuteCam(tile.socketId, !tile.camOff, tile.camLocked ?? false)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onMuteCam(tile.socketId, true, !(tile.camLocked ?? false));
                }}
                title={tile.camLocked ? "Cam bloqueada" : tile.camOff ? "Activar cámara" : "Apagar cámara"}
              >
                {tile.camLocked
                  ? <span style={{ fontSize: 9 }}>🔒</span>
                  : tile.camOff
                    ? <VideoOff size={10} strokeWidth={2.5} />
                    : <Video size={10} strokeWidth={2.5} />}
              </button>
            )}

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

  // Layout: si hay spotlight → grande arriba + row abajo
  // Sin spotlight → grid uniforme
  return (
    <div className={`stage-layout${spotlightTile ? " stage-layout--has-spotlight" : ""}`}>
      {spotlightTile && (
        <div className="stage-layout-spotlight">
          {renderTile(spotlightTile, true)}
        </div>
      )}

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

      {!spotlightTile && tiles.length > 0 && (
        /* Sin spotlight: grid normal */
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
