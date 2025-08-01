import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <div className="bg-dark text-white p-3 vh-100" style={{ width: "250px" }}>
      <h4 className="mb-4">Telemanager</h4>
      <ul className="nav flex-column">
        <li className="nav-item">
          <Link to="/" className="nav-link text-white">
            📱 Аккаунты
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/account/add" className="nav-link text-white">
            ➕ Добавить аккаунт
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/telegram/auth" className="nav-link text-white">
            ➕ Добавить аккаунт через телефон
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/proxies" className="nav-link text-white">
            📄 Все прокси
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/proxy/add" className="nav-link text-white">
            🌐 Добавить прокси
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/channels" className="nav-link text-white">
            📡 Список каналов
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/add-training-channel" className="nav-link text-white">
            📡 Добавить группу/канал
          </Link>
        </li>
         <li className="nav-item">
          <Link to="/ichannels" className="nav-link text-white">
            Каналы-посредники
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/invite-users" className="nav-link text-white">
            Инвайтинг
          </Link>
        </li>
        <li className="nav-item">
          <Link to="/broadcast" className="nav-link text-white">
            📨 Рассылка в ЛС
          </Link>
        </li>
        <li className="nav-item mt-3">
          <button
            className="btn btn-outline-light w-100"
            onClick={() => {
              localStorage.removeItem("access");
              localStorage.removeItem("refresh");
              window.location.href = "/login";
            }}
          >
            Выйти
          </button>
        </li>
      </ul>
    </div>
  );
}
