import { useEffect, useMemo, useState } from "react";

/**
 * AddProxy — Revamped UI
 * - Gradient header + card layout
 * - Single-add form with live validation & show/hide password
 * - Bulk import tab: paste or upload .txt, auto-parse (proto://user:pass@host:port)
 * - Duplicate detection vs existing proxies, progress bar, per-row status
 * - No extra deps; pure React + Bootstrap
 */
export default function AddProxy() {
  const [tab, setTab] = useState("single");

  // Single add state
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [proxyType, setProxyType] = useState("http"); // http | https | socks5
  const [showPass, setShowPass] = useState(false);

  // Bulk state
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState([]); // [{raw, ok, error, item}]
  const [bulkProgress, setBulkProgress] = useState({ running: false, done: 0, total: 0 });

  // Common
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [proxies, setProxies] = useState([]);

  const token = localStorage.getItem("access");
  const API = "http://127.0.0.1:8000/api/accounts/proxies/";

  // ---- Existing proxies (for duplicates) ----
  const loadProxies = async () => {
    try {
      const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setProxies(Array.isArray(data) ? data : []);
    } catch (e) {
      setProxies([]);
    }
  };
  useEffect(() => { loadProxies(); /* eslint-disable-next-line */ }, []);

  // ---- Helpers ----
  const normalizedKey = (p) => `${(p.proxy_type||"").toLowerCase()}://${(p.host||"").trim().toLowerCase()}:${p.port}`;
  const existingKeys = useMemo(() => new Set(proxies.map(normalizedKey)), [proxies]);

  const isValidHost = (h) => {
    if (!h) return false;
    // very lenient: domain or IPv4/IPv6 literal
    const isIP4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h);
    const isIP6 = /:/.test(h);
    const isDomain = /[a-zA-Z]/.test(h) && h.indexOf(" ") === -1;
    return isIP4 || isIP6 || isDomain;
  };
  const isValidPort = (p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 1 && n <= 65535;
  };

  const canSubmitSingle = useMemo(() => {
    return !loading && isValidHost(host) && isValidPort(port) && ["http","https","socks5"].includes(proxyType);
  }, [loading, host, port, proxyType]);

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

  // ---- Single submit ----
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(""); setError("");
    if (!canSubmitSingle) return;
    setLoading(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ host: host.trim(), port: Number(port), proxy_type: proxyType, username, password }),
      });
      if (res.ok) {
        setSuccess("✅ Прокси добавлен"); toast("Прокси добавлен");
        setHost(""); setPort(""); setUsername(""); setPassword("");
        loadProxies();
      } else {
        const data = await res.json().catch(()=>({}));
        const msg = data?.error || JSON.stringify(data) || "Ошибка добавления";
        setError(msg); toast(msg, true);
      }
    } catch (e) {
      setError("Ошибка сети"); toast("Ошибка сети", true);
    } finally { setLoading(false); }
  };

  // ---- Bulk parsing ----
  const parseLine = (raw) => {
    const line = raw.trim();
    if (!line) return { ok: false, error: "пустая строка" };

    try {
      // URL-like: proto://user:pass@host:port
      if (/^\w+:\/\//i.test(line)) {
        const u = new URL(line);
        const proto = (u.protocol.replace(":","") || "").toLowerCase();
        const item = {
          proxy_type: proto === "socks" ? "socks5" : proto, // normalize
          host: u.hostname,
          port: Number(u.port),
          username: decodeURIComponent(u.username || ""),
          password: decodeURIComponent(u.password || ""),
        };
        if (!isValidHost(item.host)) return { ok: false, error: "host" };
        if (!isValidPort(item.port)) return { ok: false, error: "port" };
        if (!["http","https","socks5"].includes(item.proxy_type)) item.proxy_type = "http";
        return { ok: true, item };
      }

      // user:pass@host:port OR host:port
      const at = line.includes("@");
      const [cred, rest] = at ? line.split("@") : [null, line];
      const [h, p] = rest.split(":");
      if (!h || !p) return { ok: false, error: "формат" };
      const item = {
        proxy_type: "http", // default; user can change later
        host: h,
        port: Number(p),
        username: "",
        password: "",
      };
      if (cred) {
        const [u, pw] = cred.split(":");
        item.username = u || ""; item.password = pw || "";
      }
      if (!isValidHost(item.host)) return { ok: false, error: "host" };
      if (!isValidPort(item.port)) return { ok: false, error: "port" };
      return { ok: true, item };
    } catch (_) {
      return { ok: false, error: "парсинг" };
    }
  };

  const buildBulk = () => {
    const rows = bulkText.split(/\r?\n/).map((r) => {
      const parsed = parseLine(r);
      if (!parsed.ok) return { raw: r, ok: false, error: parsed.error };
      const dup = existingKeys.has(normalizedKey(parsed.item));
      return { raw: r, ok: true, item: parsed.item, duplicate: dup, status: "pending" };
    });
    setBulkRows(rows);
  };

  const onBulkFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    setBulkText(text);
    setTimeout(buildBulk, 0);
  };

  useEffect(() => {
    // Recompute on edit
    // debounce small
    const id = setTimeout(buildBulk, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [bulkText, proxies]);

  const bulkValid = useMemo(() => bulkRows.filter((r) => r.ok && !r.duplicate), [bulkRows]);

  const startBulkImport = async () => {
    const rows = bulkValid;
    if (!rows.length) return;
    setBulkProgress({ running: true, done: 0, total: rows.length });

    let done = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(r.item),
        });
        if (res.ok) {
          rows[i] = { ...r, status: "ok" };
          done++;
          setBulkProgress({ running: true, done, total: rows.length });
        } else {
          const data = await res.json().catch(()=>({}));
          rows[i] = { ...r, status: `err: ${data?.error || res.status}` };
        }
      } catch (e) {
        rows[i] = { ...r, status: "err: network" };
      }
      setBulkRows([...rows]);
    }

    setBulkProgress((p) => ({ ...p, running: false }));
    loadProxies();
    toast(`Импорт завершён: ${done}/${rows.length}`);
  };

  // ---- Render ----
  return (
    <div className="container py-4" style={{ maxWidth: 980 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #fd7e14 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="opacity-75">Сетевые настройки</div>
            <h2 className="m-0">Добавить прокси</h2>
          </div>
          <div className="btn-group">
            <button className={`btn ${tab==='single'?'btn-light':'btn-outline-light'}`} onClick={()=>setTab('single')}>➕ Одиночный</button>
            <button className={`btn ${tab==='bulk'?'btn-light':'btn-outline-light'}`} onClick={()=>setTab('bulk')}>📥 Массовый импорт</button>
          </div>
        </div>
      </div>

      {tab === 'single' ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label">Тип</label>
                  <select className="form-select" value={proxyType} onChange={(e)=>setProxyType(e.target.value)}>
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>
                <div className="col-12 col-md-5">
                  <label className="form-label">Host</label>
                  <input type="text" className={`form-control ${host && !isValidHost(host) ? 'is-invalid' : ''}`} value={host} onChange={(e)=>setHost(e.target.value)} placeholder="example.com или 1.2.3.4" required />
                  {host && !isValidHost(host) && <div className="invalid-feedback">Некорректный хост</div>}
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Port</label>
                  <input type="number" className={`form-control ${port && !isValidPort(port) ? 'is-invalid' : ''}`} value={port} onChange={(e)=>setPort(e.target.value)} placeholder="8080" required />
                  {port && !isValidPort(port) && <div className="invalid-feedback">1–65535</div>}
                </div>
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Username (опционально)</label>
                  <input type="text" className="form-control" value={username} onChange={(e)=>setUsername(e.target.value)} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Password (опционально)</label>
                  <div className="input-group">
                    <input type={showPass? 'text':'password'} className="form-control" value={password} onChange={(e)=>setPassword(e.target.value)} />
                    <button type="button" className="btn btn-outline-secondary" onClick={()=>setShowPass((s)=>!s)}>{showPass? 'Скрыть':'Показать'}</button>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2 mt-2">
                <button type="submit" className="btn btn-primary" disabled={!canSubmitSingle || loading}>
                  {loading ? 'Добавление…' : 'Добавить'}
                </button>
                <small className="text-muted">Проверяйте, что тип соответствует серверу прокси.</small>
              </div>

              {success && <div className="alert alert-success m-0">{success}</div>}
              {error && <div className="alert alert-danger m-0">{error}</div>}
            </form>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div>
                <h5 className="m-0">Массовый импорт</h5>
                <div className="text-muted small">Поддерживаются строки формата <code>proto://user:pass@host:port</code> или <code>user:pass@host:port</code> / <code>host:port</code>.</div>
              </div>
              <div>
                <label className="btn btn-outline-secondary me-2">
                  📄 Загрузить .txt
                  <input type="file" accept=".txt" className="d-none" onChange={(e)=>onBulkFile(e.target.files?.[0])} />
                </label>
                <button className="btn btn-outline-primary" onClick={startBulkImport} disabled={bulkProgress.running || bulkValid.length === 0}>
                  {bulkProgress.running ? `Импорт… ${bulkProgress.done}/${bulkProgress.total}` : `Импортировать (${bulkValid.length})`}
                </button>
              </div>
            </div>

            <textarea
              className="form-control"
              style={{ minHeight: 160 }}
              placeholder={`Примеры:\nhttp://user:pass@1.2.3.4:8080\nsocks5://5.6.7.8:1080\n1.2.3.4:3128`}
              value={bulkText}
              onChange={(e)=>setBulkText(e.target.value)}
            />

            <div className="mt-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                <div className="small text-muted">Всего строк: {bulkRows.length}. Корректные: {bulkRows.filter(r=>r.ok).length}. Дубликаты: {bulkRows.filter(r=>r.duplicate).length}.</div>
                {bulkProgress.running && (
                  <div className="flex-grow-1 ms-lg-3">
                    <div className="progress" role="progressbar" aria-valuenow={(bulkProgress.done*100)/(bulkProgress.total||1)} aria-valuemin="0" aria-valuemax="100">
                      <div className="progress-bar" style={{ width: `${(bulkProgress.done*100)/(bulkProgress.total||1)}%` }}>
                        {bulkProgress.done}/{bulkProgress.total}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="table-responsive" style={{ maxHeight: 360 }}>
                <table className="table table-sm table-hover align-middle m-0">
                  <thead className="table-light sticky-top" style={{ top: 0 }}>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Строка</th>
                      <th>Разбор</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-muted p-4">Нет данных</td></tr>
                    ) : bulkRows.map((r, i) => (
                      <tr key={i}>
                        <td className="text-muted">{i+1}</td>
                        <td><code>{r.raw || <span className="text-muted">—</span>}</code></td>
                        <td>
                          {r.ok ? (
                            <span className="text-nowrap">
                              <span className="badge bg-primary-subtle text-dark border me-1">{r.item.proxy_type.toUpperCase()}</span>
                              <span className="badge bg-secondary-subtle text-dark border me-1">{r.item.host}:{r.item.port}</span>
                              {r.item.username && <span className="badge bg-secondary-subtle text-dark border">{r.item.username}</span>}
                              {r.duplicate && <span className="badge bg-warning text-dark ms-2">дубликат</span>}
                            </span>
                          ) : (
                            <span className="text-danger">ошибка: {r.error}</span>
                          )}
                        </td>
                        <td>
                          {r.status === 'ok' && <span className="badge bg-success">ok</span>}
                          {String(r.status).startsWith('err') && <span className="badge bg-danger">{r.status}</span>}
                          {!r.status && <span className="text-muted">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}