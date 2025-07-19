import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem('access');

  const fetchProfile = async () => {
    const res = await fetch('http://127.0.0.1:8000/api/me/', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) return navigate('/login');
    const data = await res.json();
    setUser(data);
  };

  const fetchAccounts = async () => {
    const res = await fetch('http://127.0.0.1:8000/api/accounts/', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) return navigate('/login');
    const data = await res.json();
    setAccounts(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!token) return navigate('/login');
    fetchProfile();
    fetchAccounts();
  }, []);

  const logout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    navigate('/login');
  };

  return (
    <div className="d-flex vh-100">
      {/* Content */}
      <div className="p-4 flex-grow-1">
        <h2>👤 Привет, {user?.username || 'пользователь'}</h2>

        <hr />
        <h4 className="mb-3">📱 Telegram аккаунты</h4>

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
                  <td>{acc.role || '-'}</td>
                  <td>{acc.name}</td>
                  <td>{new Date(acc.last_used).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-sm btn-outline-primary me-2">✏️</button>
                    <button className="btn btn-sm btn-outline-danger">🗑️</button>
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
