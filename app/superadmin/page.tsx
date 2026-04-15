// app/superadmin/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import "./superadmin.css";

// ── Types ──────────────────────────────────────────────────────────
interface UserData {
  _id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  isFrozen: boolean;
  frozenReason?: string;
  createdAt: string;
}

interface PostData {
  _id: string;
  title: string;
  type: string;
  createdAt: string;
  user?: { name: string; email: string };
}

interface LiveData {
  _id: string;
  title?: string;
  createdAt: string;
  user?: { name: string; email: string };
}

type Tab = "users" | "posts" | "lives";
type ToastType = "success" | "error" | "info";
type Toast = { msg: string; type: ToastType } | null;

// ── Modal type ──────────────────────────────────────────────────────
interface ModalState {
  type:
    | "editUser"
    | "deleteUser"
    | "deletePost"
    | "deleteLive"
    | "freeze"
    | null;
  target?: any;
}

const API = "https://stream-72mw.onrender.com/api/superadmin";

// ── Helpers ─────────────────────────────────────────────────────────
const initials = (name: string) =>
  name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ── Component ────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const { user } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("users");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [modal, setModal] = useState<ModalState>({ type: null });

  const [users, setUsers] = useState<UserData[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [lives, setLives] = useState<LiveData[]>([]);

  const [editForm, setEditForm] = useState({ plan: "", role: "", reason: "" });

  // ── Token ──────────────────────────────────────────────────────────
  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  const headers = useCallback(
    () => ({
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    }),
    [token],
  );

  // ── Toast helper ────────────────────────────────────────────────────
  const showToast = (msg: string, type: ToastType = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(
    async (quiet = false) => {
      if (!token) return;
      quiet ? setRefreshing(true) : setLoading(true);
      try {
        const [uRes, pRes, lRes] = await Promise.all([
          fetch(`${API}/users`, { headers: headers() }),
          fetch(`${API}/posts`, { headers: headers() }),
          fetch(`${API}/lives`, { headers: headers() }),
        ]);

        const [u, p, l] = await Promise.all([
          uRes.json(),
          pRes.json(),
          lRes.json(),
        ]);
        if (Array.isArray(u)) setUsers(u);
        if (Array.isArray(p)) setPosts(p);
        if (Array.isArray(l)) setLives(l);
      } catch {
        showToast("Error de conexión", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, headers],
  );

  useEffect(() => {
    if (user?.role === "superadmin" && token) fetchAll();
  }, [user, token, fetchAll]);

  // ── Actions: Users ────────────────────────────────────────────────
  const handleFreeze = async () => {
    const u = modal.target as UserData;
    await fetch(`${API}/users/${u._id}/freeze`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ reason: editForm.reason || "Moderación" }),
    });
    showToast(`${u.name} congelado`);
    setModal({ type: null });
    fetchAll(true);
  };

  const handleUnfreeze = async (id: string, name: string) => {
    await fetch(`${API}/users/${id}/unfreeze`, {
      method: "PUT",
      headers: headers(),
    });
    showToast(`${name} descongelado`);
    fetchAll(true);
  };

  const handleDeleteUser = async () => {
    const u = modal.target as UserData;
    await fetch(`${API}/users/${u._id}`, {
      method: "DELETE",
      headers: headers(),
    });
    showToast(`${u.name} eliminado`, "error");
    setModal({ type: null });
    fetchAll(true);
  };

  const handleChangePlan = async (id: string, plan: string) => {
    await fetch(`${API}/users/${id}/plan`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ plan, durationDays: 30 }),
    });
    showToast(`Plan actualizado a ${plan}`, "info");
    fetchAll(true);
  };

  const handleChangeRole = async (id: string, role: string) => {
    await fetch(`${API}/users/${id}/role`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ role }),
    });
    showToast(`Rol actualizado a ${role}`, "info");
    fetchAll(true);
  };

  // ── Actions: Posts & Lives ────────────────────────────────────────
  const handleDeletePost = async () => {
    const p = modal.target as PostData;
    await fetch(`${API}/posts/${p._id}`, {
      method: "DELETE",
      headers: headers(),
    });
    showToast("Post eliminado", "error");
    setModal({ type: null });
    fetchAll(true);
  };

  const handleDeleteLive = async () => {
    const l = modal.target as LiveData;
    await fetch(`${API}/lives/${l._id}`, {
      method: "DELETE",
      headers: headers(),
    });
    showToast("Live eliminado", "error");
    setModal({ type: null });
    fetchAll(true);
  };

  // ── Guard ─────────────────────────────────────────────────────────
  if (!user)
    return (
      <div className="sa-loading">
        <div className="sa-spinner" />
        <span>Autenticando…</span>
      </div>
    );
  if (user.role !== "superadmin")
    return (
      <div className="sa-empty">
        <div className="sa-empty-icon">🔒</div>
        <p>No autorizado</p>
      </div>
    );

  // ── Filter ────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
  );
  const filteredPosts = posts.filter(
    (p) =>
      p.title?.toLowerCase().includes(q) ||
      p.user?.name?.toLowerCase().includes(q),
  );
  const filteredLives = lives.filter(
    (l) =>
      l.title?.toLowerCase().includes(q) ||
      l.user?.name?.toLowerCase().includes(q),
  );

  // ── Stats ─────────────────────────────────────────────────────────
  const frozen = users.filter((u) => u.isFrozen).length;
  const pro = users.filter((u) => u.plan === "pro").length;
  const premium = users.filter((u) => u.plan === "premium").length;

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="sa-shell">
      {/* ── SIDEBAR ── */}
      <aside className="sa-sidebar">
        <div className="sa-logo">
          <div className="sa-logo-icon">⚡</div>
          <div>
            <div className="sa-logo-text">Control</div>
            <div className="sa-logo-sub">superadmin</div>
          </div>
        </div>

        <nav className="sa-nav">
          <div className="sa-nav-label">Módulos</div>

          {(["users", "posts", "lives"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`sa-nav-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "users" ? "👥" : t === "posts" ? "📝" : "🔴"}
              {t === "users" ? "Usuarios" : t === "posts" ? "Posts" : "Lives"}
              <span className="sa-nav-count">
                {t === "users"
                  ? users.length
                  : t === "posts"
                    ? posts.length
                    : lives.length}
              </span>
            </button>
          ))}
        </nav>

        <div className="sa-sidebar-footer">
          <div className="sa-user-chip">
            <div className="sa-avatar">{initials(user.name || "SA")}</div>
            <div className="sa-user-info">
              <div className="sa-user-name">{user.name || "SuperAdmin"}</div>
              <div className="sa-user-role">superadmin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── TOPBAR ── */}
      <header className="sa-topbar">
        <div className="sa-topbar-title">
          {tab === "users"
            ? "Gestión de Usuarios"
            : tab === "posts"
              ? "Gestión de Posts"
              : "Gestión de Lives"}
        </div>

        <div className="sa-search">
          <svg
            className="sa-search-icon"
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className={`sa-refresh-btn ${refreshing ? "spinning" : ""}`}
          onClick={() => fetchAll(true)}
        >
          <svg
            width="13"
            height="13"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          Actualizar
        </button>

        <div className="sa-status-dot" title="Conectado" />
      </header>

      {/* ── MAIN ── */}
      <main className="sa-main">
        {/* Stats */}
        <div className="sa-stats">
          <div
            className="sa-stat-card"
            style={{ "--card-accent": "var(--accent)" } as any}
          >
            <div className="sa-stat-icon">👥</div>
            <div className="sa-stat-val">{users.length}</div>
            <div className="sa-stat-label">Usuarios</div>
          </div>
          <div
            className="sa-stat-card"
            style={{ "--card-accent": "var(--danger)" } as any}
          >
            <div className="sa-stat-icon">🥶</div>
            <div className="sa-stat-val">{frozen}</div>
            <div className="sa-stat-label">Congelados</div>
          </div>
          <div
            className="sa-stat-card"
            style={{ "--card-accent": "var(--accent2)" } as any}
          >
            <div className="sa-stat-icon">💎</div>
            <div className="sa-stat-val">{pro}</div>
            <div className="sa-stat-label">Plan Pro</div>
          </div>
          <div
            className="sa-stat-card"
            style={{ "--card-accent": "var(--accent)" } as any}
          >
            <div className="sa-stat-icon">🌟</div>
            <div className="sa-stat-val">{premium}</div>
            <div className="sa-stat-label">Premium</div>
          </div>
          <div
            className="sa-stat-card"
            style={{ "--card-accent": "var(--accent3)" } as any}
          >
            <div className="sa-stat-icon">📝</div>
            <div className="sa-stat-val">{posts.length}</div>
            <div className="sa-stat-label">Posts</div>
          </div>
          <div
            className="sa-stat-card"
            style={{ "--card-accent": "var(--danger)" } as any}
          >
            <div className="sa-stat-icon">🔴</div>
            <div className="sa-stat-val">{lives.length}</div>
            <div className="sa-stat-label">Lives</div>
          </div>
        </div>

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <>
            <div className="sa-section-header">
              <h2 className="sa-section-title">
                Usuarios <span>{filteredUsers.length}</span>
              </h2>
            </div>

            {loading ? (
              <div className="sa-loading">
                <div className="sa-spinner" />
                <span>Cargando usuarios…</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="sa-empty">
                <div className="sa-empty-icon">👻</div>
                <p>No se encontraron usuarios</p>
              </div>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Estado</th>
                      <th>Plan</th>
                      <th>Rol</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u._id}>
                        <td>
                          <div className="sa-user-cell">
                            <div className="sa-avatar">{initials(u.name)}</div>
                            <div>
                              <div className="sa-user-cell-name">{u.name}</div>
                              <div className="sa-user-cell-email">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`sa-badge sa-badge--${u.isFrozen ? "frozen" : "active"}`}
                          >
                            {u.isFrozen ? "❌ Congelado" : "✅ Activo"}
                          </span>
                        </td>

                        <td>
                          <span className={`sa-badge sa-badge--${u.plan}`}>
                            {u.plan}
                          </span>
                        </td>

                        <td>
                          <span className={`sa-badge sa-badge--${u.role}`}>
                            {u.role}
                          </span>
                        </td>

                        <td
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {fmtDate(u.createdAt)}
                        </td>

                        <td>
                          {u.role === "superadmin" ? (
                            <span
                              style={{ fontSize: 12, color: "var(--muted)" }}
                            >
                              —
                            </span>
                          ) : (
                            <div className="sa-actions">
                              {!u.isFrozen ? (
                                <button
                                  className="sa-btn sa-btn--freeze"
                                  onClick={() => {
                                    setEditForm({ ...editForm, reason: "" });
                                    setModal({ type: "freeze", target: u });
                                  }}
                                >
                                  🥶 Congelar
                                </button>
                              ) : (
                                <button
                                  className="sa-btn sa-btn--unfreeze"
                                  onClick={() => handleUnfreeze(u._id, u.name)}
                                >
                                  🔥 Descongelar
                                </button>
                              )}

                              <select
                                className="sa-plan-select"
                                value={u.plan}
                                onChange={(e) =>
                                  handleChangePlan(u._id, e.target.value)
                                }
                              >
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="premium">Premium</option>
                              </select>

                              <select
                                className="sa-plan-select"
                                value={u.role}
                                onChange={(e) =>
                                  handleChangeRole(u._id, e.target.value)
                                }
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>

                              {u._id !== user.id && (
                                <button
                                  className="sa-btn sa-btn--delete"
                                  onClick={() =>
                                    setModal({ type: "deleteUser", target: u })
                                  }
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── POSTS TAB ── */}
        {tab === "posts" && (
          <>
            <div className="sa-section-header">
              <h2 className="sa-section-title">
                Posts <span>{filteredPosts.length}</span>
              </h2>
            </div>

            {loading ? (
              <div className="sa-loading">
                <div className="sa-spinner" />
                <span>Cargando posts…</span>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="sa-empty">
                <div className="sa-empty-icon">📭</div>
                <p>No hay posts</p>
              </div>
            ) : (
              <div className="sa-posts-grid">
                {filteredPosts.map((p) => (
                  <div key={p._id} className="sa-post-card">
                    <div className="sa-post-type">{p.type || "post"}</div>
                    <div className="sa-post-title">
                      {p.title || "Sin título"}
                    </div>
                    <div className="sa-post-meta">
                      <span>👤 {p.user?.name || "Desconocido"}</span>
                      <span>📅 {fmtDate(p.createdAt)}</span>
                    </div>
                    <div className="sa-post-actions">
                      <button
                        className="sa-btn sa-btn--delete"
                        onClick={() =>
                          setModal({ type: "deletePost", target: p })
                        }
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── LIVES TAB ── */}
        {tab === "lives" && (
          <>
            <div className="sa-section-header">
              <h2 className="sa-section-title">
                Lives <span>{filteredLives.length}</span>
              </h2>
            </div>

            {loading ? (
              <div className="sa-loading">
                <div className="sa-spinner" />
                <span>Cargando lives…</span>
              </div>
            ) : filteredLives.length === 0 ? (
              <div className="sa-empty">
                <div className="sa-empty-icon">📡</div>
                <p>No hay lives</p>
              </div>
            ) : (
              <div className="sa-posts-grid">
                {filteredLives.map((l) => (
                  <div key={l._id} className="sa-post-card">
                    <div className="sa-post-type">🔴 live</div>
                    <div className="sa-post-title">
                      {l.title || "Live sin título"}
                    </div>
                    <div className="sa-post-meta">
                      <span>👤 {l.user?.name || "Desconocido"}</span>
                      <span>📅 {fmtDate(l.createdAt)}</span>
                    </div>
                    <div className="sa-post-actions">
                      <button
                        className="sa-btn sa-btn--delete"
                        onClick={() =>
                          setModal({ type: "deleteLive", target: l })
                        }
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── MODALS ── */}

      {modal.type === "freeze" && (
        <div
          className="sa-modal-overlay"
          onClick={() => setModal({ type: null })}
        >
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-title">🥶 Congelar usuario</div>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
              Vas a congelar a{" "}
              <strong style={{ color: "var(--text)" }}>
                {modal.target?.name}
              </strong>
              . Ingresá el motivo.
            </p>
            <div className="sa-modal-field">
              <label className="sa-modal-label">Motivo</label>
              <input
                className="sa-modal-input"
                placeholder="Ej: Contenido inapropiado"
                value={editForm.reason}
                onChange={(e) =>
                  setEditForm({ ...editForm, reason: e.target.value })
                }
              />
            </div>
            <div className="sa-modal-actions">
              <button
                className="sa-btn sa-btn--ghost"
                onClick={() => setModal({ type: null })}
              >
                Cancelar
              </button>
              <button className="sa-btn sa-btn--freeze" onClick={handleFreeze}>
                Confirmar congelamiento
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.type === "deleteUser" && (
        <div
          className="sa-modal-overlay"
          onClick={() => setModal({ type: null })}
        >
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-title">🗑 Eliminar usuario</div>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
              Vas a eliminar permanentemente a{" "}
              <strong style={{ color: "var(--danger)" }}>
                {modal.target?.name}
              </strong>{" "}
              junto con todo su contenido. Esta acción no se puede deshacer.
            </p>
            <div className="sa-modal-actions">
              <button
                className="sa-btn sa-btn--ghost"
                onClick={() => setModal({ type: null })}
              >
                Cancelar
              </button>
              <button
                className="sa-btn sa-btn--delete"
                onClick={handleDeleteUser}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.type === "deletePost" && (
        <div
          className="sa-modal-overlay"
          onClick={() => setModal({ type: null })}
        >
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-title">🗑 Eliminar post</div>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
              ¿Eliminar el post{" "}
              <strong style={{ color: "var(--danger)" }}>
                "{modal.target?.title}"
              </strong>
              ? Esta acción es permanente.
            </p>
            <div className="sa-modal-actions">
              <button
                className="sa-btn sa-btn--ghost"
                onClick={() => setModal({ type: null })}
              >
                Cancelar
              </button>
              <button
                className="sa-btn sa-btn--delete"
                onClick={handleDeletePost}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.type === "deleteLive" && (
        <div
          className="sa-modal-overlay"
          onClick={() => setModal({ type: null })}
        >
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-title">🗑 Eliminar live</div>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
              ¿Eliminar este live de{" "}
              <strong style={{ color: "var(--danger)" }}>
                {modal.target?.user?.name}
              </strong>
              ?
            </p>
            <div className="sa-modal-actions">
              <button
                className="sa-btn sa-btn--ghost"
                onClick={() => setModal({ type: null })}
              >
                Cancelar
              </button>
              <button
                className="sa-btn sa-btn--delete"
                onClick={handleDeleteLive}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`sa-toast sa-toast--${toast.type}`}>
          {toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : "ℹ️"}
          {toast.msg}
        </div>
      )}
    </div>
  );
}