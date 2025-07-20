import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proxies, setProxies] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem("access");

  const fetchProfile = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/me/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return navigate("/login");
    const data = await res.json();
    setUser(data);
  };

  const fetchAccounts = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/accounts/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return navigate("/login");
    const data = await res.json();
    setAccounts(data);
    setLoading(false);
  };

  const changeProxy = async (accountId, proxyId) => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/accounts/${accountId}/set_proxy/`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ proxy_id: proxyId }),
      }
    );

    if (res.ok) {
      setEditingId(null);
      fetchAccounts();
    } else {
      alert("Ошибка смены прокси");
    }
  };

  const fetchProxies = async () => {
    const res = await fetch("http://127.0.0.1:8000/api/accounts/proxies/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (Array.isArray(data)) setProxies(data);
  };

  const deleteAccount = async (accountId) => {
    if (!window.confirm("Удалить этот аккаунт?")) return;

    const res = await fetch(
      `http://127.0.0.1:8000/api/accounts/${accountId}/`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (res.ok) {
      setAccounts(accounts.filter((acc) => acc.id !== accountId));
    } else {
      alert("Ошибка при удалении аккаунта");
    }
  };

  const checkAllAccounts = async () => {
    const confirmed = window.confirm("Запустить проверку всех аккаунтов?");
    if (!confirmed) return;

    const res = await fetch("http://127.0.0.1:8000/api/accounts/check_all/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      alert("Проверка запущена! Обновите страницу через 10–30 секунд.");
    } else {
      alert("Ошибка при запуске проверки");
    }
  };

  useEffect(() => {
    if (!token) return navigate("/login");
    fetchProfile();
    fetchAccounts();
    fetchProxies();
  }, []);

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    navigate("/login");
  };

  return (
    <div className="d-flex vh-100">
      <div className="p-4 flex-grow-1">
        <h2>👤 Привет, {user?.username || "пользователь"}</h2>

        <hr />

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4>📱 Telegram аккаунты</h4>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={checkAllAccounts}
          >
            🔍 Проверить все аккаунты
          </button>
        </div>

        {loading ? (
          <p>Загрузка аккаунтов...</p>
        ) : accounts.length === 0 ? (
          <p>Нет добавленных аккаунтов.</p>
        ) : (
          <table className="table table-bordered">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Телефон</th>
                <th>Гео</th>
                <th>Статус</th>
                <th>Отлежка</th>
                <th>Роль</th>
                <th>Имя</th>
                <th>Последний вход</th>
                <th>Прокси</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc, index) => (
                <tr key={acc.id}>
                  <td>{index + 1}</td>
                  <td>{acc.phone}</td>
                  <td>{acc.geo}</td>
                  <td>{acc.status}</td>
                  <td>{acc.days_idle}</td>
                  <td>{acc.role || "-"}</td>
                  <td>{acc.name}</td>
                  <td>{new Date(acc.last_used).toLocaleString()}</td>
                  <td>
                    {(() => {
                      const proxy = proxies.find((p) => p.id === acc.proxy_id);
                      return proxy
                        ? `${proxy.proxy_type.toUpperCase()} ${proxy.host}:${
                            proxy.port
                          }`
                        : "Без прокси";
                    })()}
                  </td>
                  <td>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      style={{ padding: "2px 6px" }}
                      title="Сменить прокси"
                      onClick={() => setEditingId(acc.id)}
                    >
                      ⚙️
                    </button>
                    {editingId === acc.id && (
                      <select
                        className="form-select mt-2"
                        onChange={(e) => {
                          const value = e.target.value;
                          changeProxy(acc.id, value === "null" ? null : value);
                        }}
                        defaultValue=""
                      >
                        <option disabled value="">
                          Выбери прокси
                        </option>
                        <option value="null">🚫 Без прокси</option>
                        {proxies
                          .filter((p) => p.id !== acc.proxy)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.proxy_type.toUpperCase()} {p.host}:{p.port}
                            </option>
                          ))}
                      </select>
                    )}
                    <button
                      className="btn btn-outline-danger btn-sm"
                      style={{ padding: "2px 6px" }}
                      title="Удалить аккаунт"
                      onClick={() => deleteAccount(acc.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
