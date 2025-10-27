import { useEffect, useMemo, useState } from "react";

/**
 * CreateForwardingTask — Revamped UI
 * - Gradient header + KPI (accounts / active groups / interval)
 * - Smart source normalizer: accepts @user, t.me/user, or numeric chat ID (-100...)
 * - Two-pane picker: choose account with search; choose multiple groups with search + badges
 * - Interval slider (1–240 min) + input; optional jitter UI (not sent to backend)
 * - Clean toasts, skeletons, optimistic UX
 * - Payload is backward-compatible with existing backend: {source_channel, account, target_groups, interval_minutes}
 */
export default function CreateForwardingTask() {
  const token = localStorage.getItem("access");

  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // form state
  const [rawSource, setRawSource] = useState("");
  const [accountId, setAccountId] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]); // ids
  const [interval, setInterval] = useState(60);

  // ui helpers
  const [qAcc, setQAcc] = useState("");
  const [qGroup, setQGroup] = useState("");
  const [msg, setMsg] = useState("");
  const [danger, setDanger] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jitter, setJitter] = useState(0); // visual only

  // ------ fetch data ------
  useEffect(() => {
    const pull = async () => {
      setLoading(true); setError("");
      try {
        const [ra, rg] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/accounts/", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("http://127.0.0.1:8000/api/forwarding/groups/", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const A = await ra.json();
        const G = await rg.json();
        setAccounts(Array.isArray(A) ? A : []);
        setGroups((Array.isArray(G) ? G : []).filter((g) => g.is_active));
      } catch (_) {
        setError("Не удалось загрузить данные");
      } finally { setLoading(false); }
    };
    pull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------ helpers ------
  const toast = (text, isDanger = false) => {
    setMsg(text);
    setDanger(isDanger);
    if (text) setTimeout(() => setMsg("") , 3500);
  };

  const normalize = (v) => (v ?? "").toString().toLowerCase().trim();

  const normalizeSource = (raw) => {
    if (!raw) return "";
    let v = String(raw).trim();
    // numeric id passes through (e.g., -1001234567890)
    if (/^-?\d+$/.test(v)) return v;
    try {
      if (v.startsWith("http://") || v.startsWith("https://")) {
        const u = new URL(v);
        if (u.hostname.replace(/^www\./, "") === "t.me") v = u.pathname.replace(/^\//, "");
      }
    } catch(_){}
    v = v.replace(/\s+/g, "");
    if (!v) return "";
    if (!v.startsWith("@")) v = "@" + v;
    return v;
  };

  const source = useMemo(() => normalizeSource(rawSource), [rawSource]);
  const sourceError = useMemo(() => {
    if (!source) return "Укажите источник";
    if (/^-?\d+$/.test(source)) return ""; // id ok
    if (!/^@[A-Za-z0-9_]{3,}$/i.test(source)) return "Только латиница/цифры/_, от 3 символов";
    return "";
  }, [source]);

  const filteredAccounts = useMemo(() => {
    const q = normalize(qAcc);
    let list = [...accounts];
    if (q) list = list.filter((a) => [a.phone, a.name, a.status, a.geo].some((x) => normalize(x).includes(q)));
    // active first
    list.sort((a, b) => {
      const ai = normalize(a.status).includes("актив") ? 0 : 1;
      const bi = normalize(b.status).includes("актив") ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return (normalize(a.phone) || "").localeCompare(normalize(b.phone) || "");
    });
    return list;
  }, [accounts, qAcc]);

  const filteredGroups = useMemo(() => {
    const q = normalize(qGroup);
    let list = [...groups];
    if (q) list = list.filter((g) => normalize(g.username).includes(q));
    list.sort((a, b) => (normalize(a.username) || "").localeCompare(normalize(b.username) || ""));
    return list;
  }, [groups, qGroup]);

  const toggleGroup = (id) => {
    setSelectedGroups((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const removeGroup = (id) => setSelectedGroups((prev) => prev.filter((x) => x !== id));
  const selectAllFiltered = () => setSelectedGroups([...new Set([...selectedGroups, ...filteredGroups.map(g => g.id)])]);
  const clearSelected = () => setSelectedGroups([]);

  const canSubmit = useMemo(() => {
    return (
      !submitting &&
      !sourceError &&
      String(accountId) &&
      selectedGroups.length > 0 &&
      Number.isFinite(Number(interval)) && Number(interval) >= 1 && Number(interval) <= 240
    );
  }, [submitting, sourceError, accountId, selectedGroups, interval]);

  // ------ submit ------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    toast("⏳ Создаём задачу…");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/forwarding/tasks/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_channel: source,
          account: accountId,
          target_groups: selectedGroups,
          interval_minutes: Number(interval),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("✅ Задача создана");
        setRawSource("");
        setAccountId("");
        setSelectedGroups([]);
        setInterval(60);
      } else {
        toast("❌ Ошибка: " + (data?.detail || data?.error || res.status), true);
      }
    } catch (_) {
      toast("❌ Ошибка соединения", true);
    } finally {
      setSubmitting(false);
    }
  };

  // ------ stats ------
  const stats = useMemo(() => ({
    accounts: accounts.length,
    groups: groups.length,
    interval,
  }), [accounts, groups, interval]);

  // ------ render ------
  return (
    <div className="container py-4" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #1abc9c 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Пересылка контента</div>
            <h2 className="m-0">⚙️ Создание задачи пересылки</h2>
          </div>
          <button className="btn btn-light" onClick={() => window.history.back()}>← Назад</button>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-3">
        <KPI title="Аккаунтов" value={stats.accounts} icon="📱" accent="secondary"/>
        <KPI title="Активных групп" value={stats.groups} icon="👥" accent="primary"/>
        <KPI title="Интервал" value={`${stats.interval} мин`} icon="⏱" accent="info"/>
      </div>

      <form className="card border-0 shadow-sm" onSubmit={handleSubmit}>
        <div className="card-body">
          {loading ? (
            <Skeleton/>
          ) : error ? (
            <div className="alert alert-danger m-0">{error}</div>
          ) : (
            <div className="row g-4">
              {/* Left: source + account */}
              <div className="col-12 col-lg-5">
                <h5 className="mb-3">1) Источник и аккаунт</h5>

                {/* Source */}
                <div className="mb-3">
                  <label className="form-label">Канал-источник</label>
                  <div className="input-group">
                    <span className="input-group-text">@</span>
                    <input
                      type="text"
                      className={`form-control ${sourceError && rawSource ? 'is-invalid' : ''}`}
                      placeholder="@username, t.me/username или -1001234567890"
                      value={rawSource}
                      onChange={(e)=>setRawSource(e.target.value)}
                      required
                    />
                    <div className="invalid-feedback">{sourceError}</div>
                  </div>
                  {source && (
                    <div className="small text-muted mt-1">Нормализовано: <code>{source}</code></div>
                  )}
                </div>

                {/* Account */}
                <div className="mb-3">
                  <label className="form-label">Аккаунт</label>
                  <div className="input-group mb-2">
                    <span className="input-group-text">🔎</span>
                    <input className="form-control" placeholder="Поиск по телефону/имени/статусу" value={qAcc} onChange={(e)=>setQAcc(e.target.value)} />
                    {qAcc && <button className="btn btn-outline-secondary" type="button" onClick={()=>setQAcc("")}>✖</button>}
                  </div>
                  <select className="form-select" size={8} value={accountId} onChange={(e)=>setAccountId(e.target.value)} required>
                    <option value="">— выберите аккаунт —</option>
                    {filteredAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.phone} {a.name ? `— ${a.name}` : ''} {a.status ? ` [${a.status}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Interval */}
                <div className="mb-3">
                  <label className="form-label">Интервал проверок</label>
                  <div className="row g-2 align-items-center">
                    <div className="col-7">
                      <input type="range" className="form-range" min={1} max={240} step={1} value={interval} onChange={(e)=>setInterval(Number(e.target.value))} />
                    </div>
                    <div className="col-5">
                      <div className="input-group">
                        <input type="number" className="form-control" min={1} max={240} value={interval} onChange={(e)=>setInterval(Number(e.target.value))} required />
                        <span className="input-group-text">мин</span>
                      </div>
                    </div>
                  </div>
                  <div className="form-text">Раз в столько минут будет проверяться источник на новые посты.</div>
                </div>
              </div>

              {/* Right: groups */}
              <div className="col-12 col-lg-7">
                <h5 className="mb-3">2) Группы‑получатели</h5>

                <div className="input-group mb-2">
                  <span className="input-group-text">🔎</span>
                  <input className="form-control" placeholder="Фильтр по @username" value={qGroup} onChange={(e)=>setQGroup(e.target.value)} />
                  {qGroup && <button className="btn btn-outline-secondary" type="button" onClick={()=>setQGroup("")}>✖</button>}
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={selectAllFiltered}>Выбрать все (фильтр)</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearSelected}>Очистить выбор</button>
                  <span className="text-muted small ms-auto">Выбрано: {selectedGroups.length}</span>
                </div>

                <div className="border rounded-3" style={{ maxHeight: 300, overflow: 'auto' }}>
                  <table className="table table-sm table-hover align-middle m-0">
                    <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ width: 56 }}></th>
                        <th>Username</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroups.length === 0 ? (
                        <tr><td colSpan={2} className="text-center text-muted p-4">Нет подходящих групп</td></tr>
                      ) : (
                        filteredGroups.map((g) => (
                          <tr key={g.id} role="button" onClick={() => toggleGroup(g.id)}>
                            <td>
                              <input type="checkbox" className="form-check-input" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                            </td>
                            <td className="text-nowrap">{g.username}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Selected badges */}
                <div className="mt-3 d-flex flex-wrap gap-2">
                  {selectedGroups.length === 0 ? (
                    <span className="text-muted">Группы не выбраны</span>
                  ) : (
                    selectedGroups.map((id) => {
                      const g = groups.find((x) => x.id === id);
                      return (
                        <span key={id} className="badge bg-secondary-subtle text-dark border">
                          {g?.username || id}
                          <button type="button" className="btn btn-sm btn-link ms-1 p-0" onClick={() => removeGroup(id)}>✖</button>
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="submit" className="btn btn-success" disabled={!canSubmit}>
                  {submitting ? 'Создаём…' : '🚀 Создать задачу'}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => { setRawSource(''); setAccountId(''); setSelectedGroups([]); setInterval(60); }}>Сброс</button>
              </div>
            </div>
          )}
        </div>
      </form>

      {msg && (
        <div className={`alert mt-3 ${danger ? 'alert-danger' : 'alert-info'}`}>{msg}</div>
      )}
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

function Skeleton() {
  return (
    <div className="placeholder-wave">
      <div className="row g-4">
        <div className="col-12 col-lg-5"><div className="placeholder col-12" style={{ height: 320 }}></div></div>
        <div className="col-12 col-lg-7"><div className="placeholder col-12" style={{ height: 320 }}></div></div>
      </div>
    </div>
  );
}