
"use client";
import { createContext, useEffect, useState, ReactNode } from "react";
import { AuthContextType, User } from "../types/auth";

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchMe = async () => {
      try {
        const res = await fetch("https://stream-72mw.onrender.com/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          localStorage.removeItem("token");
          return;
        }
        const data = await res.json();

        // 🔍 DEBUG — borrá esta línea una vez que confirmes que el avatar llega
        console.log("🔍 RAW USER from /me:", JSON.stringify(data.user, null, 2));

        setUser(normalizeUser(data.user));
      } catch {
        localStorage.removeItem("token");
      }
    };

    fetchMe();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Utility: normalize MongoDB _id → id ─────────────────────────────────────
export function normalizeUser(raw: any): User {
  // El campo avatar puede venir como "avatar", "avatarUrl", "profileImage", etc.
  // Mapeamos explícitamente todos los candidatos para no perder ninguno.
  const avatar =
    raw.avatar       ||
    raw.avatarUrl    ||
    raw.profileImage ||
    raw.photo        ||
    undefined;

  return {
    ...raw,
    id:     raw.id     ?? raw._id,
    name:   raw.name?.trim() || raw.username?.trim() || "Sin nombre",
    avatar, // ← mapeo explícito, sobreescribe el ...raw si vino con otro nombre
  };
}
