import { useEffect, useState } from "react";

export default function IntermediateChannels() {
  const [channels, setChannels] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("access");

  const fetchChannels = async () => {
    const res = await fetch(
      "http://127.0.0.1:8000/api/accounts/intermediate-channels/",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    setChannels(data);
  };

  const handleDelete = async (channelId) => {
    if (!window.confirm("Удалить этот канал?")) return;

    const res = await fetch(
      `http://127.0.0.1:8000/api/accounts/intermediate-channels/${channelId}/`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (res.ok) {
      setChannels(channels.filter((c) => c.id !== channelId));
      setMessage("Канал удалён");
    } else {
      setMessage("❌ Не удалось удалить канал");
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setMessage("");

    const res = await fetch(
      "http://127.0.0.1:8000/api/accounts/intermediate-channels/add/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newUsername }),
      }
    );

    const data = await res.json();

    if (res.ok) {
      setMessage("✅ Канал добавлен");
      setNewUsername("");
      fetchChannels();
    } else {
      setMessage("❌ Ошибка: " + (data.error || "неизвестная"));
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  return (
    <div className="container mt-4" style={{ maxWidth: "600px" }}>
      <h3 className="mb-4">📡 Каналы-переходники</h3>

      <form onSubmit={handleAdd} className="d-flex mb-3">
        <input
          type="text"
          className="form-control me-2"
          placeholder="@username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary">
          ➕ Добавить
        </button>
      </form>

      {message && <div className="alert alert-info">{message}</div>}

      <ul className="list-group">
        {channels.map((ch) => (
          <li
            className="list-group-item d-flex justify-content-between align-items-center"
            key={ch.id}
          >
            <span>
              <strong>{ch.username}</strong>
              {ch.title && <span className="text-muted"> — {ch.title}</span>}
            </span>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-secondary">
                {ch.accounts.length} аккаунтов
              </span>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => handleDelete(ch.id)}
                title="Удалить канал"
              >
                🗑️
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
