// app/profile/[id]/page.tsx
"use client";
import { useState, useEffect, useRef, useContext } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Heart, Bell, BellOff, Mail, Phone, Settings, X,
  Video, Image, Calendar, MapPin, Eye, EyeOff,
  Upload, Trash2, Save, Palette, User, Lock, AtSign, CheckCircle, AlertCircle
} from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import "../../styles/profile.css";
import "../../styles/theme1.css";
import "../../styles/theme2.css";
import "../../styles/theme3.css";
import "../../styles/theme4.css";
import "../../styles/mystyles.css";

const API    = "https://stream-72mw.onrender.com/api";
const STATIC = "https://stream-72mw.onrender.com";          // base for /uploads/ images
const FALLBACK_AVATAR = "/images/preview.png";
const FALLBACK_BANNER = "/images/preview.png";

// ─── Resolve image URL ───────────────────────────────────────────────────────
// Paths from the DB look like "/uploads/1234567890.jpg"
// We need to prepend the backend origin so the browser fetches from port 4000.
function imgUrl(path: string | undefined | null, fallback: string): string {
  if (!path || path === fallback) return fallback;
  if (path.startsWith("http"))   return path;   // already absolute (e.g. Cloudinary)
  return `${STATIC}${path}`;                    // "/uploads/x.jpg" → "https://stream-72mw.onrender.com/uploads/x.jpg"
}

const THEMES = [
  { id: "theme1",   label: "Neon",   cls: "t1" },
  { id: "theme2",   label: "Ocean",  cls: "t2" },
  { id: "theme3",   label: "Fire",   cls: "t3" },
  { id: "theme4",   label: "Forest", cls: "t4" },
  { id: "mystyles", label: "Custom", cls: "t5" },
];

const TABS = [
  { id: "videos", label: "Videos", icon: Video },
  { id: "photos", label: "Fotos",  icon: Image },
  { id: "shows",  label: "Shows",  icon: Calendar },
];

type Toast = { msg: string; ok: boolean } | null;

