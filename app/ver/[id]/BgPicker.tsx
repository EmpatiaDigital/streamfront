"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import  "../../live/[id]/live.css";

const PRESETS = [
  { label: "Negro",     value: "#000000" },
  { label: "Noche",     value: "#0a0a14" },
  { label: "Azul",      value: "#0d1b2a" },
  { label: "Violeta",   value: "#1a0a2e" },
  { label: "Verde",     value: "#0a1a0f" },
  { label: "Rojo",      value: "#1a0a0a" },
  { label: "Gris",      value: "#1a1a1a" },
  { label: "Blanco",    value: "#f0f0f0" },
];

interface BgPickerProps {
  current: string;
  onChange: (color: string) => void;
}

export function BgPicker({ current, onChange }: BgPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bgpicker-root">
      <button
        className="bgpicker-toggle"
        onClick={() => setOpen((v) => !v)}
        title="Cambiar fondo"
      >
        <Palette size={15} strokeWidth={2} />
        <span>Fondo</span>
      </button>

      {open && (
        <div className="bgpicker-panel">
          <div className="bgpicker-swatches">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                className={`bgpicker-swatch${current === p.value ? " active" : ""}`}
                style={{ background: p.value }}
                onClick={() => { onChange(p.value); setOpen(false); }}
                title={p.label}
              />
            ))}
          </div>
          <div className="bgpicker-custom">
            <label htmlFor="bgpicker-input">Personalizado</label>
            <input
              id="bgpicker-input"
              type="color"
              value={current}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
