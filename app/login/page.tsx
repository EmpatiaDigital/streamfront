// app/login/page.tsx
"use client";
import { useState, useContext } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../context/AuthContext";
import "../styles/login.css";

export default function Login() {
  const [form, setForm]               = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const { setUser }                   = useContext(AuthContext)!;
  const router                        = useRouter();

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("https://stream-72mw.onrender.com/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Credenciales incorrectas");
        return;
      }

      localStorage.setItem("token", data.token);
      setUser(data.user);

      const role = data.user?.role?.toLowerCase();
      if (role === "superadmin") {
        router.push("/superadmin");
      } else {
        router.push("/");
      }
    } catch {
      setError("Error de conexión. Verificá tu red.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <span className="login-badge">✦ Acceso</span>
        <h1 className="login-title">
          Ingresar a <span>tu cuenta</span>
        </h1>
        <p className="login-subtitle">Continuá donde lo dejaste.</p>

        <div className="login-form">
          {error && <p className="login-error">{error}</p>}

          <div className="login-field">
            <label className="login-label">Email</label>
            <input
              className="login-input"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onKeyDown={handleKey}
            />
          </div>

          <div className="login-field">
            <label className="login-label">Contraseña</label>
            <div className="input-eye-wrapper">
              <input
                className="login-input"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={handleKey}
              />
              <button
                className="eye-btn"
                type="button"
                onClick={() => setShowPassword((p) => !p)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="login-forgot">
            <a href="#">¿Olvidaste tu contraseña?</a>
          </div>

          <button
            className="login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={18} className="spin-icon" />
            ) : (
              "Ingresar"
            )}
          </button>
        </div>

        <p className="login-footer">
          ¿No tenés cuenta? <a href="/register">Registrate</a>
        </p>
      </div>
    </div>
  );
}