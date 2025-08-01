import { useState } from "react";

export default function TelegramAuth() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("access");

  const sendCode = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://127.0.0.1:8000/api/accounts/send_code/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone, api_id: apiId, api_hash: apiHash }),
      });

      if (res.ok) {
        setMessage("✅ Код отправлен");
        setStep(2);
      } else {
        const data = await res.json();
        setMessage(data?.error || "Ошибка отправки кода");
      }
    } catch (err) {
      setMessage("Сервер не отвечает");
    }
  };

  const signIn = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/accounts/sign_in/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone, code, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setMessage("✅ Успешно авторизовано и сохранено");
      } else {
        setMessage(data?.error || "Ошибка входа");
      }
    } catch (err) {
      setMessage("Ошибка соединения");
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "600px" }}>
      <h3 className="mb-4">Авторизация Telegram аккаунта</h3>

      <div className="mb-3">
        <label className="form-label">API ID</label>
        <input
          type="text"
          className="form-control"
          value={apiId}
          onChange={(e) => setApiId(e.target.value)}
          disabled={step !== 1}
        />
      </div>

      <div className="mb-3">
        <label className="form-label">API HASH</label>
        <input
          type="text"
          className="form-control"
          value={apiHash}
          onChange={(e) => setApiHash(e.target.value)}
          disabled={step !== 1}
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Телефон (с +)</label>
        <input
          type="text"
          className="form-control"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={step !== 1}
        />
      </div>

      {step === 1 && (
        <button className="btn btn-primary" onClick={sendCode}>
          📩 Отправить код
        </button>
      )}

      {step === 2 && (
        <>
          <div className="mb-3 mt-3">
            <label className="form-label">Код из Telegram</label>
            <input
              type="text"
              className="form-control"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Пароль 2FA (если есть)</label>
            <input
              type="text"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="btn btn-success" onClick={signIn}>
            ✅ Войти и сохранить
          </button>
        </>
      )}

      {message && (
        <div className={`alert mt-3 ${success ? "alert-success" : "alert-danger"}`}>
          {message}
        </div>
      )}
    </div>
  );
}
