"use client";

import { useState, useEffect } from "react";
import { Upload, LogOut, ChevronDown, User, Radio } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import "../styles/navbar.css";

const links = [
  { label: "Inicio",    href: "/" },
  { label: "Explorar",  href: "/explorar" },
  { label: "En vivo",   href: "/en-vivo" },
  { label: "Ranking",   href: "/ranking" },
  { label: "Comunidad", href: "/comunidad" },
];

// ─── NavbarLiveButton (ver vivos activos) ────────────────────────────────────

const BACKEND = "https://stream-72mw.onrender.com";

type LiveItem = {
  _id: string;
  title: string;
  user: { name: string; avatar?: string };
  viewerCount?: number;
};

function NavbarLiveButton() {
  const router = useRouter();
  const [lives,   setLives]   = useState<LiveItem[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;

        const res = await fetch(`${BACKEND}/api/live/active`, {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
        });

        const data = await res.json();
        setLives(Array.isArray(data) ? data : []);
      } catch {}
      finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const goLive = (id: string) => {
    setOpen(false);
    router.push(`/live/${id}`);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 20,
          border: lives.length > 0 ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.1)",
          background: lives.length > 0 ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)",
          color: lives.length > 0 ? "#f87171" : "rgba(255,255,255,0.5)",
          fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
        }}
      >
        <Radio size={15} style={{ animation: lives.length > 0 ? "nav-blink 1.4s ease-in-out infinite" : "none" }} />
        En vivo
        {lives.length > 0 && (
          <span style={{
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "1px 5px", lineHeight: 1.5,
          }}>
            {lives.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          minWidth: 240, background: "#1a1a2e",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
          overflow: "hidden", zIndex: 1000, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {loading && (
            <p style={{ padding: "14px 16px", fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>
              Buscando vivos…
            </p>
          )}
          {!loading && lives.length === 0 && (
            <p style={{ padding: "14px 16px", fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0 }}>
              No hay vivos activos ahora
            </p>
          )}
          {lives.map((live) => (
            <button
              key={live._id}
              onClick={() => goLive(live._id)}
              style={{
                width: "100%", padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 10,
                border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "transparent", color: "#e2e8f0",
                cursor: "pointer", textAlign: "left", transition: "background 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "#ef4444", flexShrink: 0,
                animation: "nav-blink 1.4s ease-in-out infinite",
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e2e8f0",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {live.title}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  {live.user?.name}
                  {live.viewerCount != null && ` · ${live.viewerCount} espectadores`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes nav-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ─── Navbar principal ────────────────────────────────────────────────────────

export default function Navbar() {
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push("/");
    setDropdownOpen(false);
    setMenuOpen(false);
  };

  const navigate = (href: string) => {
    router.push(href);
    setMenuOpen(false);
    setDropdownOpen(false);
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-logo" onClick={() => navigate("/")}>
          <img src="/images/preview.png" alt="TalentStream logo" className="nav-logo-img" />
          <span className="nav-brand">TalentStreaming</span>
        </div>

        <div className="nav-links">
          {links.map((l) => (
            <button
              key={l.label}
              className={`nav-link ${pathname === l.href ? "active" : ""}`}
              onClick={() => navigate(l.href)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="nav-cta">
          {user ? (
            <>
              <NavbarLiveButton />

              <button className="btn-go-live" onClick={() => navigate("/lives")}>
                <span className="btn-go-live-dot" />
                Iniciar vivo
              </button>

              <button className="btn-upload" onClick={() => navigate("/upload")}>
                <Upload size={13} />
                Subir talento
              </button>

              <div className="nav-user-wrapper">
                <button className="nav-user-btn" onClick={() => setDropdownOpen((o) => !o)}>
                  <div className="nav-avatar">{user.name?.charAt(0).toUpperCase()}</div>
                  <span className="nav-username">{user.name}</span>
                  <ChevronDown size={14} className={`nav-chevron ${dropdownOpen ? "open" : ""}`} />
                </button>

                {dropdownOpen && (
                  <div className="nav-dropdown">
                    <div className="nav-dropdown-info">
                      <span className="nav-dropdown-name">{user.name}</span>
                      <span className="nav-dropdown-email">{user.email}</span>
                    </div>
                    <div className="nav-dropdown-divider" />
                    <button className="nav-dropdown-item" onClick={() => navigate(`/profile/${user.id}`)}>
                      <User size={13} />
                      Mi perfil
                    </button>
                    <button className="nav-dropdown-item danger" onClick={handleLogout}>
                      <LogOut size={13} />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => navigate("/login")}>Iniciar sesión</button>
              <button className="btn-upload" onClick={() => navigate("/login")}>
                <Upload size={13} />
                Subir talento
              </button>
            </>
          )}
        </div>

        <button
          className={`nav-hamburger ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menú"
        >
          <span /><span /><span />
        </button>
      </nav>

      <div className={`nav-mobile-menu ${menuOpen ? "open" : ""}`}>
        {user && (
          <div className="nav-mobile-user">
            <div className="nav-avatar large">{user.name?.charAt(0).toUpperCase()}</div>
            <div>
              <p className="nav-mobile-name">{user.name}</p>
              <p className="nav-mobile-email">{user.email}</p>
            </div>
          </div>
        )}

        {links.map((l) => (
          <button
            key={l.label}
            className={`nav-mobile-link ${pathname === l.href ? "active" : ""}`}
            onClick={() => navigate(l.href)}
          >
            {l.label}
          </button>
        ))}

        {user && (
          <button className="nav-mobile-link" onClick={() => navigate(`/profile/${user.id}`)}>
            Mi perfil
          </button>
        )}

        <div className="nav-mobile-cta">
          {user ? (
            <>
              <NavbarLiveButton />

              <button className="btn-go-live" onClick={() => navigate("/lives")}>
                <span className="btn-go-live-dot" />
                Iniciar vivo
              </button>

              <button className="btn-upload" onClick={() => navigate("/upload")}>
                <Upload size={13} />
                Subir talento
              </button>
              <button className="btn-ghost danger" onClick={handleLogout}>
                <LogOut size={13} />
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => navigate("/login")}>Iniciar sesión</button>
              <button className="btn-upload" onClick={() => navigate("/login")}>
                <Upload size={13} />
                Subir talento
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .btn-go-live {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 16px;
          border-radius: 20px;
          border: 1px solid rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.15);
          color: #f87171;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
          letter-spacing: -0.1px;
        }
        .btn-go-live:hover {
          background: rgba(239,68,68,0.25);
          border-color: rgba(239,68,68,0.7);
          color: #fca5a5;
        }
        .btn-go-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ef4444;
          animation: go-live-blink 1.4s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes go-live-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