export default function ProfilePage() {
  const { id } = useParams();
  const { user: me } = useContext(AuthContext)!;
  const router = useRouter();

  const [profile, setProfile]     = useState<any>(null);
  const [posts, setPosts]         = useState<any[]>([]);
  const [tab, setTab]             = useState("videos");
  const [subscribed, setSubscribed] = useState(false);
  const [subCount, setSubCount]   = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("profile");
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<Toast>(null);

  // Settings form
  const [sName,         setSName]         = useState("");
  const [sUsername,     setSUsername]     = useState("");
  const [sBio,          setSBio]          = useState("");
  const [sPhone,        setSPhone]        = useState("");
  const [sWhatsapp,     setSWhatsapp]     = useState("");
  const [sContactEmail, setSContactEmail] = useState("");
  const [sLocation,     setSLocation]     = useState("");
  const [sTheme,        setSTheme]        = useState("theme1");
  const [sCustom,       setSCustom]       = useState({
    accent: "#a855f7", accent2: "#ec4899", bg: "#0d0d1a", text: "#ffffff",
  });
  const [sCurrPass, setSCurrPass] = useState("");
  const [sNewPass,  setSNewPass]  = useState("");
  const [showCurr,  setShowCurr] = useState(false);
  const [showNew,   setShowNew]  = useState(false);

  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [bannerFile,    setBannerFile]    = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(FALLBACK_AVATAR);
  const [bannerPreview, setBannerPreview] = useState(FALLBACK_BANNER);

  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const isOwner = me && profile && me.id === profile._id;
  const token   = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Populate settings form AND previews from a user object
  const syncFormFromProfile = (user: any) => {
    setSName(user.name ?? "");
    setSUsername(user.username ?? "");
    setSBio(user.bio ?? "");
    setSPhone(user.phone ?? "");
    setSWhatsapp(user.whatsapp ?? "");
    setSContactEmail(user.contactEmail ?? "");
    setSLocation(user.location ?? "");
    setSTheme(user.theme ?? "theme1");
    setSCustom(user.customStyles ?? {
      accent: "#a855f7", accent2: "#ec4899", bg: "#0d0d1a", text: "#ffffff",
    });
    // ✅ Resolve full URL — previews in the settings modal load correctly
    setAvatarPreview(imgUrl(user.avatar, FALLBACK_AVATAR));
    setBannerPreview(imgUrl(user.banner, FALLBACK_BANNER));
    setAvatarFile(null);
    setBannerFile(null);
  };

  // ─── Load profile ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    fetch(`${API}/profile/${id}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        const user        = data?.user ?? data;
        const fetchedPosts: any[] = Array.isArray(data?.posts) ? data.posts : [];

        if (!user || typeof user !== "object" || !user._id) {
          console.error("Respuesta inesperada:", data);
          return;
        }

        setProfile(user);
        setPosts(fetchedPosts);
        setSubCount(Array.isArray(user.subscribers) ? user.subscribers.length : 0);
        setSubscribed(
          Array.isArray(user.subscribers) ? user.subscribers.includes(me?.id) : false
        );
        syncFormFromProfile(user);
      })
      .catch((err) => console.error("Error al cargar perfil:", err));
  }, [id]);

  // ─── Subscribe / Unsubscribe ─────────────────────────────────────────────
  const handleSubscribe = async () => {
    if (!me) return router.push("/login");
    try {
      const res  = await fetch(`${API}/profile/${id}/subscribe`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSubscribed(data.subscribed);
      setSubCount(data.count);
    } catch (err) { console.error(err); }
  };

  // ─── Like / Unlike ───────────────────────────────────────────────────────
  const handleLike = async (postId: string) => {
    if (!me) return router.push("/login");
    try {
      const res  = await fetch(`${API}/profile/post/${postId}/like`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? {
                ...p,
                likes: data.liked
                  ? [...(p.likes ?? []), me.id]
                  : (p.likes ?? []).filter((l: string) => l !== me.id),
              }
            : p
        )
      );
    } catch (err) { console.error(err); }
  };

  // ─── Delete post ─────────────────────────────────────────────────────────
  const handleDelete = async (postId: string) => {
    try {
      await fetch(`${API}/profile/post/${postId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (err) { console.error(err); }
  };

  // ─── Save profile ────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append("name",         sName);
      form.append("username",     sUsername);
      form.append("bio",          sBio);
      form.append("phone",        sPhone);
      form.append("whatsapp",     sWhatsapp);
      form.append("contactEmail", sContactEmail);
      form.append("location",     sLocation);
      form.append("theme",        sTheme);
      form.append("customStyles", JSON.stringify(sCustom));
      if (avatarFile) form.append("avatar", avatarFile);
      if (bannerFile) form.append("banner", bannerFile);

      const res  = await fetch(`${API}/profile/update`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();

      if (!res.ok) { showToast(data.error ?? "Error al guardar", false); return; }

      if (data.user) {
        setProfile(data.user);
        syncFormFromProfile(data.user);  // ✅ previews update with correct backend URL
      }

      showToast("¡Perfil actualizado!", true);
      setSettingsOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Error de conexión", false);
    } finally {
      setSaving(false);
    }
  };

  // ─── Change password ─────────────────────────────────────────────────────
  const handleSavePassword = async () => {
    if (!sCurrPass || !sNewPass) return;
    setSaving(true);
    try {
      const res  = await fetch(`${API}/profile/password`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: sCurrPass, newPassword: sNewPass }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Error", false); return; }
      setSCurrPass(""); setSNewPass("");
      showToast("¡Contraseña actualizada!", true);
    } catch (err) {
      console.error(err);
      showToast("Error de conexión", false);
    } finally {
      setSaving(false);
    }
  };

  // ─── File picker ─────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);  // local preview before upload
    if (type === "avatar") { setAvatarFile(file); setAvatarPreview(blobUrl); }
    else                   { setBannerFile(file);  setBannerPreview(blobUrl); }
  };

  const filteredPosts = posts.filter(
    (p) => p.type === (tab === "shows" ? "show" : tab === "videos" ? "video" : "photo")
  );

  const liveTheme  = profile?.theme ?? "theme1";
  const liveCustom = profile?.customStyles ?? {};
  const customVars =
    liveTheme === "mystyles"
      ? ({
          "--my-accent":  liveCustom.accent  ?? "#a855f7",
          "--my-accent2": liveCustom.accent2 ?? "#ec4899",
          "--my-bg":      liveCustom.bg      ?? "#0d0d1a",
          "--my-text":    liveCustom.text    ?? "#ffffff",
        } as React.CSSProperties)
      : {};

  if (!profile)
    return <div style={{ background: "#0d0d1a", minHeight: "100vh" }} />;

  return (
    <div className={`profile-wrapper ${liveTheme}`} style={customVars}>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toast.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.ok ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
          color: toast.ok ? "#4ade80" : "#f87171",
          padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)",
        }}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* BANNER — resolved to full backend URL */}
      <img
        className="profile-banner"
        src={imgUrl(profile.banner, FALLBACK_BANNER)}
        alt="banner"
      />

      {/* HEADER */}
      <div className="profile-header">
        <div className="profile-avatar-row">
          {/* AVATAR — resolved to full backend URL */}
          <img
            className="profile-avatar"
            src={imgUrl(profile.avatar, FALLBACK_AVATAR)}
            alt="avatar"
          />
          <div className="profile-header-actions">
            {!isOwner && (
              <>
                <button
                  className={`btn-subscribe ${subscribed ? "subscribed" : ""}`}
                  onClick={handleSubscribe}
                >
                  {subscribed ? <BellOff size={14} /> : <Bell size={14} />}
                  {subscribed ? "Suscripto" : "Suscribirse"}
                </button>
                {profile.contactEmail && (
                  <a href={`mailto:${profile.contactEmail}`} className="btn-contact">
                    <Mail size={14} /> Email
                  </a>
                )}
                {profile.whatsapp && (
                  <a href={`https://wa.me/${profile.whatsapp}`}
                    target="_blank" rel="noreferrer" className="btn-contact">
                    <Phone size={14} /> WhatsApp
                  </a>
                )}
              </>
            )}
            {isOwner && (
              <button className="btn-settings" onClick={() => setSettingsOpen(true)}>
                <Settings size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="profile-info">
          <h1 className="profile-name">{profile.name}</h1>
          {profile.username && <p className="profile-username">@{profile.username}</p>}
          {profile.bio      && <p className="profile-bio">{profile.bio}</p>}

          <div className="profile-meta">
            {profile.location && (
              <span className="profile-meta-item"><MapPin size={13} />{profile.location}</span>
            )}
            {profile.contactEmail && (
              <span className="profile-meta-item"><Mail size={13} />{profile.contactEmail}</span>
            )}
            {profile.phone && (
              <span className="profile-meta-item"><Phone size={13} />{profile.phone}</span>
            )}
          </div>

          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-num">{subCount}</span>
              <span className="profile-stat-label">Suscriptores</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-num">{posts.length}</span>
              <span className="profile-stat-label">Posts</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-num">
                {posts.reduce((a, p) => a + (p.likes?.length ?? 0), 0)}
              </span>
              <span className="profile-stat-label">Likes</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="profile-tabs">
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button key={tid}
            className={`profile-tab ${tab === tid ? "active" : ""}`}
            onClick={() => setTab(tid)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="profile-content">
        {filteredPosts.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 40 }}>
            No hay contenido en esta sección.
          </p>
        ) : (
          <div className="profile-grid">
            {filteredPosts.map((post) => {
              const likes = Array.isArray(post.likes) ? post.likes : [];
              const liked = likes.includes(me?.id);
              return (
                <div key={post._id} className="profile-card">
                  {/* Post thumbnails also need the backend URL */}
                  <img
                    className="profile-card-thumb"
                    src={imgUrl(post.thumbnail, FALLBACK_AVATAR)}
                    alt={post.title}
                  />
                  <div className="profile-card-body">
                    <p className="profile-card-title">{post.title}</p>
                    {post.description && (
                      <p className="profile-card-desc">{post.description}</p>
                    )}
                    <div className="profile-card-actions">
                      <button
                        className={`btn-like ${liked ? "liked" : ""}`}
                        onClick={() => handleLike(post._id)}
                      >
                        <Heart size={13} fill={liked ? "#ef4444" : "none"} />
                        {likes.length}
                      </button>
                      {isOwner && (
                        <button className="btn-delete" onClick={() => handleDelete(post._id)}>
                          <Trash2 size={13} /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SETTINGS MODAL */}
      {settingsOpen && isOwner && (
        <div className="settings-overlay"
          onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}>
          <div className="settings-modal">
            <div className="settings-title">
              <span>Configuración</span>
              <button className="settings-close" onClick={() => setSettingsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Settings tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
              {[
                { id: "profile",  label: "Perfil",    icon: User },
                { id: "theme",    label: "Tema",      icon: Palette },
                { id: "security", label: "Seguridad", icon: Lock },
              ].map(({ id: sid, label, icon: Icon }) => (
                <button key={sid} onClick={() => setActiveSettingsTab(sid)} style={{
                  background: activeSettingsTab === sid ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${activeSettingsTab === sid ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.1)"}`,
                  color: activeSettingsTab === sid ? "#a855f7" : "rgba(255,255,255,0.6)",
                  padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {/* ── PROFILE TAB ── */}
            {activeSettingsTab === "profile" && (
              <>
                <div className="settings-section">
                  <p className="settings-section-title">Fotos</p>
                  <div className="settings-field">
                    <label className="settings-label">Avatar</label>
                    <div className="settings-upload-row">
                      <img className="settings-upload-preview" src={avatarPreview} alt="avatar" />
                      <button className="settings-upload-btn" onClick={() => avatarRef.current?.click()}>
                        <Upload size={13} /> Cambiar avatar
                      </button>
                      <input ref={avatarRef} type="file" accept="image/*" hidden
                        onChange={(e) => handleFileChange(e, "avatar")} />
                    </div>
                  </div>
                  <div className="settings-field">
                    <label className="settings-label">Banner</label>
                    <div className="settings-upload-row">
                      <img className="settings-upload-preview" src={bannerPreview} alt="banner"
                        style={{ borderRadius: 8, width: 80, height: 40 }} />
                      <button className="settings-upload-btn" onClick={() => bannerRef.current?.click()}>
                        <Upload size={13} /> Cambiar banner
                      </button>
                      <input ref={bannerRef} type="file" accept="image/*" hidden
                        onChange={(e) => handleFileChange(e, "banner")} />
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <p className="settings-section-title">Información</p>
                  <div className="settings-field">
                    <label className="settings-label">Nombre</label>
                    <input className="settings-input" value={sName}
                      onChange={(e) => setSName(e.target.value)} placeholder="Tu nombre" />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label">Usuario</label>
                    <div style={{ position: "relative" }}>
                      <AtSign size={13} style={{
                        position: "absolute", left: 12, top: "50%",
                        transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)",
                      }} />
                      <input className="settings-input" style={{ paddingLeft: 30 }}
                        value={sUsername} onChange={(e) => setSUsername(e.target.value)}
                        placeholder="username" />
                    </div>
                  </div>
                  <div className="settings-field">
                    <label className="settings-label">Bio</label>
                    <textarea className="settings-textarea" value={sBio}
                      onChange={(e) => setSBio(e.target.value)}
                      placeholder="Contá algo sobre vos..." />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label">Ubicación</label>
                    <input className="settings-input" value={sLocation}
                      onChange={(e) => setSLocation(e.target.value)} placeholder="Ciudad, País" />
                  </div>
                </div>

                <div className="settings-section">
                  <p className="settings-section-title">Contacto (opcional)</p>
                  <div className="settings-field">
                    <label className="settings-label">Email de contacto</label>
                    <input className="settings-input" value={sContactEmail}
                      onChange={(e) => setSContactEmail(e.target.value)}
                      placeholder="contacto@email.com" />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label">Teléfono</label>
                    <input className="settings-input" value={sPhone}
                      onChange={(e) => setSPhone(e.target.value)} placeholder="+54 9 11..." />
                  </div>
                  <div className="settings-field">
                    <label className="settings-label">WhatsApp</label>
                    <input className="settings-input" value={sWhatsapp}
                      onChange={(e) => setSWhatsapp(e.target.value)} placeholder="5491112345678" />
                  </div>
                </div>

                <button className="settings-save" onClick={handleSaveProfile} disabled={saving}>
                  <Save size={15} /> {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </>
            )}

            {/* ── THEME TAB ── */}
            {activeSettingsTab === "theme" && (
              <>
                <div className="settings-section">
                  <p className="settings-section-title">Tema</p>
                  <div className="theme-grid">
                    {THEMES.map((t) => (
                      <button key={t.id}
                        className={`theme-btn ${t.cls} ${sTheme === t.id ? "active" : ""}`}
                        onClick={() => setSTheme(t.id)}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                {sTheme === "mystyles" && (
                  <div className="settings-section">
                    <p className="settings-section-title">Colores personalizados</p>
                    <div className="color-row">
                      {[
                        { key: "accent",  label: "Acento principal"  },
                        { key: "accent2", label: "Acento secundario" },
                        { key: "bg",      label: "Fondo"             },
                        { key: "text",    label: "Texto"             },
                      ].map(({ key, label }) => (
                        <div key={key} className="color-field">
                          <label>{label}</label>
                          <input type="color" className="color-input"
                            value={(sCustom as any)[key]}
                            onChange={(e) =>
                              setSCustom((prev) => ({ ...prev, [key]: e.target.value }))
                            } />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button className="settings-save" onClick={handleSaveProfile} disabled={saving}>
                  <Save size={15} /> {saving ? "Guardando..." : "Guardar tema"}
                </button>
              </>
            )}

            {/* ── SECURITY TAB ── */}
            {activeSettingsTab === "security" && (
              <>
                <div className="settings-section">
                  <p className="settings-section-title">Cambiar contraseña</p>
                  <div className="settings-field">
                    <label className="settings-label">Contraseña actual</label>
                    <div className="settings-input-eye">
                      <input className="settings-input"
                        type={showCurr ? "text" : "password"}
                        value={sCurrPass} onChange={(e) => setSCurrPass(e.target.value)}
                        placeholder="••••••••" />
                      <button className="settings-eye-btn" onClick={() => setShowCurr((p) => !p)}>
                        {showCurr ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div className="settings-field">
                    <label className="settings-label">Nueva contraseña</label>
                    <div className="settings-input-eye">
                      <input className="settings-input"
                        type={showNew ? "text" : "password"}
                        value={sNewPass} onChange={(e) => setSNewPass(e.target.value)}
                        placeholder="••••••••" />
                      <button className="settings-eye-btn" onClick={() => setShowNew((p) => !p)}>
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
                <button className="settings-save" onClick={handleSavePassword} disabled={saving}>
                  <Save size={15} /> {saving ? "Guardando..." : "Actualizar contraseña"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}