import { useEffect, useState } from "react";

export default function IntermediateChannels() {
  const [channels, setChannels] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("access");

  const fetchChannels = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/intermediate-channels/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setChannels(data);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setMessage("");

    const res = await fetch("http://127.0.0.1:8000/api/intermediate-channels/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: newUsername }),
    });

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
          <li className="list-group-item d-flex justify-content-between align-items-center" key={ch.id}>
            <span>
              <strong>{ch.username}</strong>
              {ch.title && <span className="text-muted"> — {ch.title}</span>}
            </span>
            <span className="badge bg-secondary">
              {ch.accounts.length} аккаунтов
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
