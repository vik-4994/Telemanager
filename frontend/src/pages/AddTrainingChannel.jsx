import { useState } from "react";

export default function AddTrainingChannel() {
  const [form, setForm] = useState({
    username: "",
    title: "",
    type: "channel",
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("access");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    const response = await fetch("http://127.0.0.1:8000/api/add-channel/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      setSuccess("Канал/группа успешно добавлен(а) ✅");
      setForm({ username: "", title: "", type: "channel" });
    } else {
      const data = await response.json();
      setError(data?.detail || JSON.stringify(data));
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "600px" }}>
      <h3 className="mb-4">Добавить канал/группу для обучения</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Username (@...)</label>
          <input
            type="text"
            className="form-control"
            name="username"
            value={form.username}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Название</label>
          <input
            type="text"
            className="form-control"
            name="title"
            value={form.title}
            onChange={handleChange}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Тип</label>
          <select
            className="form-select"
            name="type"
            value={form.type}
            onChange={handleChange}
          >
            <option value="channel">Канал</option>
            <option value="group">Группа</option>
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
