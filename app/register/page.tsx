"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import "../styles/register.css";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    try {
      const res = await fetch("https://stream-72mw.onrender.com/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Error del server:", data);
        return;
      }

      localStorage.setItem("token", data.token);
      router.push("/");

    } catch (err) {
      console.error("Error de red:", err);
    }
  };

  return (
    <div className="register-wrapper">
      <div className="register-card">
        <span className="register-badge">✦ Nuevo usuario</span>
        <h1 className="register-title">Creá <span>tu cuenta</span></h1>
        <p className="register-subtitle">Únete y empezá a disfrutar el contenido.</p>

        <div className="register-form">
          <div className="register-field">
            <label className="register-label">Nombre</label>
            <input
              className="register-input"
              placeholder="Tu nombre"
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="register-field">
            <label className="register-label">Email</label>
            <input
              className="register-input"
              placeholder="tu@email.com"
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="register-field">
            <label className="register-label">Contraseña</label>
            <div className="input-eye-wrapper">
              <input
                className="register-input"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
              <button
                className="eye-btn"
                type="button"
                onClick={() => setShowPassword(p => !p)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button className="register-btn" onClick={handleSubmit}>
            Registrarse
          </button>
        </div>

        <p className="register-footer">
          ¿Ya tenés cuenta? <a href="/login">Ingresá</a>
        </p>
      </div>
    </div>
  );
}