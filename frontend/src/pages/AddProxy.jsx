import { useState } from "react";

export default function AddProxy() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [proxyType, setProxyType] = useState("http");

  const token = localStorage.getItem("access");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const response = await fetch(
      "http://127.0.0.1:8000/api/accounts/proxies/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          host,
          port: Number(port),
          proxy_type: proxyType,
          username,
          password,
        }),
      }
    );

    if (response.ok) {
      setSuccess("Прокси добавлен!");
      setHost("");
      setPort("");
      setUsername("");
      setPassword("");
    } else {
      const data = await response.json();
      setError(JSON.stringify(data));
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "500px" }}>
      <h3 className="mb-4">Добавить прокси</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Host</label>
          <input
            type="text"
            className="form-control"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Port</label>
          <input
            type="number"
            className="form-control"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Username (необязательно)</label>
          <input
            type="text"
            className="form-control"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Password (необязательно)</label>
          <input
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Тип прокси</label>
          <select
            className="form-select"
            value={proxyType}
            onChange={(e) => setProxyType(e.target.value)}
            required
          >
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </div>

        <button type="submit" className="btn btn-primary">
          Добавить
        </button>
        {success && <div className="alert alert-success mt-3">{success}</div>}
        {error && <div className="alert alert-danger mt-3">{error}</div>}
      </form>
    </div>
  );
}
