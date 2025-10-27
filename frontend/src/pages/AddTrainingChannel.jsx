import { useEffect, useMemo, useState } from "react";

/**
 * AddTrainingChannel — Revamped UI
 * - Gradient header + clean card form
 * - Username normalizer (accepts @user or t.me/user)
 * - Live validation + duplicate hint (checks existing list)
 * - Segmented control for type
 * - Subtle toasts + loading states
 */
export default function AddTrainingChannel() {
  const [form, setForm] = useState({ username: "", title: "", type: "channel" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [danger, setDanger] = useState(false);
  const [dupExists, setDupExists] = useState(false);
  const [checkingDup, setCheckingDup] = useState(false);

  const token = localStorage.getItem("access");
  const API_CREATE = "http://127.0.0.1:8000/api/add-channel/";
  const API_LIST = "http://127.0.0.1:8000/api/channels/list/"; // для подсказки о дубликатах

  // ---------- Helpers ----------
  const toast = (msg, isDanger = false) => {
    setMessage(msg);
    setDanger(isDanger);
    if (msg) setTimeout(() => setMessage(""), 3500);
  };

  const normalizeUsername = (raw) => {
    if (!raw) return "";
    let v = String(raw).trim();
    // t.me/username → username
    try {
      if (v.startsWith("http://") || v.startsWith("https://")) {
        const u = new URL(v);
        if (u.hostname.replace("www.", "") === "t.me") v = u.pathname.replace(/^\//, "");
      }
    } catch (_) {}
    // убрать пробелы и @ на начало
    v = v.replace(/\s+/g, "");
    if (!v) return "";
    if (!v.startsWith("@")) v = "@" + v;
    return v;
  };

  const usernameError = useMemo(() => {
    const u = form.username;
    if (!u) return "Укажите username";
    if (!u.startsWith("@")) return "Должен начинаться с @";
    if (!/^@[A-Za-z0-9_]{3,}$/i.test(u)) return "Только латиница/цифры/_, от 3 символов";
    return "";
  }, [form.username]);

  const canSubmit = useMemo(() => {
    return !loading && !usernameError && ["channel", "group"].includes(form.type);
  }, [loading, usernameError, form.type]);

  // ---------- Duplicate hint (best-effort) ----------
  useEffect(() => {
    const u = form.username;
    if (!u || usernameError) { setDupExists(false); return; }
    let alive = true;
    setCheckingDup(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(API_LIST, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const exists = Array.isArray(data) && data.some((c) => (c.username || "").toLowerCase() === u.toLowerCase());
        if (alive) setDupExists(!!exists);
      } catch (_) {
        if (alive) setDupExists(false);
      } finally {
        if (alive) setCheckingDup(false);
      }
    }, 400);
    return () => { alive = false; clearTimeout(id); };
  }, [form.username]);

  // ---------- Handlers ----------
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onChangeUsername = (e) => {
    const v = normalizeUsername(e.target.value);
    update({ username: v });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(API_CREATE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("✅ Канал/группа добавлен(а)");
        setForm({ username: "", title: "", type: "channel" });
        setDupExists(false);
      } else {
        toast(data?.detail || data?.error || "Ошибка добавления", true);
      }
    } catch (err) {
      toast("Ошибка соединения", true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: 880 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #20c997 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Обучающие источники</div>
            <h2 className="m-0">Добавить канал / группу</h2>
          </div>
          <button
            className="btn btn-light"
            type="button"
            onClick={() => { setForm({ username: "", title: "", type: "channel" }); setDupExists(false); }}
          >
            ↺ Сброс
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <form className="d-flex flex-column gap-3" onSubmit={onSubmit}>
            <div>
              <label className="form-label">Username</label>
              <div className="input-group">
                <span className="input-group-text">@</span>
                <input
                  type="text"
                  className={`form-control ${usernameError ? 'is-invalid' : ''}`}
                  value={form.username}
                  onChange={onChangeUsername}
                  placeholder="@username или ссылка t.me/username"
                  required
                />
                {form.username && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => navigator.clipboard.writeText(form.username)}
                    title="Скопировать"
                  >📋</button>
                )}
                <div className="invalid-feedback">{usernameError}</div>
              </div>
              <div className="form-text">
                Принимается <code>@username</code> или ссылка вида <code>https://t.me/username</code> — мы приведём к формату @username автоматически.
              </div>
              {checkingDup ? (
                <div className="small text-muted mt-1">Проверяем наличие…</div>
              ) : dupExists ? (
                <div className="small text-warning mt-1">Похоже, этот источник уже есть в списке.</div>
              ) : null}
            </div>

            <div>
              <label className="form-label">Название (опционально)</label>
              <input
                type="text"
                className="form-control"
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Например: Полезные статьи по ML"
              />
            </div>

            <div>
              <label className="form-label">Тип</label>
              <div className="btn-group" role="group" aria-label="Тип канала">
                {(["channel", "group"]).map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`btn ${form.type === t ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => update({ type: t })}
                  >
                    {t === 'channel' ? 'Канал' : 'Группа'}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              {form.username && <span className="badge bg-primary-subtle text-dark border">{form.username}</span>}
              {form.title && <span className="badge bg-secondary-subtle text-dark border">{form.title}</span>}
              <span className="badge bg-info-subtle text-dark border">{form.type === 'channel' ? 'Канал' : 'Группа'}</span>
            </div>

            <div className="d-flex gap-2 mt-2">
              <button type="submit" className="btn btn-success" disabled={!canSubmit}>
                {loading ? 'Добавляем…' : '✅ Добавить'}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => window.history.back()}>← Назад</button>
            </div>
          </form>
        </div>
      </div>

      {message && (
        <div className={`alert mt-3 ${danger ? 'alert-danger' : 'alert-success'}`}>{message}</div>
      )}
    </div>
  );
}
