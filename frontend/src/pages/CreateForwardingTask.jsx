import { useEffect, useState } from "react";

export default function CreateForwardingTask() {
  const token = localStorage.getItem("access");

  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);

  const [sourceChannel, setSourceChannel] = useState("");
  const [accountId, setAccountId] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [interval, setInterval] = useState(60);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/accounts/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setAccounts);

    fetch("http://127.0.0.1:8000/api/forwarding/groups/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setGroups(data.filter((g) => g.is_active)));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");

    const res = await fetch("http://127.0.0.1:8000/api/forwarding/tasks/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        source_channel: sourceChannel,
        account: accountId,
        target_groups: selectedGroups,
        interval_minutes: interval,
      }),
    });

    if (res.ok) {
      setStatus("✅ Задача создана");
      setSourceChannel("");
      setAccountId("");
      setSelectedGroups([]);
      setInterval(60);
    } else {
      const data = await res.json();
      setStatus("❌ Ошибка: " + (data.detail || JSON.stringify(data)));
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "650px" }}>
      <h3 className="mb-4">⚙️ Создание задачи пересылки</h3>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Канал-источник (username)</label>
          <input
            type="text"
            className="form-control"
            value={sourceChannel}
            onChange={(e) => setSourceChannel(e.target.value)}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Аккаунт</label>
          <select
            className="form-select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            <option value="">-- выбрать --</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.phone} ({acc.name || "нет имени"})
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label">Группы для пересылки</label>
          <select
            className="form-select"
            multiple
            value={selectedGroups}
            onChange={(e) =>
              setSelectedGroups(Array.from(e.target.selectedOptions, (o) => parseInt(o.value)))
            }
            required
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.username}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label">Интервал (мин)</label>
          <input
            type="number"
            className="form-control"
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value))}
            required
          />
        </div>

        <button className="btn btn-success" type="submit">
          🚀 Создать задачу
        </button>

        {status && <div className="alert alert-info mt-3">{status}</div>}
      </form>
    </div>
  );
}
