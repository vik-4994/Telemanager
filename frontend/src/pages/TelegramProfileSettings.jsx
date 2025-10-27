import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * TelegramProfileSettings — редактирование профиля ТЕЛЕГРАМ-аккаунта
 * Обновлено: подгружаем текущее фото профиля с бэка (GET /profile/photo/)
 * через fetch+blob (нужен Authorization), с кэш-скидыванием и on-demand refresh.
 */
export default function TelegramProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [accounts, setAccounts] = useState([]); // [{id, phone, name, ...}]
  const [accountId, setAccountId] = useState('');

  const [form, setForm] = useState({ username: '', first_name: '', last_name: '', about: '' });
  const [initial, setInitial] = useState({ username: '', first_name: '', last_name: '', about: '' });
  const [hasPhoto, setHasPhoto] = useState(false);
  const [newPhoto, setNewPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(''); // object URL
  const avatarUrlRef = useRef('');
  const fileRef = useRef();

  const token = localStorage.getItem('access');
  const API = 'http://127.0.0.1:8000/api/accounts';

  // helpers
  const sanitizeUsername = (v) => (v || '').trim().replace(/^@+/, '');
  const revokeAvatarUrl = () => { if (avatarUrlRef.current) { URL.revokeObjectURL(avatarUrlRef.current); avatarUrlRef.current = ''; } };

  // ------- Derived -------
  const hasChanges = useMemo(() => {
    const u1 = sanitizeUsername(form.username).toLowerCase();
    const u0 = sanitizeUsername(initial.username).toLowerCase();
    return (
      u1 !== u0 ||
      (form.first_name || '') !== (initial.first_name || '') ||
      (form.last_name || '') !== (initial.last_name || '') ||
      (form.about || '') !== (initial.about || '') ||
      !!newPhoto
    );
  }, [form, initial, newPhoto]);

  // ------- Effects -------
  useEffect(() => {
    if (!token) return (window.location.href = '/login');
    const run = async () => {
      try {
        const res = await fetch(`${API}/`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length && !accountId) setAccountId(String(data[0].id));
      } catch (_) {
        setError('Не удалось получить список аккаунтов');
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => { revokeAvatarUrl(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accountId) return;
    setError(''); setOk(''); setNewPhoto(null); setPhotoPreview('');
    const run = async () => {
      try {
        const res = await fetch(`${API}/${accountId}/profile/`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Ошибка загрузки профиля');
        const data = await res.json();
        const next = {
          username: sanitizeUsername(data.username || ''),
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          about: data.about || '',
        };
        setForm(next);
        setInitial(next);
        const hp = Boolean(data.has_photo);
        setHasPhoto(hp);
        revokeAvatarUrl();
        setAvatarSrc('');
        if (hp) await loadAvatar(false);
      } catch (e) {
        setError(e.message || 'Не удалось загрузить профиль');
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, token]);

  // ------- Avatar helpers -------
  const loadAvatar = async (force = false) => {
    if (!accountId) return;
    setAvatarLoading(true);
    try {
      const url = `${API}/${accountId}/profile/photo/${force ? '?refresh=1' : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) {
        // фото отсутствует
        revokeAvatarUrl();
        setAvatarSrc('');
        setHasPhoto(false);
        return;
      }
      if (!res.ok) throw new Error('Не удалось получить фото');
      const blob = await res.blob();
      revokeAvatarUrl();
      const objUrl = URL.createObjectURL(blob);
      avatarUrlRef.current = objUrl;
      setAvatarSrc(objUrl);
    } catch (e) {
      // не валим страницу, просто подсказка
      setError(e.message || 'Ошибка получения фото');
    } finally {
      setAvatarLoading(false);
    }
  };

  // ------- Handlers -------
  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setNewPhoto(f);
    const url = URL.createObjectURL(f);
    setPhotoPreview(url);
  };

  const uploadPhoto = async () => {
    if (!newPhoto || !accountId) return;
    setSaving(true); setError(''); setOk('');
    try {
      const fd = new FormData();
      fd.set('photo', newPhoto);
      const res = await fetch(`${API}/${accountId}/profile/photo/`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Не удалось загрузить фото');
      setOk('Фото обновлено');
      setHasPhoto(true);
      setNewPhoto(null);
      setPhotoPreview('');
      if (fileRef.current) fileRef.current.value = '';
      await loadAvatar(true); // сразу показать свежее
    } catch (e) {
      setError(e.message || 'Ошибка загрузки фото');
    } finally { setSaving(false); }
  };

  const save = async (e) => {
    e?.preventDefault?.();
    if (!accountId) return;

    const payload = {};
    const newU = sanitizeUsername(form.username);
    const oldU = sanitizeUsername(initial.username);
    if (newU && newU.toLowerCase() !== oldU.toLowerCase()) payload.username = newU;
    if ((form.first_name || '') !== (initial.first_name || '')) payload.first_name = form.first_name;
    if ((form.last_name || '') !== (initial.last_name || '')) payload.last_name = form.last_name;
    if ((form.about || '') !== (initial.about || '')) payload.about = form.about;

    if (Object.keys(payload).length === 0) {
      setOk('Нет изменений для сохранения');
      return;
    }

    setSaving(true); setError(''); setOk('');
    try {
      const res = await fetch(`${API}/${accountId}/profile/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && data.detail) || 'Не удалось сохранить');
      setOk('Сохранено');
      setInitial({ ...form, username: newU });
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="container py-5 text-center">Загрузка…</div>;

  return (
    <div className="container py-4" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: 'linear-gradient(135deg, #00b894 0%, #0d6efd 100%)',
        boxShadow: '0 16px 40px rgba(13,110,253,.25)'
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Телеграм профиль</div>
            <h2 className="m-0">👤 Настройки аккаунта</h2>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-light" onClick={() => loadAvatar(true)} disabled={!accountId || avatarLoading}>🔄 Обновить фото</button>
            <button className="btn btn-light" onClick={save} disabled={!hasChanges || saving}>{saving ? 'Сохранение…' : '💾 Сохранить'}</button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="alert alert-danger">{error}</div>}
      {ok && <div className="alert alert-success">{ok}</div>}

      {/* Card */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          {/* Account picker */}
          <div className="mb-4">
            <label className="form-label">Аккаунт</label>
            <select className="form-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.phone} {a.name ? `— ${a.name}` : ''}</option>
              ))}
            </select>
            <div className="form-text">Выберите Телеграм-аккаунт для редактирования профиля</div>
          </div>

          <form className="row g-4" onSubmit={save}>
            {/* Avatar */}
            <div className="col-12 col-md-4">
              <div className="d-flex flex-column align-items-center gap-3">
                <div className="rounded-circle overflow-hidden position-relative" style={{ width: 128, height: 128, background: '#f1f3f5' }}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : hasPhoto && avatarSrc ? (
                    <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted" title={hasPhoto ? 'Фото установлено' : 'Фото отсутствует'}>
                      {hasPhoto ? (avatarLoading ? 'загрузка…' : 'фото есть') : 'нет фото'}
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2">
                  <label className="btn btn-outline-secondary mb-0">
                    Загрузить
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
                  </label>
                  <button type="button" className="btn btn-primary" onClick={uploadPhoto} disabled={!newPhoto || saving}>Заменить</button>
                </div>
                <div className="form-text text-center">PNG/JPG, до ~5 МБ</div>
              </div>
            </div>

            {/* Fields */}
            <div className="col-12 col-md-8">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Username</label>
                  <div className="input-group">
                    <span className="input-group-text">@</span>
                    <input
                      className="form-control"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: sanitizeUsername(e.target.value) })}
                      placeholder="username"
                    />
                  </div>
                  <div className="form-text">Если не менять — оставьте как есть</div>
                </div>
                <div className="col-6">
                  <label className="form-label">Имя</label>
                  <input className="form-control" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label">Фамилия</label>
                  <input className="form-control" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
                <div className="col-12">
                  <label className="form-label">Описание</label>
                  <textarea className="form-control" rows={4} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} placeholder="Пара слов о себе" />
                </div>
              </div>
            </div>

            <div className="col-12 d-flex justify-content-end">
              <button type="submit" className="btn btn-primary" disabled={saving || !hasChanges}>{saving ? 'Сохранение…' : 'Сохранить изменения'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function readableErrors(obj) {
  if (!obj || typeof obj !== 'object') return '';
  try {
    const lines = [];
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) lines.push(`${k}: ${v.join(', ')}`);
      else if (v && typeof v === 'object') lines.push(`${k}: ${Object.values(v).join(', ')}`);
      else lines.push(`${k}: ${String(v)}`);
    }
    return lines.join('');
  } catch { return ''; }
}
