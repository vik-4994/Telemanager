import { useState, useEffect } from "react";

export default function ForwardingGroups() {
  const [groups, setGroups] = useState([]);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");
  const token = localStorage.getItem("access");

  const fetchGroups = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/forwarding/groups/", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    setGroups(data);
  };

  const handleAdd = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/forwarding/groups/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username }),
    });

    if (res.ok) {
      setUsername("");
      fetchGroups();
      setStatus("✅ Группа добавлена");
    } else {
      setStatus("❌ Ошибка при добавлении");
    }
  };

  const handleToggle = async (id, isActive) => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/forwarding/groups/${id}/${isActive ? "disable" : "enable"}/`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (res.ok) {
      fetchGroups();
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Удалить эту группу?");
    if (!confirmed) return;
    await fetch(`http://127.0.0.1:8000/api/forwarding/groups/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchGroups();
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  return (
    <div className="container mt-5">
      <h3 className="mb-4">📥 Группы для пересылки</h3>

      <div className="input-group mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="@group или ID"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          ➕ Добавить
        </button>
      </div>

      {status && <div className="alert alert-info">{status}</div>}

      {groups.length === 0 ? (
        <p>Нет добавленных групп.</p>
      ) : (
        <table className="table table-bordered">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Username</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={g.id}>
                <td>{i + 1}</td>
                <td>{g.username}</td>
                <td>{g.is_active ? "✅ Активна" : "🚫 Отключена"}</td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-secondary me-2"
                    onClick={() => handleToggle(g.id, g.is_active)}
                  >
                    {g.is_active ? "Отключить" : "Включить"}
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDelete(g.id)}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
