import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

/**
 * ProxyList — Revamped UI
 * - Gradient header + KPI
 * - Search, filter by type, sort per column
 * - Sticky table header, badges, compact actions
 * - Copy URL to clipboard, reveal password, delete with confirm
 * - No extra deps (Bootstrap-only styles)
 */
export default function ProxyList() {
  const [proxies, setProxies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | http | https | socks5
  const [sort, setSort] = useState({ key: "host", dir: "asc" });
  const [revealIds, setRevealIds] = useState(() => new Set()); // ids with visible password

  const token = localStorage.getItem("access");
  const API = "http://127.0.0.1:8000/api/accounts/proxies/";

  const fetchProxies = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProxies(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Не удалось загрузить список прокси");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProxies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Helpers ---
  const normalize = (v) => (v ?? "").toString().toLowerCase().trim();
  const badgeFor = (t) => {
    const val = (t || "").toUpperCase();
    const cls = val === "SOCKS5" ? "bg-warning text-dark" : val === "HTTPS" ? "bg-info text-dark" : "bg-primary";
    return <span className={`badge ${cls}`}>{val || "—"}</span>;
  };

  const headerSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Скопировано");
    } catch (_) {
      toast("Не удалось скопировать", true);
    }
  };

  const proxyUrl = (p) => {
    const proto = (p.proxy_type || "http").toLowerCase();
    const auth = p.username ? `${encodeURIComponent(p.username)}:${encodeURIComponent(p.password || "")}@` : "";
    return `${proto}://${auth}${p.host}:${p.port}`;
  };

  const toggleReveal = (id) => {
    setRevealIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteProxy = async (proxyId) => {
    if (!window.confirm("Удалить этот прокси?")) return;
    try {
      const res = await fetch(`${API}${proxyId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setProxies((list) => list.filter((p) => p.id !== proxyId));
      toast("Удалено");
    } catch (_) {
      toast("Ошибка при удалении", true);
    }
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

  // --- Derived ---
  const filtered = useMemo(() => {
    const query = normalize(q);
    let rows = [...proxies];

    if (typeFilter !== "all") {
      rows = rows.filter((p) => normalize(p.proxy_type) === normalize(typeFilter));
    }

    if (query) {
      rows = rows.filter((p) => {
        const pool = [p.proxy_type, p.host, p.port, p.username, p.password];
        return pool.some((v) => normalize(v).includes(query));
      });
    }

    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const ka = a[sort.key];
      const kb = b[sort.key];
      const sa = normalize(ka);
      const sb = normalize(kb);
      return sa.localeCompare(sb) * dir;
    });

    return rows;
  }, [proxies, q, typeFilter, sort]);

  const stats = useMemo(() => {
    const total = proxies.length;
    const socks = proxies.filter((p) => normalize(p.proxy_type) === "socks5").length;
    const http = proxies.filter((p) => normalize(p.proxy_type) === "http").length;
    const https = proxies.filter((p) => normalize(p.proxy_type) === "https").length;
    return { total, socks, http, https };
  }, [proxies]);

  // --- Render ---
  return (
    <div className="container py-4" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #8e44ad 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Сетевые настройки</div>
            <h2 className="m-0">Прокси</h2>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-light" onClick={fetchProxies}>⟳ Обновить</button>
            <Link to="/proxies/add" className="btn btn-outline-light">➕ Добавить</Link>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-3">
        <KPI title="Всего" value={stats.total} icon="🌐" accent="secondary"/>
        <KPI title="HTTP" value={stats.http} icon="🔵" accent="primary"/>
        <KPI title="HTTPS" value={stats.https} icon="🟣" accent="info"/>
        <KPI title="SOCKS5" value={stats.socks} icon="🟠" accent="warning"/>
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
                  placeholder="Поиск: тип / хост / порт / логин"
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
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>
            <div className="col-6 col-lg-3">
              <select className="form-select" value={`${sort.key}:${sort.dir}`} onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setSort({ key, dir });
              }}>
                <option value="host:asc">Хост ↑</option>
                <option value="host:desc">Хост ↓</option>
                <option value="port:asc">Порт ↑</option>
                <option value="port:desc">Порт ↓</option>
                <option value="proxy_type:asc">Тип ↑</option>
                <option value="proxy_type:desc">Тип ↓</option>
                <option value="username:asc">Логин ↑</option>
                <option value="username:desc">Логин ↓</option>
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
                <Th onClick={() => headerSort("proxy_type")} active={sort.key === "proxy_type"} dir={sort.dir}>Тип</Th>
                <Th onClick={() => headerSort("host")} active={sort.key === "host"} dir={sort.dir}>Хост</Th>
                <Th onClick={() => headerSort("port")} active={sort.key === "port"} dir={sort.dir}>Порт</Th>
                <Th onClick={() => headerSort("username")} active={sort.key === "username"} dir={sort.dir}>Авторизация</Th>
                <th style={{ width: 240 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows/>
              ) : error ? (
                <tr><td colSpan={5} className="text-danger p-4">{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted p-5">Прокси не найдены</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{badgeFor(p.proxy_type)}</td>
                    <td className="fw-semibold">{p.host}</td>
                    <td>{p.port}</td>
                    <td>
                      {p.username ? (
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="badge bg-secondary-subtle text-dark border">{p.username}</span>
                          {p.password ? (
                            <span className="badge bg-secondary-subtle text-dark border">
                              {revealIds.has(p.id) ? (p.password) : "•••••"}
                            </span>
                          ) : (
                            <span className="text-muted">без пароля</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          title="Скопировать URL"
                          onClick={() => copy(proxyUrl(p))}
                        >
                          📋 Копировать
                        </button>
                        {p.password && (
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            title={revealIds.has(p.id) ? "Скрыть пароль" : "Показать пароль"}
                            onClick={() => toggleReveal(p.id)}
                          >
                            {revealIds.has(p.id) ? "🙈 Скрыть" : "👁 Показать"}
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-danger"
                          title="Удалить"
                          onClick={() => deleteProxy(p.id)}
                        >
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
    <div className="col-6 col-lg-3">
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
          <td colSpan={5}>
            <div className="placeholder-wave">
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-3 me-2"></span>
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