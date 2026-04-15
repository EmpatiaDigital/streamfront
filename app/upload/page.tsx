// app/upload/page.tsx
"use client";
import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Video, Image, Calendar, Trash2, Edit2,
  Heart, X, Save, CheckCircle, AlertCircle, Play,
  Film, Eye, Plus, Tag, MapPin, Clock, DollarSign,
  Users, Link, Camera,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import "../styles/upload.css";

const API = "https://stream-72mw.onrender.com/api";

const VIDEO_CATEGORIES = [
  "Talento Libre", "Canto", "Baile", "El humor", "Música", "Arte",
];
const PHOTO_CATEGORIES = [
  "Fotografía", "Ilustración", "Pintura", "Diseño", "Escultura", "Otro",
];

type PostType = "video" | "photo" | "show";
type FilterTab = "all" | PostType;

interface ShowLocation { venue: string; address: string; city: string; province: string; }
interface Post {
  _id: string;
  type: PostType;
  title: string;
  description: string;
  url: string;
  thumbnail: string;
  likes: string[];
  category?: string;
  createdAt: string;
  // show fields
  eventDate?: string;
  location?: ShowLocation;
  ticketPrice?: number;
  currency?: string;
  isFree?: boolean;
  capacity?: number;
  ticketUrl?: string;
}

interface Toast { id: number; message: string; type: "success" | "error"; }

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* ─── TOAST ─── */
function ToastList({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="upload-toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`upload-toast ${t.type}`}>
          <span className={`upload-toast-icon ${t.type}`}>
            {t.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          </span>
          {t.message}
          <button onClick={() => remove(t.id)} style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.5 }}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── SKELETON ─── */
function Skeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="upload-skeleton" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="skeleton-thumb" />
          <div className="skeleton-lines">
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        </div>
      ))}
    </>
  );
}

