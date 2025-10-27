import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

/**
 * ChannelsList — Revamped UI
 * - Gradient header + KPIs (total / active / inactive)
 * - Search, filter by type & active state, sorting per column
 * - Sticky table header, badges, compact actions, skeletons
 * - Optimistic toggle active, copy @username, confirm delete
 */
export default function ChannelsList() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | channel | supergroup | group | chat
  const [activeFilter, setActiveFilter] = useState("all"); // all | active | inactive
  const [sort, setSort] = useState({ key: "username", dir: "asc" });

  const token = localStorage.getItem("access");
  const API_BASE = "http://127.0.0.1:8000/api/channels";

  // --- Data ---
  const fetchChannels = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/list/`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Ошибка при загрузке каналов");
      const data = await res.json();
      setChannels(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChannels(); /* eslint-disable react-hooks/exhaustive-deps */ }, []);

  // --- Actions ---
  const toast = (msg, danger=false) => {
    const id = `t_${Date.now()}`;
    const el = document.createElement("div");
    el.id = id;
    el.className = `position-fixed top-0 end-0 m-3 alert ${danger?"alert-danger":"alert-success"}`;
    el.style.zIndex = 1080;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>document.getElementById(id)?.remove(), 2200);
  };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast("Скопировано"); }
    catch { toast("Не удалось скопировать", true); }
  };

  const toggleActive = async (id) => {
    // optimistic update
    setChannels((list) => list.map((c) => (c.id === id ? { ...c, is_active: !c.is_active } : c)));
    try {
      const res = await fetch(`${API_BASE}/${id}/toggle/`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      toast("Статус обновлён");
    } catch (_) {
      // rollback
      setChannels((list) => list.map((c) => (c.id === id ? { ...c, is_active: !c.is_active } : c)));
      toast("Ошибка при смене статуса", true);
    }
  };

  const deleteChannel = async (id) => {
    if (!window.confirm("Удалить этот канал?")) return;
    const prev = channels;
    setChannels((list) => list.filter((c) => c.id !== id));
    try {
      const res = await fetch(`${API_BASE}/${id}/delete/`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      toast("Канал удалён");
    } catch (_) {
      setChannels(prev); // rollback
      toast("Ошибка при удалении", true);
    }
  };

  const headerSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  // --- Derived ---
  const normalize = (v) => (v ?? "").toString().toLowerCase().trim();

  const filtered = useMemo(() => {
    let rows = [...channels];
    const query = normalize(q);

    if (typeFilter !== "all") rows = rows.filter((c) => normalize(c.type) === normalize(typeFilter));
    if (activeFilter !== "all") rows = rows.filter((c) => !!c.is_active === (activeFilter === "active"));
    if (query) rows = rows.filter((c) => [c.username, c.title, c.type].some((x) => normalize(x).includes(query)));

    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const ka = a[sort.key];
      const kb = b[sort.key];
      const sa = normalize(ka);
      const sb = normalize(kb);
      return sa.localeCompare(sb) * dir;
    });

    return rows;
  }, [channels, q, typeFilter, activeFilter, sort]);

  const stats = useMemo(() => {
    const total = channels.length;
    const active = channels.filter((c) => c.is_active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [channels]);

  // --- Render ---
  return (
    <div className="container py-4" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #00b894 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Обучающие источники</div>
            <h2 className="m-0">Группы и каналы</h2>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-light" onClick={fetchChannels}>⟳ Обновить</button>
            <Link to="/channels/add" className="btn btn-outline-light">➕ Добавить</Link>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-3">
        <KPI title="Всего" value={stats.total} icon="📡" accent="secondary"/>
        <KPI title="Активны" value={stats.active} icon="✅" accent="success"/>
        <KPI title="Выключены" value={stats.inactive} icon="⏸" accent="warning"/>
      </div>

      {/* Controls */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-lg-5">
              <div className="input-group">
                <span className="input-group-text">🔎</span>
                <input
                  className="form-control"
                  placeholder="Поиск: @username / название / тип"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button className="btn btn-outline-secondary" onClick={() => setQ("")}>✖</button>
                )}
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">Все типы</option>
                <option value="channel">Канал</option>
                <option value="supergroup">Супергруппа</option>
                <option value="group">Группа</option>
                <option value="chat">Чат</option>
              </select>
            </div>
            <div className="col-6 col-lg-3">
              <select className="form-select" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="all">Все</option>
                <option value="active">Только активные</option>
                <option value="inactive">Только выключенные</option>
              </select>
            </div>
            <div className="col-12 col-lg-1 text-lg-end">
              <span className="text-muted small">Найдено: {filtered.length}</span>
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
                <Th onClick={() => headerSort("username")} active={sort.key === "username"} dir={sort.dir}>Username</Th>
                <Th onClick={() => headerSort("title")} active={sort.key === "title"} dir={sort.dir}>Название</Th>
                <Th onClick={() => headerSort("type")} active={sort.key === "type"} dir={sort.dir}>Тип</Th>
                <Th onClick={() => headerSort("is_active")} active={sort.key === "is_active"} dir={sort.dir}>Активен</Th>
                <th style={{ width: 280 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows/>
              ) : error ? (
                <tr><td colSpan={5} className="text-danger p-4">{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted p-5">Нет добавленных каналов</td></tr>
              ) : (
                filtered.map((ch) => (
                  <tr key={ch.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-semibold">{ch.username}</span>
                        <button className="btn btn-sm btn-outline-secondary" title="Скопировать" onClick={() => copy(ch.username)}>
                          📋
                        </button>
                      </div>
                    </td>
                    <td>{ch.title || "—"}</td>
                    <td>{typeBadge(ch.type)}</td>
                    <td>{ch.is_active ? <span className="badge bg-success">Да</span> : <span className="badge bg-danger">Нет</span>}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(ch.id)}>
                          {ch.is_active ? "⏸ Отключить" : "▶ Включить"}
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteChannel(ch.id)}>
                          🗑️ Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

function typeBadge(t) {
  const val = (t || "").toLowerCase();
  if (val.includes("super")) return <span className="badge bg-info text-dark">Супергруппа</span>;
  if (val.includes("group")) return <span className="badge bg-secondary">Группа</span>;
  if (val.includes("channel")) return <span className="badge bg-primary">Канал</span>;
  return <span className="badge bg-light text-dark">{t || "—"}</span>;
}

function SkeletonRows({ rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={5}>
            <div className="placeholder-wave">
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-4 me-2"></span>
              <span className="placeholder col-1 me-2"></span>
              <span className="placeholder col-1 me-2"></span>
              <span className="placeholder col-2"></span>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}