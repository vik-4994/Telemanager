import { useEffect, useMemo, useRef, useState } from "react";

/**
 * ForwardingTasks — Revamped UI
 * - Gradient header + KPI (total / active / paused)
 * - Search, filter by status, sort per column
 * - Sticky table header, compact action buttons
 * - Optimistic start/stop toggle with rollback; "Stop now" endpoint preserved
 * - Manual refresh + auto-refresh toggle with "last updated" indicator
 * - Expandable row: quick peek into target groups (first N)
 * - Subtle toasts + skeleton rows
 */
export default function ForwardingTasks() {
  const token = localStorage.getItem("access");

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | paused
  const [sort, setSort] = useState({ key: "source_channel", dir: "asc" });
  const [expanded, setExpanded] = useState(() => new Set());

  // refresh controls
  const DEFAULT_REFRESH = 60; // seconds
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ------- Fetch -------
  const fetchTasks = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/forwarding/tasks/", { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
      setLastUpdated(Date.now());
    } catch (e) {
      setError("Не удалось загрузить задачи");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh each DEFAULT_REFRESH seconds
  useEffect(() => {
    if (!autoRefresh) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(fetchTasks, DEFAULT_REFRESH * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh]);

  // ------- Helpers -------
  const normalize = (v) => (v ?? "").toString().toLowerCase().trim();
  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString(); } catch { return "—"; }
  };
  const since = (ts) => {
    if (!ts) return "—";
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (sec < 60) return `${sec}s назад`;
    const m = Math.floor(sec / 60); if (m < 60) return `${m}m назад`;
    const h = Math.floor(m / 60); return `${h}h назад`;
  };

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

  const headerSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const toggleExpand = (id) => setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  // ------- Actions -------
  const optimToggle = async (task) => {
    // optimistic toggle is_active
    const prev = tasks;
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, is_active: !t.is_active } : t)));
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/forwarding/tasks/${task.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ is_active: !task.is_active }),
      });
      if (!res.ok) throw new Error();
      toast(!task.is_active ? "Запущено" : "Остановлено");
    } catch (_) {
      setTasks(prev); // rollback
      toast("Не удалось изменить статус", true);
    }
  };

  const stopNow = async (id) => {
    if (!window.confirm("Остановить выполнение этой задачи немедленно?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/forwarding/tasks/${id}/stop/`, { method: "POST", headers });
      const data = await res.json().catch(()=>({}));
      if (res.ok) { toast(data?.message || "Задача остановлена"); fetchTasks(); }
      else toast("Ошибка: " + (data?.error || res.status), true);
    } catch (_) { toast("Ошибка соединения", true); }
  };

  const deleteTask = async (id) => {
    if (!window.confirm("Удалить эту задачу?")) return;
    const prev = tasks;
    setTasks((list) => list.filter((t) => t.id !== id));
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/forwarding/tasks/${id}/`, { method: "DELETE", headers });
      if (!res.ok) throw new Error();
      toast("Удалено");
    } catch (_) {
      setTasks(prev); // rollback
      toast("Ошибка при удалении", true);
    }
  };

  // ------- Derived -------
  const filtered = useMemo(() => {
    const query = normalize(q);
    let rows = [...tasks];
    if (statusFilter !== "all") rows = rows.filter((t) => !!t.is_active === (statusFilter === "active"));
    if (query) rows = rows.filter((t) => [t.source_channel, t.account].some((x) => normalize(x).includes(query)));
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const va = (a[sort.key] ?? "").toString();
      const vb = (b[sort.key] ?? "").toString();
      // special for last_sent_at & interval
      if (sort.key === "last_sent_at") return (new Date(va) - new Date(vb)) * dir;
      if (sort.key === "interval_minutes") return ((+va) - (+vb)) * dir;
      return va.toString().localeCompare(vb.toString()) * dir;
    });
    return rows;
  }, [tasks, q, statusFilter, sort]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const active = tasks.filter((t) => t.is_active).length;
    const paused = total - active;
    return { total, active, paused };
  }, [tasks]);

  // ------- Render -------
  return (
    <div className="container py-4" style={{ maxWidth: 1140 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #10b981 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Пересылка контента</div>
            <h2 className="m-0">📤 Задачи пересылки</h2>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <button className="btn btn-light" onClick={fetchTasks}>⟳ Обновить</button>
            <div className="form-check form-switch text-white ms-2">
              <input className="form-check-input" type="checkbox" id="autoRef" checked={autoRefresh} onChange={(e)=>setAutoRefresh(e.target.checked)} />
              <label className="form-check-label" htmlFor="autoRef">Автообновление</label>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-3">
        <KPI title="Всего" value={stats.total} icon="📦" accent="secondary"/>
        <KPI title="Активны" value={stats.active} icon="✅" accent="success"/>
        <KPI title="Выключены" value={stats.paused} icon="⏸" accent="warning"/>
      </div>

      {/* Controls */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap align-items-center gap-3">
          <div className="input-group" style={{ maxWidth: 420 }}>
            <span className="input-group-text">🔎</span>
            <input className="form-control" placeholder="Поиск: источник / аккаунт" value={q} onChange={(e)=>setQ(e.target.value)} />
            {q && <button className="btn btn-outline-secondary" onClick={()=>setQ("")}>✖</button>}
          </div>
          <select className="form-select" style={{ maxWidth: 220 }} value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}>
            <option value="all">Все</option>
            <option value="active">Только активные</option>
            <option value="paused">Только выключенные</option>
          </select>
          <div className="ms-auto small text-muted">Обновлено: {lastUpdated ? since(lastUpdated) : "—"}</div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive" style={{ maxHeight: "65vh" }}>
          <table className="table table-hover align-middle m-0">
            <thead className="table-light sticky-top" style={{ top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: 44 }}></th>
                <Th onClick={() => headerSort('source_channel')} active={sort.key==='source_channel'} dir={sort.dir}>Источник</Th>
                <Th onClick={() => headerSort('account')} active={sort.key==='account'} dir={sort.dir}>Аккаунт</Th>
                <Th onClick={() => headerSort('interval_minutes')} active={sort.key==='interval_minutes'} dir={sort.dir}>Интервал</Th>
                <Th onClick={() => headerSort('is_active')} active={sort.key==='is_active'} dir={sort.dir}>Статус</Th>
                <Th onClick={() => headerSort('last_sent_at')} active={sort.key==='last_sent_at'} dir={sort.dir}>Последняя отправка</Th>
                <th style={{ width: 300 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows/>
              ) : error ? (
                <tr><td colSpan={7} className="text-danger p-4">{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted p-5">Задачи не найдены</td></tr>
              ) : (
                filtered.map((t, i) => {
                  const isOpen = expanded.has(t.id);
                  const groups = Array.isArray(t.target_groups) ? t.target_groups : [];
                  const groupsPreview = groups.slice(0, 5).map((g) => typeof g === 'string' ? g : (g?.username ?? g?.id ?? '—'));
                  const groupsMore = Math.max(0, groups.length - groupsPreview.length);
                  return (
                    <>
                      <tr key={t.id}>
                        <td>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleExpand(t.id)} title={isOpen? 'Свернуть' : 'Развернуть'}>
                            {isOpen ? '▾' : '▸'}
                          </button>
                        </td>
                        <td className="fw-semibold">{t.source_channel}</td>
                        <td>{t.account}</td>
                        <td>{t.interval_minutes} мин</td>
                        <td>{t.is_active ? <span className="badge bg-success">Активна</span> : <span className="badge bg-danger">Выключена</span>}</td>
                        <td>{t.last_sent_at ? fmtDate(t.last_sent_at) : '—'}</td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => optimToggle(t)}>
                              {t.is_active ? '⏸ Пауза' : '▶ Запустить'}
                            </button>
                            {t.is_active && (
                              <button className="btn btn-sm btn-outline-danger" onClick={() => stopNow(t.id)}>🛑 Стоп сейчас</button>
                            )}
                            <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTask(t.id)}>🗑️ Удалить</button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td></td>
                          <td colSpan={6}>
                            <div className="small text-muted">Группы‑получатели ({groups.length}):</div>
                            {groups.length === 0 ? (
                              <div className="text-muted">— пусто —</div>
                            ) : (
                              <div className="d-flex flex-wrap gap-2 mt-1">
                                {groupsPreview.map((g, idx) => (
                                  <span key={idx} className="badge bg-secondary-subtle text-dark border">{g}</span>
                                ))}
                                {groupsMore > 0 && <span className="badge bg-light text-dark">+{groupsMore}</span>}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
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

function SkeletonRows({ rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={7}>
            <div className="placeholder-wave">
              <span className="placeholder col-1 me-2"></span>
              <span className="placeholder col-3 me-2"></span>
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-1 me-2"></span>
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-2"></span>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}