/* ══════════════════════════════════════════════ */
export default function UploadPage() {
  const { user } = useContext(AuthContext)!;
  const router = useRouter();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  /* ── tipo seleccionado ── */
  const [type, setType] = useState<PostType>("video");

  /* ── campos comunes ── */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");

  /* ── VIDEO ── */
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [videoCategory, setVideoCategory] = useState("Talento Libre");

  /* ── PHOTO ── */
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoCategory, setPhotoCategory] = useState("Fotografía");

  /* ── SHOW ── */
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [ticketPrice, setTicketPrice] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [capacity, setCapacity] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");

  /* ── lista ── */
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [stats, setStats] = useState({ total: 0, videos: 0, likes: 0 });

  /* ── edición ── */
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("Talento Libre");
  const [editThumb, setEditThumb] = useState<File | null>(null);
  const [editThumbPrev, setEditThumbPrev] = useState("");
  // show edit
  const [editEventDate, setEditEventDate] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [editIsFree, setEditIsFree] = useState(false);
  const [editTicketPrice, setEditTicketPrice] = useState("");
  const [editCurrency, setEditCurrency] = useState("ARS");
  const [editCapacity, setEditCapacity] = useState("");
  const [editTicketUrl, setEditTicketUrl] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── toasts ── */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const addToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const removeToast = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  useEffect(() => { if (user === null) router.push("/login"); }, [user]);

  /* ── reset al cambiar tipo ── */
  const resetUploadForm = () => {
    setTitle(""); setDescription("");
    setThumbFile(null); setThumbPreview("");
    setVideoFile(null); setVideoUrl("");
    setPhotoFiles([]); setPhotoPreviews([]);
    setVideoCategory("Talento Libre"); setPhotoCategory("Fotografía");
    setEventDate(""); setVenue(""); setAddress(""); setCity(""); setProvince("");
    setIsFree(false); setTicketPrice(""); setCurrency("ARS"); setCapacity(""); setTicketUrl("");
    setProgress(0);
  };
  const handleTypeChange = (t: PostType) => { setType(t); resetUploadForm(); };

  /* ── cargar posts ── */
  const fetchPosts = useCallback(async () => {
    if (!token) return;
    setLoadingPosts(true);
    try {
      const url = filter === "all" ? `${API}/upload/my` : `${API}/upload/my?type=${filter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const list: Post[] = Array.isArray(data.posts) ? data.posts : [];
      setPosts(list);
      setStats({ total: data.total ?? list.length, videos: list.filter((p) => p.type === "video").length, likes: list.reduce((a, p) => a + (p.likes?.length ?? 0), 0) });
    } catch { addToast("Error al cargar tus posts", "error"); }
    finally { setLoadingPosts(false); }
  }, [token, filter]);
  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  /* ── drag & drop video ── */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("video/")) selectVideo(file);
  };
  const selectVideo = (file: File) => {
    setVideoFile(file); setVideoUrl(URL.createObjectURL(file));
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
  };

  /* ── selección de fotos ── */
  const handlePhotoSelect = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 10);
    setPhotoFiles(arr);
    setPhotoPreviews(arr.map((f) => URL.createObjectURL(f)));
    if (!title && arr[0]) setTitle(arr[0].name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
  };
  const removePhoto = (i: number) => {
    setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  /* ─────────────────────────────────────── SUBMIT ─── */
  const handleSubmit = async () => {
    if (!title.trim()) return;

    // Validaciones por tipo
    if (type === "video" && !videoFile) return;
    if (type === "photo" && photoFiles.length === 0) return;
    if (type === "show" && (!eventDate || !venue)) return;

    setUploading(true); setProgress(0); setProgressMsg("Preparando archivos…");

    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("description", description.trim());
      form.append("type", type);

      if (type === "video") {
        form.append("video", videoFile!);
        form.append("category", videoCategory);
        if (thumbFile) form.append("thumbnail", thumbFile);
      }

      if (type === "photo") {
        // primera foto como thumbnail principal
        form.append("thumbnail", photoFiles[0]);
        // fotos extra
        photoFiles.slice(1).forEach((f) => form.append("images", f));
        form.append("category", photoCategory);
      }

      if (type === "show") {
        form.append("eventDate", eventDate);
        form.append("venue", venue);
        form.append("address", address);
        form.append("city", city);
        form.append("province", province);
        form.append("isFree", String(isFree));
        form.append("ticketPrice", isFree ? "0" : ticketPrice || "0");
        form.append("currency", currency);
        if (capacity) form.append("capacity", capacity);
        if (ticketUrl) form.append("ticketUrl", ticketUrl);
        if (thumbFile) form.append("thumbnail", thumbFile);
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API}/upload`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
            setProgressMsg(pct < 100 ? `Subiendo… ${formatSize(e.loaded)} de ${formatSize(e.total)}` : "Procesando…");
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText)));
        xhr.onerror = () => reject(new Error("Error de red"));
        xhr.send(form);
      });

      resetUploadForm();
      const labels: Record<PostType, string> = { video: "¡Video publicado! 🎬", photo: "¡Foto publicada! 📷", show: "¡Show publicado! 🎭" };
      addToast(labels[type]);
      fetchPosts();
    } catch (err: any) {
      addToast(err.message || "Error al subir", "error");
    } finally {
      setUploading(false);
    }
  };

  /* ── eliminar ── */
  const handleDelete = async (postId: string) => {
    if (!confirm("¿Eliminar este post? También se borrará de Cloudinary.")) return;
    try {
      const res = await fetch(`${API}/upload/${postId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      addToast("Post eliminado");
    } catch { addToast("Error al eliminar", "error"); }
  };

  /* ── abrir edición ── */
  const openEdit = (post: Post) => {
    setEditPost(post);
    setEditTitle(post.title);
    setEditDesc(post.description);
    setEditCategory(post.category ?? "Talento Libre");
    setEditThumb(null); setEditThumbPrev(post.thumbnail);
    if (post.type === "show") {
      setEditEventDate(post.eventDate ? new Date(post.eventDate).toISOString().slice(0, 16) : "");
      setEditVenue(post.location?.venue ?? "");
      setEditAddress(post.location?.address ?? "");
      setEditCity(post.location?.city ?? "");
      setEditProvince(post.location?.province ?? "");
      setEditIsFree(post.isFree ?? false);
      setEditTicketPrice(String(post.ticketPrice ?? ""));
      setEditCurrency(post.currency ?? "ARS");
      setEditCapacity(String(post.capacity ?? ""));
      setEditTicketUrl(post.ticketUrl ?? "");
    }
  };

  /* ── guardar edición ── */
  const handleSaveEdit = async () => {
    if (!editPost) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("title", editTitle);
      form.append("description", editDesc);
      if (editPost.type === "video") form.append("category", editCategory);
      if (editPost.type === "photo") form.append("category", editCategory);
      if (editPost.type === "show") {
        form.append("eventDate", editEventDate);
        form.append("venue", editVenue);
        form.append("address", editAddress);
        form.append("city", editCity);
        form.append("province", editProvince);
        form.append("isFree", String(editIsFree));
        form.append("ticketPrice", editIsFree ? "0" : editTicketPrice || "0");
        form.append("currency", editCurrency);
        if (editCapacity) form.append("capacity", editCapacity);
        form.append("ticketUrl", editTicketUrl);
      }
      if (editThumb) form.append("thumbnail", editThumb);

      const res = await fetch(`${API}/upload/${editPost._id}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPosts((prev) => prev.map((p) => p._id === editPost._id ? data.post : p));
      setEditPost(null);
      addToast("Post actualizado");
    } catch { addToast("Error al guardar", "error"); }
    finally { setSaving(false); }
  };

  /* ── validación del botón ── */
  const canSubmit = () => {
    if (!title.trim() || uploading) return false;
    if (type === "video") return !!videoFile;
    if (type === "photo") return photoFiles.length > 0;
    if (type === "show") return !!eventDate && !!venue;
    return false;
  };

  const TAB_ICONS: Record<FilterTab, React.ReactNode> = {
    all: <Film size={12} />, video: <Video size={12} />, photo: <Image size={12} />, show: <Calendar size={12} />,
  };

  if (!user) return null;

  /* ─────────────────── RENDER ─────────────────── */
  return (
    <div className="upload-page">

      {/* HERO */}
      <div className="upload-hero">
        <div className="upload-hero-inner">
          <div className="upload-hero-text">
            <h1>Subir talento</h1>
            <p>Compartí tus videos, fotos y shows con el mundo</p>
          </div>
          <div className="upload-hero-stats">
            <div className="upload-hero-stat"><span className="upload-hero-stat-num">{stats.total}</span><span className="upload-hero-stat-label">Posts</span></div>
            <div className="upload-hero-stat"><span className="upload-hero-stat-num">{stats.videos}</span><span className="upload-hero-stat-label">Videos</span></div>
            <div className="upload-hero-stat"><span className="upload-hero-stat-num">{stats.likes}</span><span className="upload-hero-stat-label">Likes</span></div>
          </div>
        </div>
      </div>

      <div className="upload-main">

        {/* ═══ PANEL SUBIDA ═══ */}
        <div className="upload-panel">

          {/* Selector de tipo */}
          <div className="upload-type-tabs">
            {([
              { t: "video" as PostType, icon: <Video size={14} />, label: "Video" },
              { t: "photo" as PostType, icon: <Camera size={14} />, label: "Foto" },
              { t: "show"  as PostType, icon: <Calendar size={14} />, label: "Show" },
            ]).map(({ t, icon, label }) => (
              <button
                key={t}
                className={`upload-type-tab ${type === t ? "active" : ""}`}
                onClick={() => handleTypeChange(t)}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* ── VIDEO: drop zone ── */}
          {type === "video" && (
            !videoFile ? (
              <div
                className={`drop-zone ${dragOver ? "drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) selectVideo(f); }} />
                <div className="drop-zone-icon"><Upload size={22} /></div>
                <p className="drop-zone-title">Arrastrá tu video acá</p>
                <p className="drop-zone-sub">o hacé clic para seleccionar</p>
                <span className="drop-zone-badge">MP4 · MOV · WebM · AVI — máx 200MB</span>
              </div>
            ) : (
              <div className="video-preview-wrap">
                <video src={videoUrl} controls />
                <button className="video-preview-remove" onClick={() => { setVideoFile(null); setVideoUrl(""); }}>
                  <X size={13} /> Cambiar video
                </button>
              </div>
            )
          )}

          {/* ── PHOTO: selector de imágenes ── */}
          {type === "photo" && (
            <div className="photo-upload-area">
              {photoPreviews.length === 0 ? (
                <label className="drop-zone photo-drop-zone">
                  <input type="file" accept="image/*" multiple onChange={(e) => handlePhotoSelect(e.target.files)} style={{ display: "none" }} />
                  <div className="drop-zone-icon"><Camera size={22} /></div>
                  <p className="drop-zone-title">Seleccioná tus fotos</p>
                  <p className="drop-zone-sub">hasta 10 imágenes · JPG, PNG, WebP</p>
                  <span className="drop-zone-badge">máx 10MB por imagen</span>
                </label>
              ) : (
                <div className="photo-grid">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className={`photo-grid-item ${i === 0 ? "main" : ""}`}>
                      <img src={src} alt={`foto ${i + 1}`} />
                      {i === 0 && <span className="photo-main-badge">Portada</span>}
                      <button className="photo-remove-btn" onClick={() => removePhoto(i)}><X size={11} /></button>
                    </div>
                  ))}
                  {photoPreviews.length < 10 && (
                    <label className="photo-add-more">
                      <input type="file" accept="image/*" multiple onChange={(e) => {
                        if (!e.target.files) return;
                        const extra = Array.from(e.target.files).slice(0, 10 - photoFiles.length);
                        setPhotoFiles((prev) => [...prev, ...extra]);
                        setPhotoPreviews((prev) => [...prev, ...extra.map((f) => URL.createObjectURL(f))]);
                      }} style={{ display: "none" }} />
                      <Plus size={18} />
                      <span>Agregar</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SHOW: info del evento ── */}
          {type === "show" && (
            <div className="show-info-banner">
              <Calendar size={16} />
              <span>Completá los datos del evento en el formulario</span>
            </div>
          )}

          {/* Progreso */}
          {uploading && (
            <div className="upload-progress">
              <div className="upload-progress-header">
                <span className="upload-progress-label"><Upload size={13} /> Subiendo</span>
                <span className="upload-progress-pct">{progress}%</span>
              </div>
              <div className="upload-progress-bar-bg">
                <div className="upload-progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="upload-progress-sub">{progressMsg}</p>
            </div>
          )}

          {/* ═══ FORMULARIO ═══ */}
          <div className="upload-form">
            <p className="upload-section-label" style={{ marginBottom: 0 }}>Información</p>

            {/* Categoría VIDEO */}
            {type === "video" && (
              <div className="upload-field">
                <label className="upload-label"><Tag size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Categoría</label>
                <select className="upload-select" value={videoCategory} onChange={(e) => setVideoCategory(e.target.value)}>
                  {VIDEO_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            )}

            {/* Categoría FOTO */}
            {type === "photo" && (
              <div className="upload-field">
                <label className="upload-label"><Tag size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Categoría</label>
                <select className="upload-select" value={photoCategory} onChange={(e) => setPhotoCategory(e.target.value)}>
                  {PHOTO_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            )}

            <div className="upload-field">
              <label className="upload-label">Título *</label>
              <input className="upload-input" placeholder="Dale un nombre a tu contenido" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
            </div>

            <div className="upload-field">
              <label className="upload-label">Descripción</label>
              <textarea className="upload-textarea" placeholder="Contá de qué se trata…" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            </div>

            {/* ─── CAMPOS EXTRA SHOW ─── */}
            {type === "show" && (
              <>
                <p className="upload-section-label" style={{ marginTop: 8, marginBottom: 0 }}>
                  <Calendar size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  Fecha y lugar
                </p>

                <div className="upload-field">
                  <label className="upload-label"><Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Fecha y hora del evento *</label>
                  <input className="upload-input" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                </div>

                <div className="upload-field">
                  <label className="upload-label"><MapPin size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Nombre del lugar *</label>
                  <input className="upload-input" placeholder="Ej: Teatro Municipal, Club Atlético…" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={100} />
                </div>

                <div className="upload-row-2">
                  <div className="upload-field">
                    <label className="upload-label">Ciudad</label>
                    <input className="upload-input" placeholder="Rosario" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
                  </div>
                  <div className="upload-field">
                    <label className="upload-label">Provincia</label>
                    <input className="upload-input" placeholder="Santa Fe" value={province} onChange={(e) => setProvince(e.target.value)} maxLength={60} />
                  </div>
                </div>

                <div className="upload-field">
                  <label className="upload-label">Dirección</label>
                  <input className="upload-input" placeholder="Calle y número" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={150} />
                </div>

                <p className="upload-section-label" style={{ marginTop: 8, marginBottom: 0 }}>
                  <DollarSign size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  Entradas
                </p>

                <div className="upload-field">
                  <label className="upload-label upload-toggle-label">
                    <span>Entrada gratuita</span>
                    <button
                      type="button"
                      className={`upload-toggle ${isFree ? "on" : ""}`}
                      onClick={() => setIsFree((v) => !v)}
                    >
                      <span className="upload-toggle-knob" />
                    </button>
                  </label>
                </div>

                {!isFree && (
                  <div className="upload-row-2">
                    <div className="upload-field">
                      <label className="upload-label"><DollarSign size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Precio</label>
                      <input className="upload-input" type="number" min="0" placeholder="0" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} />
                    </div>
                    <div className="upload-field">
                      <label className="upload-label">Moneda</label>
                      <select className="upload-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        <option value="ARS">ARS $</option>
                        <option value="USD">USD $</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="upload-row-2">
                  <div className="upload-field">
                    <label className="upload-label"><Users size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Capacidad máx.</label>
                    <input className="upload-input" type="number" min="1" placeholder="Sin límite" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
                  </div>
                  <div className="upload-field">
                    <label className="upload-label"><Link size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Link de tickets</label>
                    <input className="upload-input" type="url" placeholder="https://..." value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* Thumbnail — video y show */}
            {(type === "video" || type === "show") && (
              <div className="upload-field">
                <label className="upload-label">{type === "video" ? "Thumbnail (opcional)" : "Imagen del evento (opcional)"}</label>
                <div className="thumb-drop">
                  {thumbPreview && <img src={thumbPreview} alt="thumb" />}
                  {thumbPreview && <div className="thumb-drop-overlay"><Upload size={14} /> Cambiar</div>}
                  {!thumbPreview && <><Image size={15} /><span>Subir imagen de portada</span></>}
                  <input type="file" accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setThumbFile(f); setThumbPreview(URL.createObjectURL(f));
                  }} />
                </div>
              </div>
            )}

            <button className="upload-submit" onClick={handleSubmit} disabled={!canSubmit()}>
              {uploading
                ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Subiendo…</>
                : <><Upload size={15} /> {type === "video" ? "Publicar video" : type === "photo" ? "Publicar fotos" : "Publicar show"}</>
              }
            </button>
          </div>
        </div>

        {/* ═══ PANEL LISTA ═══ */}
        <div className="upload-list-panel">
          <p className="upload-section-label">Mis publicaciones</p>

          <div className="upload-filters">
            {(["all", "video", "photo", "show"] as FilterTab[]).map((f) => (
              <button key={f} className={`upload-filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {TAB_ICONS[f]}{" "}
                {f === "all" ? "Todo" : f === "video" ? "Videos" : f === "photo" ? "Fotos" : "Shows"}
              </button>
            ))}
          </div>

          <div className="upload-list">
            {loadingPosts ? <Skeleton /> : posts.length === 0 ? (
              <div className="upload-empty">
                <div className="upload-empty-icon"><Film size={36} /></div>
                <p>No tenés posts{filter !== "all" ? ` de tipo "${filter}"` : ""} todavía.</p>
              </div>
            ) : posts.map((post, i) => (
              <div key={post._id} className="upload-post-card" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="upload-post-thumb-row">
                  <img className="upload-post-thumb" src={post.thumbnail || "/images/preview.png"} alt={post.title} />
                  <div className="upload-post-info">
                    <p className="upload-post-title">{post.title}</p>
                    <div className="upload-post-meta">
                      <span className="upload-post-type">{post.type}</span>
                      {post.category && (
                        <span className="upload-post-type" style={{ background: "rgba(100,200,255,0.1)", color: "#64c8ff", borderColor: "rgba(100,200,255,0.2)" }}>
                          {post.category}
                        </span>
                      )}
                      {post.type === "show" && post.eventDate && (
                        <span className="upload-post-type" style={{ background: "rgba(255,180,100,0.1)", color: "#ffb464", borderColor: "rgba(255,180,100,0.2)" }}>
                          <Calendar size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                          {formatDate(post.eventDate)}
                        </span>
                      )}
                      {post.type === "show" && post.location?.city && (
                        <span className="upload-post-type" style={{ background: "rgba(150,255,150,0.08)", color: "#7ddd7d", borderColor: "rgba(150,255,150,0.2)" }}>
                          <MapPin size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                          {post.location.city}
                        </span>
                      )}
                      <span className="upload-post-likes"><Heart size={10} fill="#ffd764" color="#ffd764" />{post.likes?.length ?? 0}</span>
                      <span>{formatDate(post.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="upload-post-actions">
                  {post.url && (
                    <button className="upload-post-btn" onClick={() => window.open(post.url, "_blank")}>
                      <Eye size={12} /> Ver
                    </button>
                  )}
                  <button className="upload-post-btn" onClick={() => openEdit(post)}><Edit2 size={12} /> Editar</button>
                  <button className="upload-post-btn danger" onClick={() => handleDelete(post._id)}><Trash2 size={12} /> Borrar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ MODAL EDITAR ═══ */}
      {editPost && (
        <div className="edit-overlay" onClick={(e) => e.target === e.currentTarget && setEditPost(null)}>
          <div className="edit-modal">
            <div className="edit-modal-title">
              <span>Editar {editPost.type === "video" ? "video" : editPost.type === "photo" ? "foto" : "show"}</span>
              <button className="edit-modal-close" onClick={() => setEditPost(null)}><X size={18} /></button>
            </div>
            <div className="upload-form">
              <div className="upload-field">
                <label className="upload-label">Título</label>
                <input className="upload-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={100} />
              </div>

              {(editPost.type === "video" || editPost.type === "photo") && (
                <div className="upload-field">
                  <label className="upload-label"><Tag size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Categoría</label>
                  <select className="upload-select" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {(editPost.type === "video" ? VIDEO_CATEGORIES : PHOTO_CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="upload-field">
                <label className="upload-label">Descripción</label>
                <textarea className="upload-textarea" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={500} />
              </div>

              {/* Campos show en edición */}
              {editPost.type === "show" && (
                <>
                  <div className="upload-field">
                    <label className="upload-label"><Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Fecha y hora</label>
                    <input className="upload-input" type="datetime-local" value={editEventDate} onChange={(e) => setEditEventDate(e.target.value)} />
                  </div>
                  <div className="upload-field">
                    <label className="upload-label"><MapPin size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Nombre del lugar</label>
                    <input className="upload-input" value={editVenue} onChange={(e) => setEditVenue(e.target.value)} maxLength={100} />
                  </div>
                  <div className="upload-row-2">
                    <div className="upload-field">
                      <label className="upload-label">Ciudad</label>
                      <input className="upload-input" value={editCity} onChange={(e) => setEditCity(e.target.value)} maxLength={60} />
                    </div>
                    <div className="upload-field">
                      <label className="upload-label">Provincia</label>
                      <input className="upload-input" value={editProvince} onChange={(e) => setEditProvince(e.target.value)} maxLength={60} />
                    </div>
                  </div>
                  <div className="upload-field">
                    <label className="upload-label">Dirección</label>
                    <input className="upload-input" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} maxLength={150} />
                  </div>
                  <div className="upload-field">
                    <label className="upload-label upload-toggle-label">
                      <span>Entrada gratuita</span>
                      <button type="button" className={`upload-toggle ${editIsFree ? "on" : ""}`} onClick={() => setEditIsFree((v) => !v)}>
                        <span className="upload-toggle-knob" />
                      </button>
                    </label>
                  </div>
                  {!editIsFree && (
                    <div className="upload-row-2">
                      <div className="upload-field">
                        <label className="upload-label">Precio</label>
                        <input className="upload-input" type="number" min="0" value={editTicketPrice} onChange={(e) => setEditTicketPrice(e.target.value)} />
                      </div>
                      <div className="upload-field">
                        <label className="upload-label">Moneda</label>
                        <select className="upload-select" value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)}>
                          <option value="ARS">ARS $</option>
                          <option value="USD">USD $</option>
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="upload-row-2">
                    <div className="upload-field">
                      <label className="upload-label">Capacidad</label>
                      <input className="upload-input" type="number" min="1" value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} />
                    </div>
                    <div className="upload-field">
                      <label className="upload-label">Link tickets</label>
                      <input className="upload-input" type="url" value={editTicketUrl} onChange={(e) => setEditTicketUrl(e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              <div className="upload-field">
                <label className="upload-label">Nueva thumbnail (opcional)</label>
                <div className="thumb-drop">
                  {editThumbPrev && <img src={editThumbPrev} alt="thumb" />}
                  {editThumbPrev && <div className="thumb-drop-overlay"><Upload size={14} /> Cambiar</div>}
                  {!editThumbPrev && <><Image size={15} /><span>Cambiar imagen</span></>}
                  <input type="file" accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setEditThumb(f); setEditThumbPrev(URL.createObjectURL(f));
                  }} />
                </div>
              </div>

              <button className="upload-submit" onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}>
                {saving ? "Guardando…" : <><Save size={14} /> Guardar cambios</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastList toasts={toasts} remove={removeToast} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}