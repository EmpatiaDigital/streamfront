// app/context/AuthContext.tsx
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
        // Map _id → id so the rest of the app always uses user.id
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

// ─── Utility: normalize MongoDB _id → id ───
// Call this whenever you receive a user object from the API
// so the whole app can safely use user.id everywhere.
export function normalizeUser(raw: any): User {
  return {
    ...raw,
    id: raw.id ?? raw._id,
  };
}