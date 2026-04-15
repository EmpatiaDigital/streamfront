"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, Eye, Share2, User } from "lucide-react";
import "./player.css";

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

const BACK = "https://stream-72mw.onrender.com";

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function VideoPlayer({ post }: { post: Post | null }) {
  const router = useRouter();

  if (!post) {
    return (
      <div className="vp-notfound">
        <p>Video no encontrado.</p>
        <button onClick={() => router.push("/")}>Volver al inicio</button>
      </div>
    );
  }

  const shareUrl = `${BACK}/api/share/${post._id}`;

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: post.title,
        text:  post.description,
        url:   shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert("¡Link copiado!");
    }
  };

  return (
    <div className="vp-wrapper">
      <button className="vp-back" onClick={() => router.back()}>
        <ArrowLeft size={18} /> Volver
      </button>

      <div className="vp-video-wrap">
        <video src={post.url} controls autoPlay poster={post.thumbnail} />
      </div>

      <div className="vp-info">
        <span className="vp-category">{post.category}</span>
        <h1 className="vp-title">{post.title}</h1>
        {post.description && <p className="vp-desc">{post.description}</p>}

        <div className="vp-meta">
          <div className="vp-user">
            {post.user?.avatar ? (
              <img src={post.user.avatar} alt={post.user.name} className="vp-avatar" />
            ) : (
              <div className="vp-avatar vp-avatar-fallback">
                <User size={16} />
              </div>
            )}
            <span>{post.user?.name ?? "Usuario"}</span>
          </div>

          <div className="vp-stats">
            <span><Heart size={14} /> {fmt(post.likes?.length ?? 0)}</span>
            <span><Eye   size={14} /> {fmt(post.views)}</span>
          </div>

          <button className="vp-share-btn" onClick={handleShare}>
            <Share2 size={15} /> Compartir
          </button>
        </div>
      </div>
    </div>
  );
}