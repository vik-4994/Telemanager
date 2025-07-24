import { useEffect, useState } from "react";

export default function InviteUsers() {
  const [accounts, setAccounts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [interval, setInterval] = useState(30);
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("access");

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };

    fetch("http://127.0.0.1:8000/api/accounts/", { headers })
      .then((res) => res.json())
      .then(setAccounts);

    fetch("http://127.0.0.1:8000/api/accounts/intermediate-channels/", { headers })
      .then((res) => res.json())
      .then(setChannels);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const res = await fetch("http://127.0.0.1:8000/api/accounts/invite/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        account_id: accountId,
        channel_id: channelId,
        interval: Number(interval),
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setMessage("✅ Инвайт запущен");
    } else {
      setMessage("❌ Ошибка: " + (data.error || "неизвестно"));
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "600px" }}>
      <h3 className="mb-4">📤 Массовый инвайтинг</h3>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Аккаунт для инвайта</label>
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
          <label className="form-label">Канал-переходник (куда инвайтить)</label>
          <select
            className="form-select"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            required
          >
            <option value="">Выберите канал</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.username}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label">Интервал между инвайтами (сек)</label>
          <input
            type="number"
            className="form-control"
            value={interval}
            min="5"
            max="600"
            onChange={(e) => setInterval(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary">
          🚀 Запустить инвайтинг
        </button>

        {message && <div className="alert alert-info mt-3">{message}</div>}
      </form>
    </div>
  );
}
