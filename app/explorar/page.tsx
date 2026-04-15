// app/explorar/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, Play, Heart, Eye, Share2,
  Music, Mic, Laugh, Sparkles, Star,
  LayoutGrid, Palette, TrendingUp, Clock, Flame, SlidersHorizontal, ExternalLink,
} from "lucide-react";
import "../styles/explorar.css";

const API  = "https://stream-72mw.onrender.com/api";
const BACK = "https://stream-72mw.onrender.com";

// Resolve relative paths → full backend URL
function imgUrl(path?: string | null): string {
  if (!path) return "/images/preview.png";
  if (path.startsWith("http")) return path;
  return `${BACK}${path}`;
}

const categories = [
  { label: "Todo",          icon: <LayoutGrid size={14} /> },
  { label: "Canto",         icon: <Mic        size={14} /> },
  { label: "Baile",         icon: <Star       size={14} /> },
  { label: "El humor",      icon: <Laugh      size={14} /> },
  { label: "Música",        icon: <Music      size={14} /> },
  { label: "Arte",          icon: <Palette    size={14} /> },
  { label: "Talento Libre", icon: <Sparkles   size={14} /> },
];

const sortOptions = [
  { value: "trending", label: "Tendencias", icon: <Flame      size={12} /> },
  { value: "nuevo",    label: "Nuevos",     icon: <Clock      size={12} /> },
  { value: "popular",  label: "Populares",  icon: <TrendingUp size={12} /> },
];

const AVATAR_COLORS = ["purple", "pink", "amber", "blue", "green", "coral"];

interface Post {
  _id: string;
  title: string;
  description: string;
  url: string;
  thumbnail: string;
  category: string;
  likes: string[];
  views: number;
  createdAt: string;
  user: { _id: string; name: string; username?: string; avatar?: string };
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function VideoCard({
  post,
  colorIndex,
  onPlay,
  onShare,
}: {
  post: Post;
  colorIndex: number;
  onPlay: (post: Post) => void;
  onShare: (post: Post) => void;
}) {
  const router   = useRouter();
  const color    = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initials = post.user?.name?.slice(0, 2).toUpperCase() ?? "??";
  const isNew    = Date.now() - new Date(post.createdAt).getTime() < 48 * 3600 * 1000;

  const goToProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.user?._id) router.push(`/profile/${post.user._id}`);
  };

  return (
    <div className="ex-card">
      {/* ── Thumbnail ── */}
      <div className={`ex-thumb ${color}`} onClick={() => onPlay(post)}>
        <img
          src={imgUrl(post.thumbnail)}
          alt={post.title}
          onError={(e) => { (e.target as HTMLImageElement).src = "/images/preview.png"; }}
        />
        <div className="ex-play">
          <Play size={20} fill="white" color="white" />
        </div>
        {isNew && (
          <span className="ex-badge-new">
            <span className="ex-dot" /> NUEVO
          </span>
        )}
        {post.views > 0 && (
          <span className="ex-viewers">
            <Eye size={11} /> {fmt(post.views)}
          </span>
        )}
        <button
          className="ex-share-icon"
          onClick={(e) => { e.stopPropagation(); onShare(post); }}
        >
          <Share2 size={14} />
        </button>
      </div>

      <div className="ex-body">
        {/* ── Clickable user row ── */}
        <div
          className="ex-user ex-user-link"
          onClick={goToProfile}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && goToProfile(e as any)}
          title={`Ver perfil de ${post.user?.name}`}
        >
          {/* Avatar with ring on hover */}
          <div className="ex-avatar-wrap">
            {post.user?.avatar ? (
              <img
                src={imgUrl(post.user.avatar)}
                alt={post.user.name}
                className={`ex-avatar ex-avatar-img avatar-${color}`}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className={`ex-avatar avatar-${color}`}>{initials}</div>
            )}
            {/* Small "visit" indicator that appears on hover */}
            <span className="ex-avatar-goto">
              <ExternalLink size={9} />
            </span>
          </div>

          <div className="ex-user-info">
            <div className="ex-name">
              {post.user?.name ?? "Usuario"}
            </div>
            {post.user?.username ? (
              <div className="ex-cat ex-username">@{post.user.username}</div>
            ) : (
              <div className="ex-cat">{post.category}</div>
            )}
          </div>
        </div>

        <div className="ex-title">{post.title}</div>
        {post.description && <div className="ex-desc">{post.description}</div>}

        <div className="ex-stats">
          <span><Heart size={12} /> {fmt(post.likes?.length ?? 0)}</span>
          <span><Eye   size={12} /> {fmt(post.views)}</span>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <>
      {[1,2,3,4,5,6].map((i) => (
        <div key={i} className="ex-card ex-skeleton">
          <div className="ex-thumb-skel" />
          <div className="ex-body">
            <div className="ex-skel-line wide" />
            <div className="ex-skel-line" />
            <div className="ex-skel-line narrow" />
          </div>
        </div>
      ))}
    </>
  );
}

