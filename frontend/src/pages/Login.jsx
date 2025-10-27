import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('remembered_username');
    if (saved) setUsername(saved);
  }, []);

  const login = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, password })
      });

      let data = {};
      try { data = await response.json(); } catch {}

      if (response.ok) {
        localStorage.setItem('access', data.access);
        localStorage.setItem('refresh', data.refresh);
        if (remember) localStorage.setItem('remembered_username', username);
        navigate('/');
      } else {
        setError(data.detail || 'Ошибка авторизации. Проверьте логин и пароль.');
      }
    } catch (err) {
      setError('Не удалось подключиться к серверу. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.page} className="min-vh-100 d-flex align-items-center justify-content-center">
      <style>{css}</style>

      <div className="container">
        <div className="row g-4 g-lg-5 align-items-center justify-content-center">
          {/* Left promo panel (hidden on small screens) */}
          <div className="col-lg-6 d-none d-lg-block">
            <div className="promo h-100 rounded-4 p-4 p-xl-5">
              <div className="brand d-flex align-items-center gap-2 mb-4">
                <div className="brand-mark">TR</div>
                <div className="fw-semibold">Teleraptor</div>
              </div>
              <h1 className="display-6 fw-semibold lh-1 mb-3">Добро пожаловать<br/>в панель управления</h1>
              <p className="text-secondary mb-4">Быстрый доступ к вашим инструментам и задачам. Лёгкий, светлый дизайн — меньше шума, больше фокуса.</p>
              <ul className="list-unstyled small text-secondary mb-0">
                <li className="d-flex align-items-center gap-2"><span className="bullet"/>Безопасная авторизация JWT</li>
                <li className="d-flex align-items-center gap-2"><span className="bullet"/>Адаптивный интерфейс</li>
                <li className="d-flex align-items-center gap-2"><span className="bullet"/>Поддержка «Запомнить меня»</li>
              </ul>
            </div>
          </div>

          {/* Right login card */}
          <div className="col-12 col-lg-5 col-xl-4">
            <div className="card login-card border-0 rounded-4 shadow-soft">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="logo-circle mb-3">🔐</div>
                  <h3 className="mb-1 fw-semibold">Вход</h3>
                  <p className="text-secondary mb-0">Доступ к панели управления</p>
                </div>

                {error && (
                  <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
                    <div className="me-3">{error}</div>
                    <button type="button" className="btn-close" aria-label="Close" onClick={() => setError('')}></button>
                  </div>
                )}

                <form onSubmit={login} noValidate>
                  <div className="form-floating mb-3">
                    <input
                      id="username"
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Имя пользователя"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                    <label htmlFor="username">Имя пользователя</label>
                  </div>

                  <div className="form-floating position-relative mb-3">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-control form-control-lg"
                      placeholder="Пароль"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ paddingRight: 100 }}
                    />
                    <label htmlFor="password">Пароль</label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm position-absolute top-50 end-0 translate-middle-y me-2 rounded-pill px-3"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showPassword ? 'Скрыть' : 'Показать'}
                    </button>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="remember"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="remember">Запомнить меня</label>
                    </div>
                    <a href="#" className="link-primary small text-decoration-none" onClick={(e) => e.preventDefault()}>Забыли пароль?</a>
                  </div>

                  <button type="submit" className="btn btn-primary w-100 btn-lg rounded-3" disabled={isLoading || !username || !password}>
                    {isLoading && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"/>}
                    Войти
                  </button>

                  <div className="text-center mt-4">
                    <span className="text-secondary small">Нет аккаунта?</span>{' '}
                    <a href="#" className="small text-decoration-none" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>Зарегистрироваться</a>
                  </div>
                </form>
              </div>
            </div>
            <p className="text-center text-secondary small mt-3 mb-0">Нажимая «Войти», вы соглашаетесь с условиями использования.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background:
      'radial-gradient(1200px 600px at 0% -10%, rgba(99,102,241,.15), transparent 60%),' +
      'radial-gradient(1000px 500px at 100% -20%, rgba(16,185,129,.15), transparent 60%),' +
      'linear-gradient(135deg, #f9fbff 0%, #ffffff 60%)',
    padding: 16,
  }
};

const css = `
:root {
  --brand-primary: #6366f1; /* indigo */
  --brand-accent: #22c55e;  /* green */
  --card-bg: #ffffff;
  --card-border: rgba(60,72,88,.12);
  --shadow-soft: 0 8px 30px rgba(38, 43, 72, .08);
}

/* Promo panel */
.promo {
  background: radial-gradient(600px 300px at 10% 0%, rgba(99,102,241,.15), transparent 60%),
              radial-gradient(800px 400px at 90% 20%, rgba(34,197,94,.12), transparent 60%),
              linear-gradient(135deg, #f2f6ff 0%, #edf9f3 100%);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-soft);
}
.brand-mark {
  width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center;
  background: linear-gradient(90deg, var(--brand-primary), var(--brand-accent));
  color: #fff; font-weight: 700; letter-spacing: .5px; font-size: .9rem;
}
.bullet { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: var(--brand-primary); }

/* Card */
.login-card { background: var(--card-bg); box-shadow: var(--shadow-soft); border: 1px solid var(--card-border); }
.logo-circle { width: 52px; height: 52px; border-radius: 50%; display: inline-grid; place-items: center; background: rgba(99,102,241,.12); color: var(--brand-primary); font-size: 22px; }

/* Inputs */
.form-control { background: #fff; border: 1px solid rgba(60,72,88,.18); }
.form-control:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 .25rem rgba(99,102,241,.15); }
.form-floating > label { color: #6b7280; }

/* Buttons */
.btn-primary { background: linear-gradient(90deg, var(--brand-primary), var(--brand-accent)); border: none; }
.btn-primary:hover { filter: brightness(.98); }
.btn-outline-secondary { border-color: rgba(60,72,88,.3); }
`;
