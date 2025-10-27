import { useEffect, useMemo, useState } from "react";

/**
 * InviteUsers — Revamped UI
 * - Gradient header + KPI cards
 * - Two-pane form: pick account & channel with search
 * - Interval slider + number input (5–600s) with hints
 * - Start/Stop controls, success/error toasts
 * - Live preview badges for the chosen account/channel
 * - Skeletons and graceful fallbacks
 */
export default function InviteUsers() {
  const [accounts, setAccounts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [accountId, setAccountId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [gap, setGap] = useState(30); // seconds

  const [msg, setMsg] = useState("");
  const [msgDanger, setMsgDanger] = useState(false);
  const [runningTask, setRunningTask] = useState(null); // { taskId, accountId }
  const [submitting, setSubmitting] = useState(false);

  // search boxes
  const [qAcc, setQAcc] = useState("");
  const [qCh, setQCh] = useState("");

  const token = localStorage.getItem("access");

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ---------- Fetch data ----------
  const pull = async () => {
    setLoading(true);
    setError("");
    try {
      const [ra, rc] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/accounts/", { headers }),
        fetch("http://127.0.0.1:8000/api/accounts/intermediate-channels/", { headers }),
      ]);
      const A = await ra.json();
      const C = await rc.json();
      setAccounts(Array.isArray(A) ? A : []);
      setChannels(Array.isArray(C) ? C : []);
    } catch (e) {
      setError("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { pull(); /* eslint-disable react-hooks/exhaustive-deps */ }, []);

  // ---------- Helpers ----------
  const toast = (text, danger = false) => {
    setMsg(text);
    setMsgDanger(danger);
    if (text) setTimeout(() => setMsg(""), 3500);
  };

  const normalize = (v) => (v ?? "").toString().toLowerCase().trim();

  const filteredAccounts = useMemo(() => {
    const q = normalize(qAcc);
    let list = Array.isArray(accounts) ? accounts : [];
    if (q) list = list.filter((a) => [a.phone, a.name, a.status, a.geo].some((x) => normalize(x).includes(q)));
    // Sort active first, then by phone
    list.sort((a, b) => {
      const as = normalize(a.status).includes("актив") ? 0 : 1;
      const bs = normalize(b.status).includes("актив") ? 0 : 1;
      if (as !== bs) return as - bs;
      return (normalize(a.phone) || "").localeCompare(normalize(b.phone) || "");
    });
    return list;
  }, [accounts, qAcc]);

  const filteredChannels = useMemo(() => {
    const q = normalize(qCh);
    let list = Array.isArray(channels) ? channels : [];
    if (q) list = list.filter((c) => [c.username, c.title].some((x) => normalize(x).includes(q)));
    list.sort((a, b) => (normalize(a.username) || "").localeCompare(normalize(b.username) || ""));
    return list;
  }, [channels, qCh]);

  const selectedAccount = useMemo(() => filteredAccounts.find((a) => String(a.id) === String(accountId)), [filteredAccounts, accountId]);
  const selectedChannel = useMemo(() => filteredChannels.find((c) => String(c.id) === String(channelId)), [filteredChannels, channelId]);

  const clampGap = (n) => {
    if (!Number.isFinite(n)) return 30;
    if (n < 5) return 5;
    if (n > 600) return 600;
    return Math.round(n);
  };

  // ---------- Actions ----------
  const startInvite = async (e) => {
    e?.preventDefault?.();
    if (!accountId || !channelId) {
      toast("Выберите аккаунт и канал", true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/accounts/invite/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId, channel_id: channelId, interval: Number(gap) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("✅ Инвайт запущен");
        if (data?.task_id) setRunningTask({ taskId: data.task_id, accountId });
      } else {
        toast(data?.error || "Ошибка запуска", true);
      }
    } catch (e) {
      toast("Ошибка соединения", true);
    } finally { setSubmitting(false); }
  };

  const stopInvite = async () => {
    if (!accountId) { toast("Сначала выберите аккаунт", true); return; }
    try {
      const res = await fetch("http://127.0.0.1:8000/api/accounts/invite/stop/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_id: accountId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRunningTask(null);
        toast("🛑 Задача остановлена");
      } else {
        toast(data?.error || "Не удалось остановить", true);
      }
    } catch (e) {
      toast("Ошибка соединения", true);
    }
  };

  // ---------- Render ----------
  return (
    <div className="container py-4" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #ff7a59 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Рассылки и рост</div>
            <h2 className="m-0">Массовый инвайтинг</h2>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-light" onClick={pull}>⟳ Обновить списки</button>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-3">
        <KPI title="Аккаунтов" value={accounts.length} icon="📱" accent="secondary"/>
        <KPI title="Каналов" value={channels.length} icon="📡" accent="primary"/>
        <KPI title="Интервал" value={`${gap}s`} icon="⏱" accent="info"/>
      </div>

      {/* Body */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {loading ? (
            <Skeleton />
          ) : (
            <form className="row g-4" onSubmit={startInvite}>
              {/* Accounts */}
              <div className="col-12 col-lg-6">
                <h5 className="mb-3">1) Выберите аккаунт</h5>
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
                {selectedAccount && (
                  <div className="small text-muted mt-2 d-flex flex-wrap gap-2">
                    <span className="badge bg-success-subtle text-dark border">📞 {selectedAccount.phone}</span>
                    {selectedAccount.name && <span className="badge bg-secondary-subtle text-dark border">👤 {selectedAccount.name}</span>}
                    {selectedAccount.status && <span className="badge bg-info-subtle text-dark border">{selectedAccount.status}</span>}
                    {selectedAccount.geo && <span className="badge bg-light text-dark border">🌍 {selectedAccount.geo}</span>}
                  </div>
                )}
              </div>

              {/* Channels */}
              <div className="col-12 col-lg-6">
                <h5 className="mb-3">2) Выберите канал‑переходник</h5>
                <div className="input-group mb-2">
                  <span className="input-group-text">🔎</span>
                  <input className="form-control" placeholder="Поиск по @username/названию" value={qCh} onChange={(e)=>setQCh(e.target.value)} />
                  {qCh && <button className="btn btn-outline-secondary" type="button" onClick={()=>setQCh("")}>✖</button>}
                </div>
                <select className="form-select" size={8} value={channelId} onChange={(e)=>setChannelId(e.target.value)} required>
                  <option value="">— выберите канал —</option>
                  {filteredChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.username} {c.title ? `— ${c.title}` : ''}
                    </option>
                  ))}
                </select>
                {selectedChannel && (
                  <div className="small text-muted mt-2 d-flex flex-wrap gap-2">
                    <span className="badge bg-primary-subtle text-dark border">{selectedChannel.username}</span>
                    {selectedChannel.title && <span className="badge bg-secondary-subtle text-dark border">{selectedChannel.title}</span>}
                    {Array.isArray(selectedChannel.accounts) && selectedChannel.accounts.length > 0 && (
                      <span className="badge bg-light text-dark border">аккаунтов: {selectedChannel.accounts.length}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Interval + actions */}
              <div className="col-12">
                <div className="row g-3 align-items-center">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Интервал между инвайтами</label>
                    <div className="d-flex align-items-center gap-3">
                      <input type="range" className="form-range" min={5} max={600} step={1} value={gap} onChange={(e)=>setGap(clampGap(Number(e.target.value)))} />
                      <div className="input-group" style={{ width: 140 }}>
                        <input type="number" className="form-control" min={5} max={600} value={gap} onChange={(e)=>setGap(clampGap(Number(e.target.value)))} />
                        <span className="input-group-text">сек</span>
                      </div>
                    </div>
                    <div className="form-text">Рекомендуем ≥ 20–30 сек, чтобы снизить риск флуд-лимитов.</div>
                  </div>
                  <div className="col-12 col-md-6 text-md-end d-flex gap-2 justify-content-md-end">
                    <button type="submit" className="btn btn-success" disabled={submitting || !accountId || !channelId}>
                      {submitting ? "Запуск…" : "🚀 Запустить"}
                    </button>
                    <button type="button" className="btn btn-outline-danger" onClick={stopInvite} disabled={!accountId}>
                      🛑 Остановить
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert mt-3 ${msgDanger ? 'alert-danger' : 'alert-success'}`}>{msg}</div>
      )}

      {/* Notes */}
      <div className="alert alert-warning mt-3">
        ⚠️ Помните о лимитах Telegram. Если видите сообщения о flood wait — увеличьте интервал и поставьте прокси.
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

function Skeleton() {
  return (
    <div className="placeholder-wave">
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="placeholder col-12" style={{ height: 260 }}></div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="placeholder col-12" style={{ height: 260 }}></div>
        </div>
      </div>
    </div>
  );
}