export default function ExplorarPage() {
  const router = useRouter();

  const [query,          setQuery]          = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todo");
  const [activeSort,     setActiveSort]     = useState("trending");
  const [posts,          setPosts]          = useState<Post[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);
  const [activeVideo,    setActiveVideo]    = useState<Post | null>(null);
  const [showFilters,    setShowFilters]    = useState(false);
  const [shareToast,     setShareToast]     = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPosts = useCallback(async (cat: string, sort: string, q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, page: String(p), limit: "12" });
      if (cat !== "Todo") params.set("category", cat);
      if (q.trim())       params.set("search", q.trim());

      const res  = await fetch(`${API}/feed?${params}`);
      const data = await res.json();

      if (p === 1) {
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      } else {
        setPosts((prev) => [...prev, ...(Array.isArray(data.posts) ? data.posts : [])]);
      }
      setTotalPages(data.pages ?? 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchPosts(activeCategory, activeSort, debouncedQuery, 1);
  }, [activeCategory, activeSort, debouncedQuery]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(activeCategory, activeSort, debouncedQuery, next);
  };

  const handlePlay = (post: Post) => {
    fetch(`${API}/feed/view/${post._id}`, { method: "POST" }).catch(() => {});
    setActiveVideo(post);
  };

  const handleShare = async (post: Post) => {
    const shareUrl = `${BACK}/api/share/${post._id}`;
    if (navigator.share) {
      await navigator.share({ title: post.title, text: post.description, url: shareUrl });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };

  return (
    <div className="ex-wrapper">

      {/* Header */}
      <div className="ex-header">
        <h1 className="ex-heading">
          <Search size={22} /> Explorar
        </h1>
        <div className="ex-search-row">
          <div className="ex-search-box">
            <Search size={16} className="ex-search-ico" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar videos, artistas, categorías…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ex-search-input"
            />
            {query && (
              <button className="ex-clear" onClick={clearSearch}>
                <X size={15} />
              </button>
            )}
          </div>
          <button
            className={`ex-filter-btn ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal size={15} /> Filtros
          </button>
        </div>
      </div>

      {/* Categorías */}
      <div className="ex-categories">
        {categories.map((cat) => (
          <button
            key={cat.label}
            className={`ex-cat-btn ${activeCategory === cat.label ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.label)}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className={`ex-sort ${showFilters ? "visible" : ""}`}>
        <span className="ex-sort-label">Ordenar por</span>
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            className={`ex-sort-btn ${activeSort === opt.value ? "active" : ""}`}
            onClick={() => setActiveSort(opt.value)}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {!loading && debouncedQuery && (
        <div className="ex-results-info">
          {posts.length > 0
            ? `${posts.length} resultado${posts.length !== 1 ? "s" : ""} para "${debouncedQuery}"`
            : `Sin resultados para "${debouncedQuery}"`}
        </div>
      )}

      {/* Grid */}
      <div className="ex-grid">
        {loading && page === 1 ? (
          <Skeleton />
        ) : posts.length === 0 ? (
          <div className="ex-empty">
            <Sparkles size={36} style={{ opacity: 0.3 }} />
            <p>{debouncedQuery ? "No encontramos nada con esa búsqueda." : "No hay videos en esta categoría."}</p>
            {debouncedQuery && (
              <button className="ex-empty-btn" onClick={clearSearch}>Limpiar búsqueda</button>
            )}
          </div>
        ) : (
          posts.map((post, i) => (
            <VideoCard
              key={post._id}
              post={post}
              colorIndex={i}
              onPlay={handlePlay}
              onShare={handleShare}
            />
          ))
        )}
      </div>

      {!loading && page < totalPages && (
        <div className="ex-load-more">
          <button className="ex-load-btn" onClick={loadMore}>Ver más videos</button>
        </div>
      )}
      {loading && page > 1 && (
        <div className="ex-load-more">
          <span className="ex-loading-txt">Cargando…</span>
        </div>
      )}

      {/* Video modal */}
      {activeVideo && (
        <div className="ex-modal" onClick={() => setActiveVideo(null)}>
          <div className="ex-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ex-modal-header">
              <div>
                <div className="ex-modal-title">{activeVideo.title}</div>
                <div className="ex-modal-user">{activeVideo.user?.name}</div>
              </div>
              <div className="ex-modal-actions">
                <button className="ex-modal-share" onClick={() => handleShare(activeVideo)}>
                  <Share2 size={15} /> Compartir
                </button>
                <button className="ex-modal-close" onClick={() => setActiveVideo(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="ex-modal-video">
              <video src={activeVideo.url} controls autoPlay poster={imgUrl(activeVideo.thumbnail)} />
            </div>
            {activeVideo.description && (
              <p className="ex-modal-desc">{activeVideo.description}</p>
            )}
            <div className="ex-modal-stats">
              <span><Heart size={13} /> {fmt(activeVideo.likes?.length ?? 0)}</span>
              <span><Eye   size={13} /> {fmt(activeVideo.views)}</span>
              <span className="ex-modal-cat">{activeVideo.category}</span>
            </div>
          </div>
        </div>
      )}

      {shareToast && <div className="ex-toast">Link copiado al portapapeles ✓</div>}
    </div>
  );
}