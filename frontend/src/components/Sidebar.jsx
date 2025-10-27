import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

/**
 * Sidebar — Modern responsive / collapsible
 * Обновлено: добавлены пункты
 *  - "Telegram профиль" (/accounts/profile) в раздел Аккаунты
 *  - "Обработанные пользователи" (/processed-users) в раздел Аналитика
 */
export default function Sidebar() {
  const STORAGE_KEY = "sidebar_collapsed";
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch (_) { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0"); } catch (_) {}
  }, [collapsed]);

  const width = collapsed ? 76 : 260;

  const sections = useMemo(() => ([
    {
      title: "Аккаунты",
      items: [
        { to: "/", icon: "📱", label: "Аккаунты" },
        { to: "/account/add", icon: "➕", label: "Добавить аккаунт" },
        { to: "/telegram/auth", icon: "📲", label: "Через телефон" },
        { to: "/accounts/profile", icon: "👤", label: "Telegram профиль" }, // NEW
      ],
    },
    {
      title: "Аналитика", // NEW section
      items: [
        { to: "/processed-users", icon: "📊", label: "Обработанные пользователи" },
      ],
    },
    {
      title: "Прокси",
      items: [
        { to: "/proxies", icon: "🌐", label: "Все прокси" },
        { to: "/proxy/add", icon: "➕", label: "Добавить прокси" },
      ],
    },
    {
      title: "Каналы",
      items: [
        { to: "/channels", icon: "📡", label: "Список каналов" },
        { to: "/add-training-channel", icon: "➕", label: "Добавить группу/канал" },
        { to: "/ichannels", icon: "🧩", label: "Каналы‑посредники" },
      ],
    },
    {
      title: "Рост",
      items: [
        { to: "/invite-users", icon: "👥", label: "Инвайтинг" },
        { to: "/broadcast", icon: "📨", label: "Рассылка в ЛС" },
      ],
    },
    {
      title: "Пересылка",
      items: [
        { to: "/forwarding/groups", icon: "👥", label: "Группы для пересылки" },
        { to: "/forwarding/create-task", icon: "⚙️", label: "Создать задачу пересылки" },
        { to: "/forwarding/tasks", icon: "📤", label: "Задачи пересылки" },
      ],
    },
  ]), [collapsed]);

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.href = "/login";
  };

  return (
    <aside
      className="bg-dark text-white d-flex flex-column position-sticky top-0"
      style={{ width, minHeight: "100vh", transition: "width .2s ease" }}
    >
      <Style />

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between gap-2 px-3 py-3 border-bottom border-secondary">
        <div className="d-flex align-items-center gap-2">
          <div className="rounded-circle bg-primary d-inline-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>T</span>
          </div>
          {!collapsed && (
            <div>
              <div className="fw-bold">Telemanager</div>
              <div className="small text-secondary">Dashboard</div>
            </div>
          )}
        </div>
        <button
          className="btn btn-sm btn-outline-light border-0"
          title={collapsed ? "Развернуть" : "Свернуть"}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {/* Nav */}
      <div className="flex-grow-1 overflow-auto">
        {sections.map((sec, i) => (
          <div key={i} className="px-2 pt-3">
            {!collapsed && <div className="px-2 text-uppercase text-secondary small mb-2">{sec.title}</div>}
            <ul className="list-unstyled m-0">
              {sec.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    className={({ isActive }) =>
                      `sb-link d-flex align-items-center gap-2 px-2 py-2 rounded-3 text-decoration-none ${isActive ? "active" : ""}`
                    }
                    title={collapsed ? it.label : undefined}
                  >
                    <span className="sb-ico" aria-hidden>{it.icon}</span>
                    {!collapsed && <span className="sb-label">{it.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto px-3 py-3 border-top border-secondary">
        <button className="btn btn-outline-light w-100" onClick={logout}>
          <span className="me-1">⎋</span>
          {!collapsed && "Выйти"}
        </button>
      </div>
    </aside>
  );
}

function Style() {
  return (
    <style>{`
      .sb-link { color: #d8dee9; }
      .sb-link:hover { background: rgba(255,255,255,.08); color: #fff; }
      .sb-link.active { color: #fff; background: linear-gradient(90deg, rgba(13,110,253,.25), rgba(13,110,253,.05)); }
      .sb-link.active .sb-ico { transform: scale(1.05); }
      .sb-ico { width: 28px; text-align: center; transition: transform .15s ease; }
      .sb-label { white-space: nowrap; }
      @media (max-width: 991px) {
        /* Slightly narrower on tablets to save space */
        aside { width: var(--sb-w, auto); }
      }
    `}</style>
  );
}