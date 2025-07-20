import { useEffect, useState } from "react";

export default function ProxyList() {
  const [proxies, setProxies] = useState([]);
  const token = localStorage.getItem("access");

  useEffect(() => {
    const fetchProxies = async () => {
      const res = await fetch("http://127.0.0.1:8000/api/accounts/proxies/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setProxies(data);
    };

    fetchProxies();
  }, []);

  return (
    <div className="p-4 flex-grow-1">
      <h3>🌐 Список всех прокси</h3>
      <hr />
      {proxies.length === 0 ? (
        <p>Нет добавленных прокси.</p>
      ) : (
        <table className="table table-bordered">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Тип</th>
              <th>Хост</th>
              <th>Порт</th>
              <th>Имя пользователя</th>
              <th>Пароль</th>
            </tr>
          </thead>
          <tbody>
            {proxies.map((p, index) => (
              <tr key={p.id}>
                <td>{index + 1}</td>
                <td>{p.proxy_type.toUpperCase()}</td>
                <td>{p.host}</td>
                <td>{p.port}</td>
                <td>{p.username || "-"}</td>
                <td>{p.password ? "•••••" : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
