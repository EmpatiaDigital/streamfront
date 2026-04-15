// app/hooks/useAuth.ts
"use client";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { AuthContextType } from "../types/auth";

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};