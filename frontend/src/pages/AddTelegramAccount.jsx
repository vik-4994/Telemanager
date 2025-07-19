import { useState, useEffect } from "react";

export default function AddTelegramAccount() {
  const [jsonFile, setJsonFile] = useState(null);
  const [sessionFile, setSessionFile] = useState(null);
  const [proxies, setProxies] = useState([]);
  const [selectedProxy, setSelectedProxy] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("access");

  useEffect(() => {
    const fetchProxies = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/accounts/proxies/", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error("Ошибка загрузки прокси");
        }

        const data = await res.json();

        if (Array.isArray(data)) {
          setProxies(data);
        } else {
          setProxies([]);
          console.warn("Ответ не массив:", data);
        }
      } catch (err) {
        console.error("Ошибка при загрузке прокси:", err);
        setProxies([]);
      }
    };

    fetchProxies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!jsonFile || !sessionFile) {
      setError("Нужно выбрать оба файла");
      return;
    }

    const formData = new FormData();
    formData.append("json", jsonFile);
    formData.append("session", sessionFile);
    formData.append("proxy_id", selectedProxy); // ← не забудь в бэке обработать!

    const res = await fetch("http://127.0.0.1:8000/api/accounts/upload/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (res.ok) {
      setSuccess("Аккаунт успешно загружен!");
      setJsonFile(null);
      setSessionFile(null);
    } else {
      const data = await res.json();
      setError(data?.error || "Ошибка загрузки");
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "600px" }}>
      <h3 className="mb-4">Загрузка Telegram-аккаунта</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Файл .json</label>
          <input
            type="file"
            className="form-control"
            accept=".json"
            onChange={(e) => setJsonFile(e.target.files[0])}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Файл .session</label>
          <input
            type="file"
            className="form-control"
            accept=".session"
            onChange={(e) => setSessionFile(e.target.files[0])}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Прокси (опционально)</label>
          <select
            className="form-select"
            value={selectedProxy}
            onChange={(e) => setSelectedProxy(e.target.value)}
          >
            <option value="">Без прокси</option>
            {proxies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.host}:{p.port}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-success">
          Загрузить
        </button>
        {success && <div className="alert alert-success mt-3">{success}</div>}
        {error && <div className="alert alert-danger mt-3">{error}</div>}
      </form>
    </div>
  );
}
