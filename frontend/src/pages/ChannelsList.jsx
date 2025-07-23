import { useEffect, useState } from "react";

export default function ChannelsList() {
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState("");
  const token = localStorage.getItem("access");

  const fetchChannels = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/channels/list/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Ошибка при загрузке каналов");

      const data = await res.json();
      setChannels(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (id) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/channels/${id}/toggle/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        fetchChannels();
      } else {
        alert("Ошибка при смене статуса");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteChannel = async (id) => {
    if (!window.confirm("Удалить этот канал?")) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/channels/${id}/delete/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        fetchChannels();
      } else {
        alert("Ошибка при удалении");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  return (
    <div className="container mt-5">
      <h3 className="mb-4">📡 Список групп / каналов для обучения</h3>
      {error && <div className="alert alert-danger">{error}</div>}

      {channels.length === 0 ? (
        <p>Нет добавленных каналов.</p>
      ) : (
        <table className="table table-bordered">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Username</th>
              <th>Название</th>
              <th>Тип</th>
              <th>Активен</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch, i) => (
              <tr key={ch.id}>
                <td>{i + 1}</td>
                <td>{ch.username}</td>
                <td>{ch.title || "-"}</td>
                <td>{ch.type}</td>
                <td>
                  {ch.is_active ? (
                    <span className="text-success">Да</span>
                  ) : (
                    <span className="text-danger">Нет</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-secondary me-2"
                    onClick={() => toggleActive(ch.id)}
                  >
                    🔁 {ch.is_active ? "Отключить" : "Включить"}
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => deleteChannel(ch.id)}
                  >
                    🗑️ Удалить
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
