import { useEffect, useMemo, useState } from "react";

/**
 * ForwardingGroups — Revamped UI
 * - Gradient header + KPI (total / active / disabled)
 * - Add form with @username / t.me/username / chat id normalization
 * - Search + filter by status + sort
 * - Sticky table header, badges, compact actions
 * - Optimistic enable/disable & delete with rollback
 * - Subtle toasts + skeletons
 */
export default function ForwardingGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add form
  const [rawUsername, setRawUsername] = useState("");
  const [adding, setAdding] = useState(false);

  // UI controls
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | disabled
  const [sort, setSort] = useState({ key: "username", dir: "asc" });

  const token = localStorage.getItem("access");
  const API = "http://127.0.0.1:8000/api/forwarding/groups";

  // ------------- Fetch -------------
  const fetchGroups = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (_) {
      setError("Не удалось загрузить список");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); /* eslint-disable-next-line */ }, []);

  // ------------- Helpers -------------
  const toast = (msg, danger = false) => {
    const id = `t_${Date.now()}`;
    const el = document.createElement("div");
    el.id = id;
    el.className = `position-fixed top-0 end-0 m-3 alert ${danger ? "alert-danger" : "alert-success"}`;
    el.style.zIndex = 1080;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => document.getElementById(id)?.remove(), 2200);
  };

  const normalizeUsername = (raw) => {
    if (!raw) return "";
    let v = String(raw).trim();
    // chat id like -1001234567890 — leave as is
    if (/^-?\d+$/.test(v)) return v;
    try {
      if (v.startsWith("http://") || v.startsWith("https://")) {
        const u = new URL(v);
        if (u.hostname.replace("www.", "") === "t.me") v = u.pathname.replace(/^\//, "");
      }
    } catch (_) {}
    v = v.replace(/\s+/g, "");
    if (!v) return "";
    if (!v.startsWith("@")) v = "@" + v;
    return v;
  };

  const username = useMemo(() => normalizeUsername(rawUsername), [rawUsername]);
  const usernameError = useMemo(() => {
    if (!username) return "Укажите @username или ID";
    if (/^-?\d+$/.test(username)) return ""; // numeric id ok
    if (!/^@[A-Za-z0-9_]{3,}$/i.test(username)) return "Только латиница/цифры/_, от 3 символов";
    return "";
  }, [username]);

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast("Скопировано"); }
    catch { toast("Не удалось скопировать", true); }
  };

  const headerSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const normalize = (v) => (v ?? "").toString().toLowerCase().trim();

  // ------------- Actions -------------
  const handleAdd = async (e) => {
    e?.preventDefault?.();
    if (usernameError) return;
    setAdding(true);
    try {
      const res = await fetch(`${API}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username })
      });
      const data = await res.json().catch(()=>({}));
      if (res.ok) {
        toast("✅ Группа добавлена");
        setRawUsername("");
        fetchGroups();
      } else {
        toast(data?.error || "Ошибка при добавлении", true);
      }
    } catch (_) { toast("Ошибка соединения", true); }
    finally { setAdding(false); }
  };

  const handleToggle = async (id, isActive) => {
    // optimistic
    const prev = groups;
    setGroups((list) => list.map((g) => (g.id === id ? { ...g, is_active: !isActive } : g)));
    const endpoint = isActive ? "disable" : "enable";
    try {
      const res = await fetch(`${API}/${id}/${endpoint}/`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      toast(isActive ? "Отключено" : "Включено");
    } catch (_) {
      setGroups(prev); // rollback
      toast("Не удалось изменить статус", true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить эту группу?")) return;
    const prev = groups;
    setGroups((list) => list.filter((g) => g.id !== id));
    try {
      const res = await fetch(`${API}/${id}/`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      toast("Удалено");
    } catch (_) {
      setGroups(prev); // rollback
      toast("Ошибка при удалении", true);
    }
  };

  // ------------- Derived -------------
  const filtered = useMemo(() => {
    const query = normalize(q);
    let rows = [...groups];
    if (statusFilter !== "all") rows = rows.filter((g) => !!g.is_active === (statusFilter === "active"));
    if (query) rows = rows.filter((g) => [g.username].some((s) => normalize(s).includes(query)));
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const sa = normalize(a[sort.key]);
      const sb = normalize(b[sort.key]);
      return sa.localeCompare(sb) * dir;
    });
    return rows;
  }, [groups, q, statusFilter, sort]);

  const stats = useMemo(() => {
    const total = groups.length;
    const active = groups.filter((g) => g.is_active).length;
    const disabled = total - active;
    return { total, active, disabled };
  }, [groups]);

  // ------------- Render -------------
  return (
    <div className="container py-4" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #00b894 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Пересылка контента</div>
            <h2 className="m-0">📥 Группы для пересылки</h2>
          </div>
          <button className="btn btn-light" onClick={fetchGroups}>⟳ Обновить</button>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-3">
        <KPI title="Всего" value={stats.total} icon="📦" accent="secondary" />
        <KPI title="Активны" value={stats.active} icon="✅" accent="success" />
        <KPI title="Отключены" value={stats.disabled} icon="⏸" accent="warning" />
      </div>

      {/* Add form */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={handleAdd}>
            <div className="col-12 col-lg-8">
              <label className="form-label">Username или ID</label>
              <div className="input-group">
                <span className="input-group-text">@</span>
                <input
                  type="text"
                  className={`form-control ${usernameError && rawUsername ? 'is-invalid' : ''}`}
                  placeholder="@group, t.me/group или -1001234567890"
                  value={rawUsername}
                  onChange={(e) => setRawUsername(e.target.value)}
                  required
                />
                {username && (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => copy(username)} title="Скопировать">
                    📋
                  </button>
                )}
                <div className="invalid-feedback">{usernameError}</div>
              </div>
              <div className="form-text">Мы автоматически приведём к формату <code>@username</code> или оставим числовой ID без изменений.</div>
            </div>
            <div className="col-12 col-lg-4 text-lg-end">
              <button type="submit" className="btn btn-primary w-100" disabled={adding || !!usernameError}>
                {adding ? 'Добавляем…' : '➕ Добавить'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Controls */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-lg-6">
              <div className="input-group">
                <span className="input-group-text">🔎</span>
                <input className="form-control" placeholder="Поиск по @username" value={q} onChange={(e)=>setQ(e.target.value)} />
                {q && <button className="btn btn-outline-secondary" onClick={()=>setQ("")}>✖</button>}
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <select className="form-select" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}>
                <option value="all">Все</option>
                <option value="active">Только активные</option>
                <option value="disabled">Только отключённые</option>
              </select>
            </div>
            <div className="col-6 col-lg-3">
              <select className="form-select" value={`${sort.key}:${sort.dir}`} onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setSort({ key, dir });
              }}>
                <option value="username:asc">Username ↑</option>
                <option value="username:desc">Username ↓</option>
                <option value="is_active:asc">Статус ↑</option>
                <option value="is_active:desc">Статус ↓</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive" style={{ maxHeight: "65vh" }}>
          <table className="table table-hover align-middle m-0">
            <thead className="table-light sticky-top" style={{ top: 0, zIndex: 1 }}>
              <tr>
                <Th onClick={() => headerSort('username')} active={sort.key==='username'} dir={sort.dir}>Username</Th>
                <Th onClick={() => headerSort('is_active')} active={sort.key==='is_active'} dir={sort.dir}>Статус</Th>
                <th style={{ width: 260 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : error ? (
                <tr><td colSpan={3} className="text-danger p-4">{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="text-center text-muted p-5">Нет добавленных групп</td></tr>
              ) : (
                filtered.map((g, i) => (
                  <tr key={g.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-semibold">{g.username}</span>
                        <button className="btn btn-sm btn-outline-secondary" title="Скопировать" onClick={() => copy(g.username)}>📋</button>
                      </div>
                    </td>
                    <td>{g.is_active ? <span className="badge bg-success">Активна</span> : <span className="badge bg-danger">Отключена</span>}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => handleToggle(g.id, g.is_active)}>
                          {g.is_active ? '⏸ Отключить' : '▶ Включить'}
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(g.id)}>🗑️ Удалить</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="alert alert-warning mt-3">
        ℹ️ Подсказка: используйте @username публичной группы, либо внутренний chat ID вида <code>-100…</code> для приватных.
      </div>
    </div>
  );
}

function KPI({ title, value, icon, accent = "secondary" }) {
  return (
    <div className="col-6 col-lg-4">
      <div className={`card border-0 shadow-sm h-100 bg-${accent}-subtle`}>
        <div className="card-body d-flex align-items-center gap-3">
          <div style={{ fontSize: 26 }}>{icon}</div>
          <div>
            <div className="text-muted small">{title}</div>
            <div className="h4 m-0">{value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children, onClick, active, dir }) {
  return (
    <th role="button" onClick={onClick} className="text-nowrap">
      <span className="d-inline-flex align-items-center gap-1">
        {children}
        {active && <span className="small text-muted">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function SkeletonRows({ rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={3}>
            <div className="placeholder-wave">
              <span className="placeholder col-3 me-2"></span>
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-2"></span>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
