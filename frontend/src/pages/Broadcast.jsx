import { useEffect, useState } from "react";

export default function Broadcast() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [limit, setLimit] = useState(100);
  const [interval, setInterval] = useState(10);
  const [media, setMedia] = useState(null);
  const [status, setStatus] = useState("");

  const token = localStorage.getItem("access");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/accounts/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setAccounts);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("⏳ Отправка...");

    const formData = new FormData();
    formData.append("account_id", accountId);
    formData.append("message_text", messageText);
    formData.append("limit", limit);
    formData.append("interval", interval);
    if (media) formData.append("media", media);

    const res = await fetch("http://127.0.0.1:8000/api/accounts/broadcast/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      setStatus("✅ Рассылка запущена");
    } else {
      setStatus("❌ Ошибка: " + (data.error || "неизвестно"));
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "650px" }}>
      <h3 className="mb-4">📨 Массовая рассылка в ЛС</h3>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Telegram-аккаунт для отправки</label>
          <select
            className="form-select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            <option value="">Выберите аккаунт</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.phone}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label">Текст сообщения</label>
          <textarea
            className="form-control"
            rows="4"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            required
          ></textarea>
        </div>

        <div className="mb-3">
          <label className="form-label">Медиафайл (необязательно)</label>
          <input
            type="file"
            className="form-control"
            accept="image/*,video/*"
            onChange={(e) => setMedia(e.target.files[0])}
          />
        </div>

        <div className="row mb-3">
          <div className="col">
            <label className="form-label">Количество получателей</label>
            <input
              type="number"
              className="form-control"
              min="1"
              max="1000"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              required
            />
          </div>
          <div className="col">
            <label className="form-label">Интервал между сообщениями (сек)</label>
            <input
              type="number"
              className="form-control"
              min="2"
              max="300"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn btn-success">
          📤 Запустить рассылку
        </button>

        {status && <div className="alert alert-info mt-3">{status}</div>}
      </form>
    </div>
  );
}
