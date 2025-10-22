import { useEffect, useState } from "react";

export default function ForwardingTasks() {
  const token = localStorage.getItem("access");
  const [tasks, setTasks] = useState([]);

  const fetchTasks = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/forwarding/tasks/", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    setTasks(data);
  };

  const toggleTask = async (task) => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/forwarding/tasks/${task.id}/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !task.is_active }),
      }
    );
    if (res.ok) fetchTasks();
  };

  const deleteTask = async (id) => {
    const confirmed = window.confirm("Удалить эту задачу?");
    if (!confirmed) return;
    await fetch(`http://127.0.0.1:8000/api/forwarding/tasks/${id}/`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    fetchTasks();
  };

  const stopTask = async (id) => {
    const confirmed = window.confirm("Остановить выполнение задачи?");
    if (!confirmed) return;

    const res = await fetch(
      `http://127.0.0.1:8000/api/forwarding/tasks/${id}/stop/`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await res.json();
    if (res.ok) {
      alert(data.message || "Задача остановлена");
      fetchTasks();
    } else {
      alert("❌ Ошибка: " + (data.error || "неизвестно"));
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mt-5">
      <h3 className="mb-4">📤 Задачи пересылки</h3>

      {tasks.length === 0 ? (
        <p>Задач пока нет.</p>
      ) : (
        <table className="table table-bordered">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Источник</th>
              <th>Аккаунт</th>
              <th>Группы</th>
              <th>Интервал</th>
              <th>Статус</th>
              <th>Последняя отправка</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, i) => (
              <tr key={task.id}>
                <td>{i + 1}</td>
                <td>{task.source_channel}</td>
                <td>{task.account}</td>
                <td>{task.target_groups.length} групп</td>
                <td>{task.interval_minutes} мин</td>
                <td>
                  {task.is_active ? (
                    <span className="text-success">Активна</span>
                  ) : (
                    <span className="text-muted">Выключена</span>
                  )}
                </td>
                <td>
                  {task.last_sent_at
                    ? new Date(task.last_sent_at).toLocaleString()
                    : "—"}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-secondary me-2"
                    onClick={() => toggleTask(task)}
                  >
                    {task.is_active ? "Остановить" : "Запустить"}
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => deleteTask(task.id)}
                  >
                    Удалить
                  </button>
                  {task.is_active && (
                    <button
                      className="btn btn-sm btn-outline-danger me-2"
                      onClick={() => stopTask(task.id)}
                    >
                      🛑 Остановить
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
