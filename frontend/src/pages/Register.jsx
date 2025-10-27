import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Если на странице логина сохраняли имя пользователя
    const saved = localStorage.getItem('remembered_username');
    if (saved && !username) setUsername(saved);
  }, [username]);

  const rules = useMemo(() => ({
    length: password.length >= 8,
    lower: /[a-zа-я]/.test(password),
    upper: /[A-ZА-Я]/.test(password),
    digit: /\d/.test(password),
    special: /[^\w\s]/.test(password),
  }), [password]);

  const score = useMemo(() => Object.values(rules).filter(Boolean).length, [rules]);
  const strength = useMemo(() => {
    if (!password) return { label: '—', variant: 'secondary', percent: 0 };
    if (score <= 2) return { label: 'Слабый', variant: 'danger', percent: 30 };
    if (score === 3 || score === 4) return { label: 'Средний', variant: 'warning', percent: 65 };
    return { label: 'Сильный', variant: 'success', percent: 100 };
  }, [password, score]);

  const canSubmit = username && password && confirm && password === confirm;

  const register = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      let data = {};
      try { data = await response.json(); } catch {}

      if (response.ok) {
        setSuccess('Регистрация успешна! Перенаправляю на вход...');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        // Собираем удобочитаемые ошибки из формы DRF: {field: [errors]}
        let msg = '';
        if (data && typeof data === 'object') {
          for (const key of Object.keys(data)) {
            const val = Array.isArray(data[key]) ? data[key].join(', ') : String(data[key]);
            msg += `${key}: ${val}\n`;
          }
        }
        setError(msg.trim() || data.detail || 'Ошибка регистрации');
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
              <h1 className="display-6 fw-semibold lh-1 mb-3">Создайте аккаунт</h1>
              <p className="text-secondary mb-4">Один профиль — доступ ко всем инструментам. Лёгкий светлый интерфейс, фокус на задаче.</p>
              <ul className="list-unstyled small text-secondary mb-0">
                <li className="d-flex align-items-center gap-2"><span className="bullet"/>Защищённые пароли</li>
                <li className="d-flex align-items-center gap-2"><span className="bullet"/>Минимум шагов</li>
                <li className="d-flex align-items-center gap-2"><span className="bullet"/>Адаптивный дизайн</li>
              </ul>
            </div>
          </div>

          {/* Right register card */}
          <div className="col-12 col-lg-5 col-xl-4">
            <div className="card login-card border-0 rounded-4 shadow-soft">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="logo-circle mb-3">✨</div>
                  <h3 className="mb-1 fw-semibold">Регистрация</h3>
                  <p className="text-secondary mb-0">Создайте новый аккаунт</p>
                </div>

                {error && (
                  <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
                    <pre className="mb-0 me-3 small" style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
                    <button type="button" className="btn-close" aria-label="Close" onClick={() => setError('')}></button>
                  </div>
                )}

                {success && (
                  <div className="alert alert-success" role="alert">{success}</div>
                )}

                <form onSubmit={register} noValidate>
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

                  <div className="form-floating mb-3">
                    <input
                      id="email"
                      type="email"
                      className="form-control form-control-lg"
                      placeholder="Email (необязательно)"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <label htmlFor="email">Email (необязательно)</label>
                  </div>

                  <div className="form-floating position-relative mb-3">
                    <input
                      id="password"
                      type={showPass1 ? 'text' : 'password'}
                      className="form-control form-control-lg"
                      placeholder="Пароль"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ paddingRight: 100 }}
                    />
                    <label htmlFor="password">Пароль</label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm position-absolute top-50 end-0 translate-middle-y me-2 rounded-pill px-3"
                      onClick={() => setShowPass1((v) => !v)}
                    >
                      {showPass1 ? 'Скрыть' : 'Показать'}
                    </button>
                  </div>

                  {/* Password strength */}
                  <div className="mb-3">
                    <div className="progress" role="progressbar" aria-label="Сложность пароля" aria-valuemin={0} aria-valuemax={100} aria-valuenow={strength.percent}>
                      <div className={`progress-bar bg-${strength.variant}`} style={{ width: `${strength.percent}%` }} />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-1 small text-secondary">
                      <span>Надёжность: <strong className={`text-${strength.variant}`}>{strength.label}</strong></span>
                      <span className="d-none d-sm-inline">мин. 8 символов, буквы в разных регистрах, цифры, символы</span>
                    </div>
                  </div>

                  <div className="form-floating position-relative mb-3">
                    <input
                      id="confirm"
                      type={showPass2 ? 'text' : 'password'}
                      className={`form-control form-control-lg ${confirm && confirm !== password ? 'is-invalid' : ''}`}
                      placeholder="Подтверждение пароля"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      style={{ paddingRight: 100 }}
                    />
                    <label htmlFor="confirm">Подтверждение пароля</label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm position-absolute top-50 end-0 translate-middle-y me-2 rounded-pill px-3"
                      onClick={() => setShowPass2((v) => !v)}
                    >
                      {showPass2 ? 'Скрыть' : 'Показать'}
                    </button>
                    <div className="invalid-feedback">Пароли не совпадают</div>
                  </div>

                  <button type="submit" className="btn btn-primary w-100 btn-lg rounded-3" disabled={isLoading || !canSubmit}>
                    {isLoading && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"/>}
                    Создать аккаунт
                  </button>

                  <div className="text-center mt-4">
                    <span className="text-secondary small">Уже есть аккаунт?</span>{' '}
                    <a href="#" className="small text-decoration-none" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Войти</a>
                  </div>
                </form>
              </div>
            </div>
            <p className="text-center text-secondary small mt-3 mb-0">Регистрируясь, вы принимаете условия использования.</p>
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

/* Password strength progress */
.progress { height: 8px; }
.progress-bar { transition: width .25s ease; }

/* Buttons */
.btn-primary { background: linear-gradient(90deg, var(--brand-primary), var(--brand-accent)); border: none; }
.btn-primary:hover { filter: brightness(.98); }
.btn-outline-secondary { border-color: rgba(60,72,88,.3); }
`;
