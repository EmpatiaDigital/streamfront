'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import '../styles/hero-slider.css'

const slides = [
  {
    number: '01 / 03',
    eyebrow: 'En vivo ahora mismo',
    eyebrowClass: 'eye-1',
    dotClass: 'pd-1',
    titleLine1: 'Tu voz merece',
    titleLine2: 'el escenario.',
    gradClass: 't-grad-1',
    desc: 'Miles de artistas compiten <b>en vivo</b> cada día. El próximo en brillar bajo los reflectores podrías ser tú.',
    stats: [
      { val: '12k+', label: 'En vivo ahora' },
      { val: '98%',  label: 'Votan en tiempo real' },
      { val: '47',   label: 'Países activos' },
    ],
    barClass: 'mb-1',
    btnClass: 'sb-1',
    btnText: 'Subir al escenario',
    figureColor: 'purple',
    stageFrom: 'rgba(124,58,237,0.20)',
    stageTo:   'rgba(13,13,26,0.0)',
    floorFrom: 'rgba(168,85,247,0.6)',
    floorTo:   'rgba(236,72,153,0.6)',
    glowColor: 'rgba(168,85,247,0.25)',
  },
  {
    number: '02 / 03',
    eyebrow: 'Competición en vivo',
    eyebrowClass: 'eye-2',
    dotClass: 'pd-2',
    titleLine1: 'Compite.',
    titleLine2: 'Sé elegido.',
    gradClass: 't-grad-2',
    desc: 'El público vota en tiempo real. Cada actuación es una <b>batalla de talentos</b> donde el mejor se lleva la corona.',
    stats: [
      { val: '500k', label: 'Votos por semana' },
      { val: '#1',   label: 'Plataforma de talento' },
      { val: '24h',  label: 'Streaming continuo' },
    ],
    barClass: 'mb-2',
    btnClass: 'sb-2',
    btnText: 'Unirme ahora',
    figureColor: 'pink',
    stageFrom: 'rgba(190,24,93,0.20)',
    stageTo:   'rgba(13,13,26,0.0)',
    floorFrom: 'rgba(236,72,153,0.6)',
    floorTo:   'rgba(245,158,11,0.6)',
    glowColor: 'rgba(236,72,153,0.25)',
  },
  {
    number: '03 / 03',
    eyebrow: 'Tu momento es ahora',
    eyebrowClass: 'eye-3',
    dotClass: 'pd-3',
    titleLine1: 'Del sueño',
    titleLine2: 'al estrellato.',
    gradClass: 't-grad-3',
    desc: 'No necesitas un sello discográfico. Solo <b>talento, pasión y un teléfono</b>. El mundo está mirando — muéstrale quién eres.',
    stats: [
      { val: '3.2M', label: 'Artistas registrados' },
      { val: '$0',   label: 'Para empezar' },
      { val: '∞',    label: 'Posibilidades' },
    ],
    barClass: 'mb-3',
    btnClass: 'sb-3',
    btnText: 'Empezar gratis',
    figureColor: 'green',
    stageFrom: 'rgba(5,150,105,0.20)',
    stageTo:   'rgba(13,13,26,0.0)',
    floorFrom: 'rgba(16,185,129,0.6)',
    floorTo:   'rgba(168,85,247,0.6)',
    glowColor: 'rgba(16,185,129,0.25)',
  },
]

const CROWD = [
  { left: 2,  delay: 0    },
  { left: 8,  delay: 0.3  },
  { left: 14, delay: 0.6  },
  { left: 20, delay: 0.1  },
  { left: 27, delay: 0.8  },
  { left: 33, delay: 0.4  },
  { left: 40, delay: 1.0  },
  { left: 47, delay: 0.2  },
  { left: 54, delay: 0.7  },
  { left: 61, delay: 0.5  },
  { left: 68, delay: 1.1  },
  { left: 75, delay: 0.35 },
  { left: 82, delay: 0.9  },
  { left: 88, delay: 0.15 },
  { left: 94, delay: 0.65 },
]

