// app/types/auth.ts

export type User = {
  id: string;
  name: string;
  email: string;

  // 🔐 ROLES (control del sistema)
  role: "normal" | "admin" | "superadmin";

  // 💎 PLANES (monetización)
  plan?: "free" | "pro" | "premium";

  // Estado
  isFrozen?: boolean;

  // Profile
  username?: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  phone?: string;
  whatsapp?: string;
  contactEmail?: string;
  location?: string;

  // Theme
  theme?: string;
  customStyles?: {
    accent?: string;
    accent2?: string;
    bg?: string;
    text?: string;
  };

  // Social
  subscribers?: string[];
};

export type AuthContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
};