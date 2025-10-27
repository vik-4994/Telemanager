import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

/**
 * Revamped Dashboard
 * - Polished header with quick actions
 * - KPI cards (accounts, active, with proxy, channels)
 * - Search + filters + sort
 * - Better table UX with badges & sticky header
 * - Non-blocking UI feedback
 */
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proxies, setProxies] = useState([]);
  const [channels, setChannels] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  // UI state
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [proxyFilter, setProxyFilter] = useState("all");
  const [sort, setSort] = useState({ key: "last_used", dir: "desc" });

  const navigate = useNavigate();
  const token = localStorage.getItem("access");

  // ------- Data fetching -------
  const fetchProfile = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/me/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return navigate("/login");
      const data = await res.json();
      setUser(data);
    } catch (e) {
      setError("Не удалось получить профиль");
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/accounts/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return navigate("/login");
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Не удалось получить список аккаунтов");
    } finally {
      setLoading(false);
    }
  };

  const fetchProxies = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/accounts/proxies/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProxies(Array.isArray(data) ? data : []);
    } catch (e) {
      /* noop */
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/accounts/intermediate-channels/",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      setChannels(Array.isArray(data) ? data : []);
    } catch (e) {
      /* noop */
    }
  };

  useEffect(() => {
    if (!token) return navigate("/login");
    setLoading(true);
    fetchProfile();
    fetchAccounts();
    fetchProxies();
    fetchChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------- Actions -------
  const checkAllAccounts = async () => {
    if (!window.confirm("Запустить проверку всех аккаунтов?")) return;
    const res = await fetch("http://127.0.0.1:8000/api/accounts/check_all/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    res.ok ? toast("Проверка запущена") : toast("Ошибка запуска проверки", true);
  };

  const stopInvite = async (accountId) => {
    const res = await fetch("http://127.0.0.1:8000/api/accounts/invite/stop/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ account_id: accountId }),
    });
    res.ok ? toast("Инвайт остановлен") : toast("Ошибка при остановке", true);
    fetchAccounts();
  };

  const changeProxy = async (accountId, proxyId) => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/accounts/${accountId}/set_proxy/`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ proxy_id: proxyId }),
      }
    );
    if (res.ok) {
      setEditingId(null);
      fetchAccounts();
      toast("Прокси обновлён");
    } else {
      toast("Ошибка смены прокси", true);
    }
  };

  const deleteAccount = async (accountId) => {
    if (!window.confirm("Удалить этот аккаунт?")) return;
    const res = await fetch(`http://127.0.0.1:8000/api/accounts/${accountId}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
      toast("Аккаунт удалён");
    } else {
      toast("Ошибка при удалении аккаунта", true);
    }
  };

  const addAccountToChannel = async (accountId, channelId) => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/accounts/intermediate-channels/${channelId}/add_account/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ account_id: accountId }),
      }
    );

    res.ok ? toast("Запуск добавления в канал") : toast("Ошибка добавления", true);
  };

  const trainAccount = async (accountId) => {
    const res = await fetch(`http://127.0.0.1:8000/api/accounts/${accountId}/train/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast("Обучение запущено");
    } else {
      const data = await res.json();
      toast("Ошибка: " + (data.error || "неизвестная"), true);
    }
  };

  // ------- Helpers -------
  const toast = (msg, danger = false) => {
    const id = `t_${Date.now()}`;
    const el = document.createElement("div");
    el.id = id;
    el.className = `position-fixed top-0 end-0 m-3 alert ${danger ? "alert-danger" : "alert-success"}`;
    el.style.zIndex = 1080;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => document.getElementById(id)?.remove(), 2400);
  };

  const normalize = (v) => (v ?? "").toString().toLowerCase().trim();
  const getProxyLabel = (acc) => {
    const proxy = proxies.find((p) => p.id === acc.proxy_id);
    return proxy ? `${(proxy.proxy_type || "").toUpperCase()} ${proxy.host}:${proxy.port}` : "Без прокси";
  };
  const badge = (status) => {
    const s = (status || "").toLowerCase();
    if (s.includes("актив")) return <span className="badge bg-success">Активен</span>;
    if (s.includes("бан") || s.includes("заблок")) return <span className="badge bg-danger">Заблокирован</span>;
    if (s.includes("спит") || s.includes("отлеж")) return <span className="badge bg-secondary">Отлеживается</span>;
    if (s.includes("ошибка")) return <span className="badge bg-warning text-dark">Ошибка</span>;
    return <span className="badge bg-light text-dark">—</span>;
  };

  // ------- Derived data (search / filter / sort) -------
  const filtered = useMemo(() => {
    const query = normalize(q);
    let list = [...accounts];

    if (query) {
      list = list.filter((a) => {
        const keys = [a.phone, a.geo, a.status, a.role, a.name];
        return keys.some((k) => normalize(k).includes(query));
      });
    }

    if (statusFilter !== "all") {
      list = list.filter((a) => normalize(a.status).includes(normalize(statusFilter)));
    }

    if (proxyFilter !== "all") {
      list = list.filter((a) => (proxyFilter === "with" ? !!a.proxy_id : !a.proxy_id));
    }

    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const ka = a[sort.key];
      const kb = b[sort.key];
      if (sort.key === "last_used") {
        const da = ka ? new Date(ka).getTime() : 0;
        const db = kb ? new Date(kb).getTime() : 0;
        return (da - db) * dir;
      }
      const sa = normalize(ka);
      const sb = normalize(kb);
      return sa.localeCompare(sb) * dir;
    });

    return list;
  }, [accounts, q, statusFilter, proxyFilter, sort]);

  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((a) => normalize(a.status).includes("актив")).length;
    const withProxy = accounts.filter((a) => !!a.proxy_id).length;
    const training = accounts.filter((a) => a.is_training).length;
    return { total, active, withProxy, channels: channels.length, training };
  }, [accounts, channels]);

  const headerSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  // ------- Render -------
  return (
    <div className="d-flex flex-column gap-4">
      {/* Header */}
      <div className="rounded-3 p-4 text-white" style={{
        background: "linear-gradient(135deg, #6f42c1 0%, #0d6efd 100%)",
        boxShadow: "0 10px 30px rgba(13,110,253,.25)"
      }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="opacity-75">Добро пожаловать</div>
            <h2 className="m-0">{user?.username || "пользователь"}</h2>
          </div>
          <div className="d-flex gap-2">
            <Link to="/account/add" className="btn btn-light">
              ➕ Добавить аккаунт
            </Link>
            <Link to="/telegram/auth" className="btn btn-outline-light">
              📲 Добавить через телефон
            </Link>
            <button className="btn btn-dark" onClick={checkAllAccounts}>
              🔍 Проверить все
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3">
        <KPI title="Всего аккаунтов" value={stats.total} icon="📱"/>
        <KPI title="Активны" value={stats.active} icon="✅" accent="success"/>
        <KPI title="С прокси" value={stats.withProxy} icon="🌐" accent="info"/>
        <KPI title="Каналов-посредников" value={stats.channels} icon="📡" accent="primary"/>
      </div>

      {/* Controls */}
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-lg-4">
              <div className="input-group">
                <span className="input-group-text">🔎</span>
                <input
                  className="form-control"
                  placeholder="Поиск: телефон / имя / статус / роль"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button className="btn btn-outline-secondary" onClick={() => setQ("")}>✖</button>
                )}
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Все статусы</option>
                <option value="актив">Только активные</option>
                <option value="заблок">Заблокированные</option>
                <option value="отлеж">Отлежка</option>
              </select>
            </div>
            <div className="col-6 col-lg-3">
              <select className="form-select" value={proxyFilter} onChange={(e) => setProxyFilter(e.target.value)}>
                <option value="all">Все прокси</option>
                <option value="with">Только с прокси</option>
                <option value="without">Только без прокси</option>
              </select>
            </div>
            <div className="col-12 col-lg-2 text-lg-end">
              <span className="text-muted small">Найдено: {filtered.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card shadow-sm">
        <div className="table-responsive" style={{ maxHeight: "62vh" }}>
          <table className="table table-hover align-middle m-0">
            <thead className="table-light sticky-top" style={{ top: 0, zIndex: 1 }}>
              <tr>
                <Th onClick={() => headerSort("phone")} active={sort.key === "phone"} dir={sort.dir}>Телефон</Th>
                <Th onClick={() => headerSort("geo")} active={sort.key === "geo"} dir={sort.dir}>Гео</Th>
                <Th onClick={() => headerSort("status")} active={sort.key === "status"} dir={sort.dir}>Статус</Th>
                <Th onClick={() => headerSort("role")} active={sort.key === "role"} dir={sort.dir}>Роль</Th>
                <Th onClick={() => headerSort("name")} active={sort.key === "name"} dir={sort.dir}>Имя</Th>
                <Th onClick={() => headerSort("last_used")} active={sort.key === "last_used"} dir={sort.dir}>Последний вход</Th>
                <th style={{ width: 260 }}>Прокси / Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows/>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-5 text-muted">
                    Ничего не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map((acc) => (
                  <tr key={acc.id}>
                    <td className="fw-semibold">{acc.phone}</td>
                    <td>{acc.geo || "-"}</td>
                    <td>{badge(acc.status)}</td>
                    <td>{acc.role || "-"}</td>
                    <td>{acc.name || "-"}</td>
                    <td className="text-muted">
                      {acc.last_used ? new Date(acc.last_used).toLocaleString() : "—"}
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="badge bg-outline border text-nowrap text-dark">
                          {getProxyLabel(acc)}
                        </span>

                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            title="Сменить прокси"
                            onClick={() => setEditingId((p) => (p === acc.id ? null : acc.id))}
                          >
                            ⚙️
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            title="Обучить"
                            onClick={() => trainAccount(acc.id)}
                          >
                            🧠
                          </button>
                          {acc.invite_task_id ? (
                            <button className="btn btn-sm btn-danger" onClick={() => stopInvite(acc.id)}>
                              🛑
                            </button>
                          ) : null}
                          <button
                            className="btn btn-sm btn-outline-danger"
                            title="Удалить"
                            onClick={() => deleteAccount(acc.id)}
                          >
                            🗑️
                          </button>
                        </div>

                        <select
                          className={`form-select form-select-sm ${editingId === acc.id ? "" : "d-none"}`}
                          onChange={(e) => {
                            const value = e.target.value;
                            changeProxy(acc.id, value === "null" ? null : value);
                          }}
                          defaultValue=""
                          style={{ minWidth: 220 }}
                        >
                          <option disabled value="">Выбери прокси</option>
                          <option value="null">🚫 Без прокси</option>
                          {proxies.map((p) => (
                            <option key={p.id} value={p.id}>
                              {(p.proxy_type || "").toUpperCase()} {p.host}:{p.port}
                            </option>
                          ))}
                        </select>

                        <select
                          className="form-select form-select-sm"
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) addAccountToChannel(acc.id, val);
                          }}
                          defaultValue=""
                          style={{ minWidth: 180 }}
                        >
                          <option value="">➕ В канал</option>
                          {channels.map((ch) => (
                            <option key={ch.id} value={ch.id}>
                              {ch.username}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger shadow-sm">{error}</div>
      )}
    </div>
  );
}

function KPI({ title, value, icon, accent = "secondary" }) {
  return (
    <div className="col-6 col-lg-3">
      <div className={`card border-0 shadow-sm h-100 bg-${accent}-subtle`}> 
        <div className="card-body d-flex align-items-center gap-3">
          <div style={{ fontSize: 28 }}>{icon}</div>
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

function SkeletonRows({ rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={7}>
            <div className="placeholder-wave">
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-1 me-2"></span>
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-3"></span>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
