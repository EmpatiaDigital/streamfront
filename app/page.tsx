// app/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Heart, Eye, Music, Mic, Laugh,
  Sparkles, Star, LayoutGrid, Palette, TrendingUp, Clock, Flame,
} from "lucide-react";
import "./styles/home.css";
import HeroSlider from "./components/HeroSlider";

const API    = "https://stream-72mw.onrender.com/api";
const STATIC = "https://stream-72mw.onrender.com";

// Resolve relative paths from the DB to full backend URLs
function imgUrl(path?: string | null): string {
  if (!path) return "/images/preview.png";
  if (path.startsWith("http")) return path;
  return `${STATIC}${path}`;
}

const categories = [
  { label: "Todo",          icon: <LayoutGrid size={14} /> },
  { label: "Canto",         icon: <Mic size={14} /> },
  { label: "Baile",         icon: <Star size={14} /> },
  { label: "El humor",      icon: <Laugh size={14} /> },
  { label: "Música",        icon: <Music size={14} /> },
  { label: "Arte",          icon: <Palette size={14} /> },
  { label: "Talento Libre", icon: <Sparkles size={14} /> },
];

const sortOptions = [
  { value: "trending", label: "Tendencias", icon: <Flame size={12} /> },
  { value: "nuevo",    label: "Nuevos",     icon: <Clock size={12} /> },
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
  user: {
    _id: string;
    name: string;
    username?: string;
    avatar?: string;
  };
}

function VideoCard({
  post,
  colorIndex,
  onPlay,
}: {
  post: Post;
  colorIndex: number;
  onPlay: (url: string) => void;
}) {
  const router   = useRouter();
  const color    = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initials = post.user?.name?.slice(0, 2).toUpperCase() ?? "??";
  const isNew    = Date.now() - new Date(post.createdAt).getTime() < 48 * 3600 * 1000;

  // Navigate to the creator's profile (read-only for visitors)
  const goToProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.user?._id) router.push(`/profile/${post.user._id}`);
  };

  const handleView = () => {
    fetch(`${API}/feed/view/${post._id}`, { method: "POST" }).catch(() => {});
    onPlay(post.url);
  };

  return (
    <div className="card">
      <div className={`card-thumb ${color}`} onClick={handleView}>
        <img
          src={imgUrl(post.thumbnail)}
          alt={post.title}
          onError={(e) => { (e.target as HTMLImageElement).src = "/images/preview.png"; }}
        />
        <div className="play-btn">
          <Play size={20} fill="white" />
        </div>
        {isNew && (
          <span className="live-badge" style={{ background: "rgba(61,232,138,0.9)" }}>
            <span className="live-dot" style={{ background: "#fff" }} />
            NUEVO
          </span>
        )}
        {post.views > 0 && (
          <span className="viewers">
            <Eye size={11} />
            {post.views >= 1000 ? `${(post.views / 1000).toFixed(1)}k` : post.views}
          </span>
        )}
      </div>

      <div className="card-body">
        {/* ── Clickable user row → goes to /profile/:id ── */}
        <div
          className="card-user"
          onClick={goToProfile}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && goToProfile(e as any)}
          title={`Ver perfil de ${post.user?.name}`}
          style={{ cursor: "pointer" }}
        >
          {post.user?.avatar ? (
            <img
              src={imgUrl(post.user.avatar)}
              alt={post.user.name}
              className={`avatar avatar-img avatar-${color}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className={`avatar avatar-${color}`}>{initials}</div>
          )}

          <div>
            {/* Name — underline signals it's clickable */}
            <div
              className="card-name"
              style={{
                textDecoration: "underline",
                textUnderlineOffset: 3,
                textDecorationColor: "rgba(255,255,255,0.35)",
              }}
            >
              {post.user?.name ?? "Usuario"}
            </div>

            {/* Show @username if available, otherwise category */}
            {post.user?.username ? (
              <div className="card-cat" style={{ opacity: 0.55 }}>
                @{post.user.username}
              </div>
            ) : (
              <div className="card-cat">{post.category}</div>
            )}
          </div>
        </div>

        <div className="card-title">{post.title}</div>
        {post.description && <div className="card-desc">{post.description}</div>}

        <div className="card-stats">
          <span className="stat">
            <Heart size={12} />
            {(post.likes?.length ?? 0) >= 1000
              ? `${(post.likes.length / 1000).toFixed(1)}k`
              : post.likes?.length ?? 0}
          </span>
          <span className="stat">
            <Eye size={12} />
            {post.views >= 1000 ? `${(post.views / 1000).toFixed(1)}k` : post.views}
          </span>
        </div>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="card card-skeleton">
          <div className="card-thumb-skeleton" />
          <div className="card-body">
            <div className="skel-line wide" />
            <div className="skel-line" />
            <div className="skel-line narrow" />
          </div>
        </div>
      ))}
    </>
  );
}

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState("Todo");
  const [activeSort,     setActiveSort]     = useState("trending");
  const [activeVideo,    setActiveVideo]    = useState<string | null>(null);
  const [posts,          setPosts]          = useState<Post[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);

  const fetchFeed = useCallback(async (cat: string, sort: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, page: String(p), limit: "12" });
      if (cat !== "Todo") params.set("category", cat);

      const res  = await fetch(`${API}/feed?${params}`);
      const data = await res.json();

      if (p === 1) {
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      } else {
        setPosts((prev) => [...prev, ...(Array.isArray(data.posts) ? data.posts : [])]);
      }
      setTotalPages(data.pages ?? 1);
    } catch (err) {
      console.error("Error al cargar el feed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchFeed(activeCategory, activeSort, 1);
  }, [activeCategory, activeSort]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchFeed(activeCategory, activeSort, next);
  };

  return (
    <div className="home-wrapper">
      <HeroSlider />

      {/* Categorías */}
      <div className="categories">
        {categories.map((cat) => (
          <button
            key={cat.label}
            className={`cat-btn ${activeCategory === cat.label ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.label)}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="feed-sort">
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            className={`sort-btn ${activeSort === opt.value ? "active" : ""}`}
            onClick={() => setActiveSort(opt.value)}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="feed">
        {loading && page === 1 ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <div className="feed-empty">
            <Sparkles size={36} style={{ opacity: 0.3 }} />
            <p>No hay videos en esta categoría todavía.</p>
            <span>¡Sé el primero en subir!</span>
          </div>
        ) : (
          posts.map((post, i) => (
            <VideoCard
              key={post._id}
              post={post}
              colorIndex={i}
              onPlay={setActiveVideo}
            />
          ))
        )}
      </div>

      {!loading && page < totalPages && (
        <div className="feed-load-more">
          <button className="load-more-btn" onClick={loadMore}>Ver más videos</button>
        </div>
      )}
      {loading && page > 1 && (
        <div className="feed-load-more">
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Cargando…</span>
        </div>
      )}

      {/* Video modal */}
      {activeVideo && (
        <div className="video-modal" onClick={() => setActiveVideo(null)}>
          <div className="video-container" onClick={(e) => e.stopPropagation()}>
            <button className="video-modal-close" onClick={() => setActiveVideo(null)}>✕</button>
            <video
              src={activeVideo}
              controls
              autoPlay
              style={{ width: "100%", height: "100%", borderRadius: 12 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}