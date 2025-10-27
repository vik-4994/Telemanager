import { useEffect, useMemo, useState } from "react";

/**
 * IntermediateChannels — Revamped UI
 * - Gradient header + card layout
 * - Add form with username normalizer (@user / t.me/user) and live validation
 * - Search, sort, count badge
 * - Collapsible rows show linked accounts; quick add account to a channel
 * - Copy @username, optimistic delete, subtle toasts, skeletons
 */
export default function IntermediateChannels() {
  const [channels, setChannels] = useState([]);
  const [accounts, setAccounts] = useState([]); // for quick-attach
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // add form
  const [rawUsername, setRawUsername] = useState("");
  const [adding, setAdding] = useState(false);

  // UI
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "username", dir: "asc" });
  const [expanded, setExpanded] = useState(() => new Set());

  const token = localStorage.getItem("access");
  const API = "http://127.0.0.1:8000/api/accounts";

  // ------------ Data ------------
  const fetchChannels = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/intermediate-channels/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChannels(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Не удалось загрузить список");
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API}/`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (_) {
      setAccounts([]);
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------ Helpers ------------
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
    if (!username) return "Введите @username";
    if (!/^@[A-Za-z0-9_]{3,}$/i.test(username)) return "Только латиница/цифры/_, от 3 символов";
    return "";
  }, [username]);

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast("Скопировано"); }
    catch { toast("Не удалось скопировать", true); }
  };

  const toggleExpand = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // ------------ Actions ------------
  const handleAdd = async (e) => {
    e?.preventDefault?.();
    if (usernameError) return;
    setAdding(true);
    try {
      const res = await fetch(`${API}/intermediate-channels/add/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("✅ Канал добавлен");
        setRawUsername("");
        fetchChannels();
      } else {
        toast(data?.error || "Не удалось добавить", true);
      }
    } catch (_) {
      toast("Ошибка соединения", true);
    } finally { setAdding(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить этот канал?")) return;
    const prev = channels;
    setChannels((list) => list.filter((c) => c.id !== id));
    try {
      const res = await fetch(`${API}/intermediate-channels/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast("Канал удалён");
    } catch (_) {
      setChannels(prev); // rollback
      toast("Ошибка при удалении", true);
    }
  };

  const addAccountToChannel = async (channelId, accountId) => {
    if (!accountId) return;
    try {
      const res = await fetch(`${API}/intermediate-channels/${channelId}/add_account/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId }),
      });
      const ok = res.ok;
      if (ok) toast("Запущено добавление аккаунта в канал");
      else {
        const data = await res.json().catch(()=>({}));
        toast(data?.error || "Не удалось добавить аккаунт", true);
      }
    } catch (_) {
      toast("Ошибка соединения", true);
    }
  };

  // ------------ Derived ------------
  const normalize = (v) => (v ?? "").toString().toLowerCase().trim();

  const filtered = useMemo(() => {
    const query = normalize(q);
    let rows = [...channels];
    if (query) {
      rows = rows.filter((c) => [c.username, c.title].some((s) => normalize(s).includes(query)));
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const sa = normalize(a[sort.key]);
      const sb = normalize(b[sort.key]);
      return sa.localeCompare(sb) * dir;
    });
    return rows;
  }, [channels, q, sort]);

  // ------------ Render ------------
  return (
    <div className="container py-4" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #6f42c1 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <div>
            <div className="opacity-75">Вспомогательные источники</div>
            <h2 className="m-0">Каналы‑переходники</h2>
          </div>
          <button className="btn btn-light" onClick={fetchChannels}>⟳ Обновить</button>
        </div>
      </div>

      {/* Add form */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <form className="row g-3 align-items-end" onSubmit={handleAdd}>
            <div className="col-12 col-lg-7">
              <label className="form-label">Username</label>
              <div className="input-group">
                <span className="input-group-text">@</span>
                <input
                  type="text"
                  className={`form-control ${usernameError && rawUsername ? 'is-invalid' : ''}`}
                  value={rawUsername}
                  onChange={(e) => setRawUsername(e.target.value)}
                  placeholder="@username или ссылка t.me/username"
                  required
                />
                {username && (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => copy(username)} title="Скопировать">
                    📋
                  </button>
                )}
                <div className="invalid-feedback">{usernameError}</div>
              </div>
              <div className="form-text">Мы автоматически приведём значение к формату <code>@username</code>.</div>
            </div>
            <div className="col-12 col-lg-3">
              <label className="form-label">Быстро добавить аккаунт</label>
              <select className="form-select" defaultValue="" onChange={(e) => e.target.value && addAccountToChannel('__new__', e.target.value)} disabled>
                <option value="">Выберите аккаунт (скоро)</option>
              </select>
              <div className="form-text">Добавление при создании можно будет включить позже.</div>
            </div>
            <div className="col-12 col-lg-2 text-lg-end">
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
                <input className="form-control" placeholder="Поиск: @username / название" value={q} onChange={(e)=>setQ(e.target.value)} />
                {q && <button className="btn btn-outline-secondary" onClick={()=>setQ("")}>✖</button>}
              </div>
            </div>
            <div className="col-12 col-lg-6 text-lg-end">
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
                <Th label="Username" k="username" sort={sort} setSort={setSort} />
                <Th label="Название" k="title" sort={sort} setSort={setSort} />
                <th style={{ width: 400 }}>Аккаунты</th>
                <th style={{ width: 240 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows/>
              ) : error ? (
                <tr><td colSpan={4} className="text-danger p-4">{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted p-5">Каналов пока нет</td></tr>
              ) : (
                filtered.map((ch) => {
                  const isOpen = expanded.has(ch.id);
                  const accs = Array.isArray(ch.accounts) ? ch.accounts : [];
                  return (
                    <tr key={ch.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleExpand(ch.id)} title={isOpen? 'Свернуть' : 'Развернуть'}>
                            {isOpen ? '▾' : '▸'}
                          </button>
                          <span className="fw-semibold">{ch.username}</span>
                          <button className="btn btn-sm btn-outline-secondary" title="Скопировать" onClick={() => copy(ch.username)}>📋</button>
                        </div>
                        {isOpen && (
                          <div className="small text-muted mt-1">{ch.title || '—'}</div>
                        )}
                      </td>
                      <td>{ch.title || '—'}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-2 align-items-center">
                          {accs.length === 0 ? (
                            <span className="text-muted">Нет привязанных аккаунтов</span>
                          ) : (
                            accs.slice(0, 5).map((p, idx) => (
                              <span key={idx} className="badge bg-secondary-subtle text-dark border">{p}</span>
                            ))
                          )}
                          {accs.length > 5 && <span className="badge bg-light text-dark">+{accs.length - 5}</span>}
                          <select
                            className="form-select form-select-sm"
                            style={{ minWidth: 160 }}
                            defaultValue=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) addAccountToChannel(ch.id, val);
                              e.target.value = "";
                            }}
                          >
                            <option value="">➕ Добавить аккаунт</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.phone} {a.name ? `— ${a.name}` : ''}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(ch.id)}>🗑️ Удалить</button>
                        </div>
                      </td>
                    </tr>
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

function Th({ label, k, sort, setSort }) {
  const active = sort.key === k;
  const dir = active ? sort.dir : 'asc';
  return (
    <th role="button" onClick={() => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }))} className="text-nowrap">
      <span className="d-inline-flex align-items-center gap-1">
        {label}
        {active && <span className="small text-muted">{dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}

function SkeletonRows({ rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={4}>
            <div className="placeholder-wave">
              <span className="placeholder col-3 me-2"></span>
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-4 me-2"></span>
              <span className="placeholder col-1"></span>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}