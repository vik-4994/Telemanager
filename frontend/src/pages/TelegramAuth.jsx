import { useEffect, useMemo, useState } from "react";

/**
 * TelegramAuth — revamped
 * - Two-step wizard with a left stepper
 * - Nicer visuals (gradient header, cards, badges)
 * - Force SMS toggle + delivery diagnostics (app/sms/call)
 * - Resend code + countdown based on backend timeout
 * - Solid validation and UX safeguards
 */
export default function TelegramAuth() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [delivery, setDelivery] = useState(""); // app | sms | call | ...
  const [timeoutSec, setTimeoutSec] = useState(null); // server-provided timeout
  const [countdown, setCountdown] = useState(null); // ticking countdown for UI
  const [forceSms, setForceSms] = useState(true);

  const [message, setMessage] = useState("");
  const [msgDanger, setMsgDanger] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("access");
  const API_BASE = "http://127.0.0.1:8000/api/accounts";

  // helper: validation
  const canSend = useMemo(() => {
    return (
      !loading && step === 1 && phone.trim().startsWith("+") && apiId.trim() && apiHash.trim()
    );
  }, [loading, step, phone, apiId, apiHash]);

  const canSignIn = useMemo(() => {
    return !loading && step === 2 && code.trim().length >= 3; // TG codes typically 5-6
  }, [loading, step, code]);

  const toast = (msg, danger = false) => {
    setMessage(msg);
    setMsgDanger(danger);
    // auto-hide after 4s
    if (msg) setTimeout(() => setMessage("") , 4000);
  };

  // countdown display
  useEffect(() => {
    if (!timeoutSec) { setCountdown(null); return; }
    setCountdown(timeoutSec);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null;
        const next = c - 1;
        if (next <= 0) { clearInterval(id); return 0; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeoutSec]);

  const sendCode = async () => {
    if (!canSend) return;
    try {
      setLoading(true);
      setSuccess(false);
      setMessage("");
      setDelivery("");

      const res = await fetch(`${API_BASE}/send_code/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone, api_id: apiId, api_hash: apiHash, force_sms: forceSms }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // if already authorized, no code will be sent
        if (data?.authorized) {
          setSuccess(true);
          toast("✅ Аккаунт уже авторизован — код не нужен");
          setStep(1);
          return;
        }
        setStep(2);
        setDelivery(data?.delivery || "");
        setTimeoutSec(typeof data?.timeout === "number" ? data.timeout : null);
        toast("📩 Запрос на код отправлен");
      } else {
        toast(data?.error || "Ошибка отправки кода", true);
      }
    } catch (err) {
      toast("Сервер не отвечает", true);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (step !== 2 || loading) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/resend_code/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDelivery(data?.delivery || delivery);
        setTimeoutSec(typeof data?.timeout === "number" ? data.timeout : null);
        toast("🔁 Повторная отправка запрошена");
      } else {
        toast(data?.error || "Не удалось повторно отправить код", true);
      }
    } catch (e) {
      toast("Ошибка соединения", true);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    if (!canSignIn) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/sign_in/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone, code, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setSuccess(true);
        toast("✅ Успешно авторизовано и сохранено");
      } else {
        setSuccess(false);
        toast(data?.error || "Ошибка входа", true);
      }
    } catch (err) {
      setSuccess(false);
      toast("Ошибка соединения", true);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setCode("");
    setPassword("");
    setDelivery("");
    setTimeoutSec(null);
    setCountdown(null);
    setSuccess(false);
  };

  return (
    <div className="container py-4" style={{ maxWidth: 980 }}>
      {/* Header */}
      <div
        className="rounded-4 p-4 mb-4 text-white"
        style={{
          background: "linear-gradient(135deg, #20c997 0%, #0d6efd 100%)",
          boxShadow: "0 16px 40px rgba(13,110,253,.25)",
        }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="opacity-75">Подключение аккаунта</div>
            <h2 className="m-0">Telegram — авторизация по телефону</h2>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-light" onClick={resetForm}>↺ Сброс</button>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left stepper */}
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <ol className="list-group list-group-numbered">
                <li className={`list-group-item d-flex justify-content-between align-items-start ${step===1?"active":''}`}>
                  <div className="ms-2 me-auto">
                    <div className="fw-bold">Данные приложения</div>
                    <small className="text-muted">API ID, API HASH, телефон</small>
                  </div>
                  <span className="badge bg-primary rounded-pill">1</span>
                </li>
                <li className={`list-group-item d-flex justify-content-between align-items-start ${step===2?"active":''}`}>
                  <div className="ms-2 me-auto">
                    <div className="fw-bold">Подтверждение</div>
                    <small className="text-muted">Код из Telegram и 2FA</small>
                  </div>
                  <span className="badge bg-primary rounded-pill">2</span>
                </li>
              </ol>

              <div className="mt-4 small text-muted">
                <div className="mb-1">Советы:</div>
                <ul className="ps-3 m-0">
                  <li>Телефон указывайте в формате E.164: <code>+48XXXXXXXXX</code></li>
                  <li>Если код приходит в приложение — откройте чат <b>Telegram</b></li>
                  <li>Можно запросить SMS или повторную отправку</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="col-12 col-lg-8">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              {step === 1 && (
                <StepOne
                  phone={phone}
                  apiId={apiId}
                  apiHash={apiHash}
                  setPhone={setPhone}
                  setApiId={setApiId}
                  setApiHash={setApiHash}
                  forceSms={forceSms}
                  setForceSms={setForceSms}
                  onSubmit={sendCode}
                  canSend={canSend}
                  loading={loading}
                />
              )}

              {step === 2 && (
                <StepTwo
                  code={code}
                  password={password}
                  setCode={setCode}
                  setPassword={setPassword}
                  delivery={delivery}
                  countdown={countdown}
                  onResend={resendCode}
                  onBack={() => setStep(1)}
                  onSubmit={signIn}
                  canSignIn={canSignIn}
                  loading={loading}
                />
              )}
            </div>
          </div>

          {message && (
            <div className={`alert mt-3 ${msgDanger ? "alert-danger" : "alert-success"}`}>
              {message}
            </div>
          )}

          {success && (
            <div className="alert alert-success mt-3">
              🎉 Готово! Сессия сохранена. Теперь аккаунт появится в списке и готов к работе.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepOne({ phone, apiId, apiHash, setPhone, setApiId, setApiHash, forceSms, setForceSms, onSubmit, canSend, loading }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="d-flex flex-column gap-3"
    >
      <h5 className="mb-2">Данные приложения</h5>

      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label">API ID</label>
          <input
            type="number"
            className="form-control"
            value={apiId}
            onChange={(e) => setApiId(e.target.value)}
            disabled={loading}
            placeholder="Напр. 1234567"
            required
          />
        </div>
        <div className="col-12 col-md-8">
          <label className="form-label">API HASH</label>
          <input
            type="text"
            className="form-control"
            value={apiHash}
            onChange={(e) => setApiHash(e.target.value)}
            disabled={loading}
            placeholder="Напр. a1b2c3d4e5f6..."
            required
          />
        </div>
      </div>

      <div>
        <label className="form-label">Телефон</label>
        <input
          type="tel"
          className="form-control"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
          placeholder="+48XXXXXXXXX"
          required
        />
        <div className="form-text">Формат E.164, с плюсом и кодом страны</div>
      </div>

      <div className="form-check form-switch">
        <input className="form-check-input" type="checkbox" id="forceSmsSwitch" checked={forceSms} onChange={(e) => setForceSms(e.target.checked)} />
        <label className="form-check-label" htmlFor="forceSmsSwitch">Запросить код через SMS (если доступно)</label>
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={!canSend}>
          {loading ? "Отправка..." : "📩 Отправить код"}
        </button>
      </div>
    </form>
  );
}

function StepTwo({ code, password, setCode, setPassword, delivery, countdown, onResend, onBack, onSubmit, canSignIn, loading }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="d-flex flex-column gap-3"
    >
      <div className="d-flex align-items-center justify-content-between">
        <h5 className="mb-0">Подтверждение</h5>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onBack}>
          ← Назад
        </button>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label">Код из Telegram</label>
          <input
            type="text"
            className="form-control"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Напр. 12345"
            required
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Пароль 2FA (если есть)</label>
          <input
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ваш пароль"
          />
        </div>
      </div>

      <div className="d-flex align-items-center gap-2 flex-wrap">
        {delivery && (
          <span className="badge bg-info-subtle text-dark border">
            Способ доставки: <b className="ms-1 text-uppercase">{delivery}</b>
          </span>
        )}
        {typeof countdown === "number" && countdown > 0 && (
          <span className="badge bg-secondary-subtle text-dark border">Повторная отправка через: {countdown}s</span>
        )}
        {delivery === "app" && (
          <span className="text-muted small">Проверьте чат <b>Telegram</b> в приложении.</span>
        )}
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-success" disabled={!canSignIn}>
          {loading ? "Входим..." : "✅ Войти и сохранить"}
        </button>
        <button
          type="button"
          className="btn btn-outline-primary"
          disabled={loading || (typeof countdown === "number" && countdown > 0)}
          onClick={onResend}
        >
          🔁 Отправить код повторно
        </button>
      </div>
    </form>
  );
}