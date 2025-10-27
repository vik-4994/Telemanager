import { useEffect, useMemo, useState } from "react";

/**
 * Broadcast — Revamped UI
 * - Gradient header + KPI cards (accounts / limit / interval)
 * - Two-pane layout: pick account (with search) + compose message
 * - Media preview (image/video) with remove button
 * - Interval slider + number input (2–300s), limit input (1–1000)
 * - Live ETA calculation and character counter
 * - Subtle toasts + clean alerts; skeletons while loading
 */
export default function Broadcast() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [accountId, setAccountId] = useState("");
  const [qAcc, setQAcc] = useState("");

  const [messageText, setMessageText] = useState("");
  const [limit, setLimit] = useState(100);
  const [gap, setGap] = useState(10); // seconds (was "interval" in backend payload)
  const [media, setMedia] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [danger, setDanger] = useState(false);

  const token = localStorage.getItem("access");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ------- Data fetch -------
  useEffect(() => {
    const pull = async () => {
      setLoading(true); setError("");
      try {
        const res = await fetch("http://127.0.0.1:8000/api/accounts/", { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
      } catch (_) {
        setError("Не удалось загрузить список аккаунтов");
      } finally {
        setLoading(false);
      }
    };
    pull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------- Helpers -------
  const normalize = (v) => (v ?? "").toString().toLowerCase().trim();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));
  const secondsToHms = (s) => {
    const sec = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const r = sec % 60;
    const pad = (x) => String(x).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
  };

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

  const canSubmit = useMemo(() => {
    return (
      !submitting &&
      String(accountId) &&
      messageText.trim().length > 0 &&
      limit >= 1 && limit <= 1000 &&
      gap >= 2 && gap <= 300
    );
  }, [submitting, accountId, messageText, limit, gap]);

  const onFile = (f) => {
    if (!f) return setMedia(null);
    if (!/^image\//.test(f.type) && !/^video\//.test(f.type)) {
      toast("Допустимы только изображения и видео", true);
      return;
    }
    setMedia(f);
  };

  const toast = (text, isDanger = false) => {
    setStatus(text);
    setDanger(isDanger);
    if (text) setTimeout(() => setStatus(""), 4000);
  };

  const etaSec = useMemo(() => clamp(limit, 0, 100000) * clamp(gap, 0, 3600), [limit, gap]);

  // ------- Submit -------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setDanger(false);
    toast("⏳ Запуск рассылки…");

    try {
      const formData = new FormData();
      formData.append("account_id", accountId);
      formData.append("message_text", messageText);
      formData.append("limit", String(limit));
      formData.append("interval", String(gap)); // backend expects "interval"
      if (media) formData.append("media", media);

      const res = await fetch("http://127.0.0.1:8000/api/accounts/broadcast/", {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("✅ Рассылка запущена");
      } else {
        toast(`❌ Ошибка: ${data?.error || res.status}`, true);
      }
    } catch (_) {
      toast("❌ Ошибка соединения", true);
    } finally {
      setSubmitting(false);
    }
  };

  // ------- Render -------
  return (
    <div className="container py-4" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #e83e8c 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Рассылки и рост</div>
            <h2 className="m-0">📨 Массовая рассылка в ЛС</h2>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-light" onClick={() => window.history.back()}>← Назад</button>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-3">
        <KPI title="Аккаунтов" value={accounts.length} icon="📱" accent="secondary"/>
        <KPI title="Лимит" value={limit} icon="🎯" accent="primary"/>
        <KPI title="Интервал" value={`${gap}s`} icon="⏱" accent="info"/>
      </div>

      {/* Body */}
      <form className="card border-0 shadow-sm" onSubmit={handleSubmit}>
        <div className="card-body">
          {loading ? (
            <Skeleton/>
          ) : (
            <div className="row g-4">
              {/* Accounts panel */}
              <div className="col-12 col-lg-5">
                <h5 className="mb-3">1) Выберите аккаунт</h5>
                <div className="input-group mb-2">
                  <span className="input-group-text">🔎</span>
                  <input className="form-control" placeholder="Поиск по телефону/имени/статусу" value={qAcc} onChange={(e)=>setQAcc(e.target.value)} />
                  {qAcc && <button className="btn btn-outline-secondary" type="button" onClick={()=>setQAcc("")}>✖</button>}
                </div>
                <select className="form-select" size={10} value={accountId} onChange={(e)=>setAccountId(e.target.value)} required>
                  <option value="">— выберите аккаунт —</option>
                  {filteredAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.phone} {a.name ? `— ${a.name}` : ''} {a.status ? ` [${a.status}]` : ''}
                    </option>
                  ))}
                </select>
                {accountId && (
                  <div className="small text-muted mt-2">От имени выбранного аккаунта будет отправлено до {limit} сообщений с паузой {gap}с.</div>
                )}
              </div>

              {/* Composer */}
              <div className="col-12 col-lg-7">
                <h5 className="mb-3">2) Составьте сообщение</h5>
                <div className="mb-3">
                  <label className="form-label">Текст</label>
                  <textarea
                    className="form-control"
                    rows={6}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Напишите текст рассылки…"
                    required
                  />
                  <div className="d-flex justify-content-between small text-muted mt-1">
                    <span>Используйте корректный и дружелюбный текст. Избегайте спама.</span>
                    <span>{messageText.length} символов</span>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Медиафайл (необязательно)</label>
                    <input type="file" className="form-control" accept="image/*,video/*" onChange={(e) => onFile(e.target.files?.[0])} />
                    {media && (
                      <div className="mt-2 d-flex align-items-center gap-3">
                        {/^image\//.test(media.type) && (
                          <img alt="preview" src={URL.createObjectURL(media)} style={{ maxWidth: 160, maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />
                        )}
                        {/^video\//.test(media.type) && (
                          <video src={URL.createObjectURL(media)} style={{ maxWidth: 220, maxHeight: 140, borderRadius: 8 }} controls muted />
                        )}
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setMedia(null)}>Удалить</button>
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Параметры отправки</label>
                    <div className="row g-2 align-items-center">
                      <div className="col-6">
                        <div className="input-group">
                          <span className="input-group-text">🎯</span>
                          <input type="number" className="form-control" min={1} max={1000} value={limit} onChange={(e)=>setLimit(clamp(e.target.value,1,1000))} required />
                          <span className="input-group-text">шт</span>
                        </div>
                        <div className="form-text">Сколько получателей обработать (max 1000)</div>
                      </div>
                      <div className="col-6">
                        <div className="input-group">
                          <span className="input-group-text">⏱</span>
                          <input type="number" className="form-control" min={2} max={300} value={gap} onChange={(e)=>setGap(clamp(e.target.value,2,300))} required />
                          <span className="input-group-text">сек</span>
                        </div>
                        <input type="range" className="form-range mt-2" min={2} max={300} step={1} value={gap} onChange={(e)=>setGap(clamp(e.target.value,2,300))} />
                      </div>
                    </div>
                    <div className="small text-muted mt-1">Оценка длительности: ~ {secondsToHms(etaSec)}</div>
                  </div>
                </div>

                <div className="d-flex gap-2 mt-3 justify-content-end">
                  <button type="submit" className="btn btn-success" disabled={!canSubmit}>
                    {submitting ? "Запуск…" : "📤 Запустить рассылку"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>

      {status && (
        <div className={`alert mt-3 ${danger ? 'alert-danger' : 'alert-info'}`}>{status}</div>
      )}

      <div className="alert alert-warning mt-3">
        ⚠️ Соблюдайте лимиты Telegram. Если появляются ошибки flood wait — увеличьте интервал, сократите лимит и используйте качественные прокси.
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
        <div className="col-12 col-lg-5"><div className="placeholder col-12" style={{ height: 300 }}></div></div>
        <div className="col-12 col-lg-7"><div className="placeholder col-12" style={{ height: 300 }}></div></div>
      </div>
    </div>
  );
}