export default function HeroSlider() {
  const [cur, setCur] = useState(0)
  const [prog, setProg] = useState(0)
  const [fadeKey, setFadeKey] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const goTo = (n: number) => {
    setCur(n)
    setProg(0)
    setFadeKey((k) => k + 1)
  }

  const next = () => goTo((cur + 1) % 3)
  const prev = () => goTo((cur + 2) % 3)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setProg(0)
    intervalRef.current = setInterval(() => {
      setProg((p) => {
        if (p >= 100) {
          setCur((c) => {
            const nextC = (c + 1) % 3
            setFadeKey((k) => k + 1)
            return nextC
          })
          return 0
        }
        return p + 2
      })
    }, 100)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [cur])

  const s = slides[cur]

  return (
    <div className="hs-root">

      {/* Barra de progreso */}
      <div className="hs-progress">
        <div className="hs-prog-fill" style={{ width: `${prog}%` }} />
      </div>

      <div className="hs-inner">

        {/* ── Contenido izquierda ── */}
        <div className="hs-content">
          <div className="hs-number">{s.number}</div>

          <div className={`hs-eyebrow ${s.eyebrowClass}`}>
            <span className={`hs-pulse-dot ${s.dotClass}`} />
            {s.eyebrow}
          </div>

          <h2 className="hs-title">
            <span className={s.gradClass}>
              {s.titleLine1}<br />{s.titleLine2}
            </span>
          </h2>

          <p className="hs-desc" dangerouslySetInnerHTML={{ __html: s.desc }} />

          <div className="hs-stats">
            {s.stats.map((st) => (
              <div key={st.label} className="hs-stat">
                <div className="hs-stat-val">{st.val}</div>
                <div className="hs-stat-label">{st.label}</div>
                <div className={`hs-stat-bar ${s.barClass}`} />
              </div>
            ))}
          </div>

          <button className={`hs-btn ${s.btnClass}`}>
            {s.btnText} →
          </button>
        </div>

        {/* ── Silueta mobile (fondo, solo visible en mobile via CSS) ── */}
        <div className="hs-mobile-figure" key={`mobile-${fadeKey}`}>
          <img
            src={`/images/silueta${cur + 1}.png`}
            alt={s.eyebrow}
          />
          <div className="hs-mobile-figure-overlay" />
        </div>

        {/* ── Escenario derecha (desktop) ── */}
        <div className="hs-visual">
          <div
            className="hs-stage"
            style={{
              background: `linear-gradient(160deg, ${s.stageFrom} 0%, ${s.stageTo} 100%)`,
            }}
          >
            {/* Focos */}
            <div className="hs-spotlights">
              <div className="hs-spot" />
              <div className="hs-spot" />
              <div className="hs-spot" />
            </div>

            {/* Imagen con fade */}
            <div className="hs-figure-img" key={fadeKey}>
              <img
                src={`/images/silueta${cur + 1}.png`}
                alt={s.eyebrow}
                className="hs-figure-photo"
              />
              <div className={`hs-figure-overlay hs-figure-overlay-${s.figureColor}`} />
            </div>

            {/* Crowd */}
            <div className="hs-crowd">
              {CROWD.map((c, i) => (
                <div
                  key={i}
                  className="hs-crowd-person"
                  style={{ left: `${c.left}%` }}
                >
                  <div
                    className="hs-crowd-arm"
                    style={{ animationDelay: `${c.delay}s` }}
                  />
                  <div className="hs-crowd-head" />
                  <div className="hs-crowd-body" />
                </div>
              ))}
            </div>

            {/* Piso */}
            <div
              className="hs-floor"
              style={{
                background: `linear-gradient(90deg, transparent, ${s.floorFrom}, ${s.floorTo}, transparent)`,
              }}
            />

            {/* Glow */}
            <div
              className="hs-glow"
              style={{
                background: `radial-gradient(ellipse at 50% 100%, ${s.glowColor}, transparent)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Navegación */}
      <div className="hs-nav">
        <div className="hs-dots">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              className={`hs-dot-btn ${cur === i ? 'active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <div className="hs-arrows">
          <button className="hs-arr" onClick={prev} aria-label="Anterior">
            <ArrowLeft size={16} />
          </button>
          <button className="hs-arr" onClick={next} aria-label="Siguiente">
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

    </div>
  )
}