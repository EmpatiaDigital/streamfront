// app/ver/[id]/page.tsx
import type { Metadata } from "next";
import VideoPlayer from "./VideoPlayer";

const API  = "https://stream-72mw.onrender.com/api";
const BACK =  "https://stream-72mw.onrender.com";

async function getPost(id: string) {
  try {
    const res = await fetch(`${API}/share/post/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.post ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const post = await getPost(params.id);
  if (!post) return { title: "Video no encontrado" };

  return {
    title:       post.title || "Video",
    description: post.description || `Video de ${post.user?.name}`,
    openGraph: {
      title:       post.title,
      description: post.description,
      images:      [{ url: post.thumbnail || "/images/preview.png", width: 1280, height: 720 }],
      type:        "video.other",
    },
    twitter: {
      card:        "summary_large_image",
      title:       post.title,
      description: post.description,
      images:      [post.thumbnail || "/images/preview.png"],
    },
  };
}

export default async function VerPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);
  return <VideoPlayer post={post} />;
}