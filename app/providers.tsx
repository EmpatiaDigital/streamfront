"use client";

import { AuthProvider } from "./context/AuthContext";

type Props = {
  children: React.ReactNode;
};

export default function Providers({ children }: Props) {
  return <AuthProvider>{children}</AuthProvider>;
}