import { useEffect, useMemo, useState } from "react";

/**
 * AddTelegramAccount — Revamped UI
 * - Drag & drop style inputs for .json and .session
 * - Live JSON preview (phone, app_id, app_hash, name)
 * - Proxy picker with search
 * - Upload progress (XHR)
 * - After upload: optional auto-attach selected proxy by phone lookup
 */
export default function AddTelegramAccount() {
  const [jsonFile, setJsonFile] = useState(null);
  const [sessionFile, setSessionFile] = useState(null);
  const [jsonInfo, setJsonInfo] = useState(null); // { phone, app_id, app_hash, name }

  const [proxies, setProxies] = useState([]);
  const [selectedProxy, setSelectedProxy] = useState("");
  const [proxyQuery, setProxyQuery] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const token = localStorage.getItem("access");
  const API_BASE = "http://127.0.0.1:8000/api/accounts";

  useEffect(() => {
    const fetchProxies = async () => {
      try {
        const res = await fetch(`${API_BASE}/proxies/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setProxies(Array.isArray(data) ? data : []);
      } catch (e) {
        setProxies([]);
      }
    };
    fetchProxies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter proxies by search query
  const filteredProxies = useMemo(() => {
    const q = (proxyQuery || "").toLowerCase();
    if (!q) return proxies;
    return proxies.filter((p) =>
      [p.proxy_type, p.host, p.port, p.username]
        .map((v) => (v ?? "").toString().toLowerCase())
        .some((s) => s.includes(q))
    );
  }, [proxyQuery, proxies]);

  const onSelectJson = async (file) => {
    setJsonFile(file);
    setJsonInfo(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Файл конфигурации должен быть .json");
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const info = {
        phone: data.phone || "",
        app_id: data.app_id || data.appId || data.appID || data.app || data.appid || data.app_id,
        app_hash: data.app_hash || data.appHash || data.api_hash || data.apiHash,
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
      };
      setJsonInfo(info);
    } catch (e) {
      setError("Не удалось прочитать JSON — проверь формат");
    }
  };

  const onSelectSession = (file) => {
    setSessionFile(file);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".session")) {
      setError("Файл сессии должен быть .session");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!jsonFile || !sessionFile) {
      setError("Нужно выбрать оба файла: .json и .session");
      return;
    }

    // Build form data
    const formData = new FormData();
    formData.append("json", jsonFile);
    formData.append("session", sessionFile);
    if (selectedProxy) formData.append("proxy_id", selectedProxy); // backend may ignore; we also do fallback after upload

    setUploading(true);
    setProgress(0);

    try {
      // Use XHR for upload progress
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/upload/`, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setProgress(pct);
        }
      };

      const resp = await new Promise((resolve, reject) => {
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) resolve(xhr);
        };
        xhr.onerror = reject;
        xhr.send(formData);
      });

      let data = {};
      try { data = JSON.parse(resp.responseText || "{}"); } catch (_) {}

      if (resp.status >= 200 && resp.status < 300) {
        setSuccess("✅ Аккаунт успешно загружен");
        // Fallback: if proxy selected, try to attach by phone from JSON
        if (selectedProxy && jsonInfo?.phone) {
          await attachProxyByPhone(jsonInfo.phone, selectedProxy);
        }
        // Reset files, keep selected proxy
        setJsonFile(null);
        setSessionFile(null);
        setJsonInfo(null);
      } else {
        setError(data?.error || "Ошибка загрузки аккаунта");
      }
    } catch (e) {
      setError("Ошибка соединения при загрузке");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const attachProxyByPhone = async (phone, proxyId) => {
    try {
      const res = await fetch(`${API_BASE}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const accounts = await res.json();
      if (!Array.isArray(accounts)) return;
      const acc = accounts.find((a) => (a.phone || "").trim() === phone.trim());
      if (!acc) return;
      await fetch(`${API_BASE}/${acc.id}/set_proxy/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ proxy_id: proxyId }),
      });
    } catch (_) {
      // silently ignore; user still can change proxy in dashboard
    }
  };

  const canSubmit = useMemo(() => !!jsonFile && !!sessionFile && !uploading, [jsonFile, sessionFile, uploading]);

  const fileChip = (file) => file && (
    <span className="badge bg-secondary-subtle text-dark border">
      {file.name} <span className="text-muted">({Math.ceil(file.size/1024)} KB)</span>
    </span>
  );

  return (
    <div className="container py-4" style={{ maxWidth: 980 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: "linear-gradient(135deg, #6f42c1 0%, #0d6efd 100%)",
        boxShadow: "0 16px 40px rgba(13,110,253,.25)",
      }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="opacity-75">Импорт аккаунта</div>
            <h2 className="m-0">Загрузка Telegram‑аккаунта (.json + .session)</h2>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-light"
              onClick={() => {
                setJsonFile(null); setSessionFile(null); setJsonInfo(null);
                setSelectedProxy(""); setProxyQuery(""); setError(""); setSuccess("");
              }}
            >
              ↺ Сброс
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="d-flex flex-column gap-4">
        {/* Files Row */}
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <UploadCard
              title="Файл конфигурации (.json)"
              help="Содержит phone, app_id, app_hash, optional proxy"
              accept=".json"
              file={jsonFile}
              onFile={(f) => onSelectJson(f)}
              disabled={uploading}
            />
          </div>
          <div className="col-12 col-lg-6">
            <UploadCard
              title="Файл сессии (.session)"
              help="Файл сессии Telegram Desktop/Telethon"
              accept=".session"
              file={sessionFile}
              onFile={(f) => onSelectSession(f)}
              disabled={uploading}
            />
          </div>
        </div>

        {/* JSON Preview */}
        {jsonInfo && (
          <div className="card border-0 shadow-sm">
            <div className="card-body d-flex flex-wrap align-items-center gap-3">
              <div className="me-auto">
                <div className="small text-muted mb-1">Предпросмотр JSON</div>
                <div className="d-flex flex-wrap gap-2">
                  {jsonInfo.phone && <span className="badge bg-success">📞 {jsonInfo.phone}</span>}
                  {jsonInfo.app_id && <span className="badge bg-primary-subtle text-dark border">APP ID: {jsonInfo.app_id}</span>}
                  {jsonInfo.app_hash && <span className="badge bg-primary-subtle text-dark border">HASH: {String(jsonInfo.app_hash).slice(0,8)}…</span>}
                  {jsonInfo.name && <span className="badge bg-secondary-subtle text-dark border">👤 {jsonInfo.name}</span>}
                </div>
              </div>
              <div className="d-flex flex-column align-items-end gap-2">
                {fileChip(jsonFile)}
                {fileChip(sessionFile)}
              </div>
            </div>
          </div>
        )}

        {/* Proxy Picker */}
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <h5 className="m-0">Прокси (опционально)</h5>
              <div className="input-group" style={{ maxWidth: 320 }}>
                <span className="input-group-text">🔎</span>
                <input
                  className="form-control"
                  placeholder="Поиск по типу/хосту/порту"
                  value={proxyQuery}
                  onChange={(e) => setProxyQuery(e.target.value)}
                  disabled={uploading}
                />
                {proxyQuery && (
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setProxyQuery("")}>✖</button>
                )}
              </div>
            </div>

            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-8">
                <select
                  className="form-select"
                  value={selectedProxy}
                  onChange={(e) => setSelectedProxy(e.target.value)}
                  disabled={uploading}
                >
                  <option value="">🚫 Без прокси</option>
                  {filteredProxies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.proxy_type || "").toUpperCase()} {p.host}:{p.port}
                      {p.username ? ` (${p.username})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4 text-md-end">
                <small className="text-muted">Можно выбрать позже на Dashboard</small>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="card border-0 shadow-sm">
          <div className="card-body d-flex flex-wrap align-items-center gap-3">
            <button type="submit" className="btn btn-success" disabled={!canSubmit}>
              {uploading ? "Загрузка..." : "⬆️ Загрузить"}
            </button>
            {uploading && (
              <div className="flex-grow-1">
                <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                  <div className="progress-bar" style={{ width: `${progress}%` }}>{progress}%</div>
                </div>
              </div>
            )}
            <div className="ms-auto small text-muted">
              При загрузке мы сохраняем файлы на сервере в директории <code>sessions/</code> и связываем их с вашим аккаунтом.
            </div>
          </div>
        </div>

        {success && <div className="alert alert-success shadow-sm">{success}</div>}
        {error && <div className="alert alert-danger shadow-sm">{error}</div>}
      </form>
    </div>
  );
}

function UploadCard({ title, help, accept, file, onFile, disabled }) {
  const [isOver, setIsOver] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`card border-0 shadow-sm ${isOver ? "border-primary" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      style={{ transition: "border-color .2s" }}
    >
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between gap-3">
          <div>
            <h5 className="mb-1">{title}</h5>
            <div className="text-muted small">{help}</div>
          </div>
          {file && (
            <span className="badge bg-secondary-subtle text-dark border">
              {file.name}
            </span>
          )}
        </div>

        <label className="mt-3 w-100" style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
          <div className={`p-4 rounded-3 border border-2 ${isOver ? "border-primary" : "border-dashed"}`} style={{ borderStyle: "dashed" }}>
            <div className="text-center text-muted">
              <div className="mb-2" style={{ fontSize: 28 }}>📁</div>
              <div>Перетащите файл сюда или нажмите, чтобы выбрать</div>
              <div className="small text-muted mt-1">Допустимые типы: <code>{accept}</code></div>
            </div>
          </div>
          <input
            type="file"
            accept={accept}
            className="d-none"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={disabled}
          />
        </label>
      </div>
    </div>
  );
}
