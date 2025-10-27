import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * ProcessedUsers — Advanced analytics UI (v2)
 * - Новые фильтры: период (from/to), groupBy (hour/day), source, ordering, debounce-поиск
 * - Расширенная сводка: matrix (invite×message), by_source (топ источников)
 * - Тайм‑серии: простая SVG‑линейка (invite_success / message_sent / failed)
 * - Всё в стиле Dashboard/ForwardingGroups
 */
export default function ProcessedUsers() {
  // Base list
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Stats
  const [stats, setStats] = useState(null);
  const [series, setSeries] = useState({ group_by: 'day', points: [] });
  const [topSources, setTopSources] = useState([]);

  // Controls / filters
  const [inviteStatus, setInviteStatus] = useState(''); // '', pending, success, failed
  const [messageStatus, setMessageStatus] = useState(''); // '', pending, sent, failed
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [onlyProcessed, setOnlyProcessed] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [ordering, setOrdering] = useState('-id');
  const [fromDate, setFromDate] = useState(''); // YYYY-MM-DD
  const [toDate, setToDate] = useState('');     // YYYY-MM-DD
  const [groupBy, setGroupBy] = useState('day'); // 'day' | 'hour'
  const [source, setSource] = useState('');

  const [tick, setTick] = useState(0); // manual refresh

  const API_BASE = 'http://127.0.0.1:8000/api';

  // Debounce query
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  // Compose base list qs
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (inviteStatus) p.set('invite_status', inviteStatus);
    if (messageStatus) p.set('message_status', messageStatus);
    if (debouncedQuery) p.set('q', debouncedQuery);
    if (onlyProcessed) p.set('only_processed', 'true');
    if (page > 1) p.set('page', String(page));
    if (ordering) p.set('ordering', ordering);
    if (source) p.set('source', source);
    if (fromDate) p.set('from', `${fromDate}T00:00:00`);
    if (toDate) p.set('to', `${toDate}T23:59:59`);
    return p.toString();
  }, [inviteStatus, messageStatus, debouncedQuery, onlyProcessed, page, ordering, source, fromDate, toDate]);

  // Load list + stats + charts
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchList = async () => {
      setLoading(true); setError('');
      try {
        const data = await authedFetch(`${API_BASE}/processed-users/${qs ? `?${qs}` : ''}`, { signal: controller.signal });
        if (!isMounted) return;
        if (Array.isArray(data)) {
          setItems(data);
          setHasNext(false); setHasPrev(false);
        } else {
          setItems(data.results || []);
          setHasNext(Boolean(data.next));
          setHasPrev(Boolean(data.previous));
        }
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message || 'Ошибка загрузки');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const statQs = (() => {
      const p = new URLSearchParams();
      if (onlyProcessed) p.set('only_processed', 'true');
      if (inviteStatus) p.set('invite_status', inviteStatus);
      if (messageStatus) p.set('message_status', messageStatus);
      if (source) p.set('source', source);
      if (fromDate) p.set('from', `${fromDate}T00:00:00`);
      if (toDate) p.set('to', `${toDate}T23:59:59`);
      return p.toString();
    })();

    const fetchStats = async () => {
      try {
        const s = await authedFetch(`${API_BASE}/processed-users/stats/${statQs ? `?${statQs}` : ''}`);
        if (isMounted) setStats(s);
      } catch (_) { /* noop */ }
    };

    const fetchSeries = async () => {
      try {
        const p = new URLSearchParams(statQs);
        p.set('group_by', groupBy);
        const s = await authedFetch(`${API_BASE}/processed-users/stats/timeseries/?${p.toString()}`);
        if (isMounted) setSeries(s);
      } catch (_) { /* noop */ }
    };

    const fetchTopSources = async () => {
      try {
        const p = new URLSearchParams(statQs);
        p.set('limit', '10');
        const s = await authedFetch(`${API_BASE}/processed-users/stats/top-sources/?${p.toString()}`);
        if (isMounted) setTopSources(s.results || []);
      } catch (_) { /* noop */ }
    };

    fetchList();
    fetchStats();
    fetchSeries();
    fetchTopSources();
    return () => { isMounted = false; controller.abort(); };
  }, [qs, onlyProcessed, groupBy, tick]);

  const exportCSV = () => {
    const header = ['id','user_id','username','name','phone','source_channel','invite_status','message_status','processed'];
    const rows = items.map(r => header.map(k => (r[k] ?? '')).join(','));
    const blob = new Blob([[header.join(','), ...rows].join('')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `processed-users_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const foundCount = items.length;

  // Table sort helper
  const toggleOrdering = (field) => {
    setPage(1);
    setOrdering((cur) => cur === field ? `-${field}` : (cur === `-${field}` ? field : field));
  };

  return (
    <div className="container py-4" style={{ maxWidth: 1200 }}>
      <Style />
      {/* Header */}
      <div className="rounded-4 p-4 mb-4 text-white" style={{
        background: 'linear-gradient(135deg, #6f42c1 0%, #0d6efd 100%)',
        boxShadow: '0 16px 40px rgba(13,110,253,.25)'
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="opacity-75">Аналитика</div>
            <h2 className="m-0">👥 Обработанные пользователи</h2>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-light" onClick={() => setTick(t => t + 1)}>⟳ Обновить</button>
            <button className="btn btn-outline-light" onClick={exportCSV}>⬇ Экспорт CSV</button>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="row g-3 mb-3">
        <KPI title="Всего" value={stats?.total ?? '—'} icon="📊" accent="secondary" />
        <KPI title="Инвайт: success" value={stats?.invite?.success ?? 0} icon="✅" accent="success" />
        <KPI title="Сообщения: sent" value={stats?.message?.sent ?? 0} icon="✉️" accent="info" />
        <KPI title="Ошибок всего" value={stats?.failed ?? 0} icon="⚠️" accent="warning" />
      </div>

      {/* Controls */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            {/* Search */}
            <div className="col-12 col-lg-4">
              <label className="form-label mb-1 small text-muted">Поиск</label>
              <div className="input-group">
                <span className="input-group-text">🔎</span>
                <input
                  className="form-control"
                  placeholder="username / имя / телефон / источник"
                  value={query}
                  onChange={(e) => { setPage(1); setQuery(e.target.value); }}
                />
                {query && (
                  <button className="btn btn-outline-secondary" onClick={() => { setQuery(''); setPage(1); }}>✖</button>
                )}
              </div>
              <div className="form-text">Найдено: {foundCount}</div>
            </div>

            {/* Invite status */}
            <div className="col-6 col-lg-2">
              <label className="form-label mb-1 small text-muted">Инвайт</label>
              <select className="form-select" value={inviteStatus} onChange={(e) => { setPage(1); setInviteStatus(e.target.value); }}>
                <option value="">Все</option>
                <option value="pending">pending</option>
                <option value="success">success</option>
                <option value="failed">failed</option>
              </select>
            </div>

            {/* Message status */}
            <div className="col-6 col-lg-2">
              <label className="form-label mb-1 small text-muted">Сообщение</label>
              <select className="form-select" value={messageStatus} onChange={(e) => { setPage(1); setMessageStatus(e.target.value); }}>
                <option value="">Все</option>
                <option value="pending">pending</option>
                <option value="sent">sent</option>
                <option value="failed">failed</option>
              </select>
            </div>

            {/* Source */}
            <div className="col-12 col-lg-2">
              <label className="form-label mb-1 small text-muted">Источник</label>
              <select className="form-select" value={source} onChange={(e) => { setPage(1); setSource(e.target.value); }}>
                <option value="">Все</option>
                {(stats?.by_source || []).map((s) => (
                  <option key={s.source_channel || 'none'} value={s.source_channel || ''}>{s.source_channel || '—'}</option>
                ))}
              </select>
            </div>

            {/* Period */}
            <div className="col-6 col-lg-2">
              <label className="form-label mb-1 small text-muted">От</label>
              <input type="date" className="form-control" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} />
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label mb-1 small text-muted">До</label>
              <input type="date" className="form-control" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} />
            </div>

            {/* Toggles */}
            <div className="col-12 col-lg-3 d-flex align-items-center gap-3">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="onlyProcessed" checked={onlyProcessed} onChange={(e) => { setPage(1); setOnlyProcessed(e.target.checked); }} />
                <label className="form-check-label" htmlFor="onlyProcessed">Только обработанные</label>
              </div>
              <button className="btn btn-outline-secondary" onClick={() => setTick(t => t + 1)}>Применить</button>
              <button className="btn btn-link text-decoration-none" onClick={() => { setInviteStatus(''); setMessageStatus(''); setQuery(''); setDebouncedQuery(''); setOnlyProcessed(true); setPage(1); setOrdering('-id'); setFromDate(''); setToDate(''); setSource(''); }}>Сбросить</button>
            </div>

            {/* Group by */}
            <div className="col-12 col-lg-2 ms-auto">
              <label className="form-label mb-1 small text-muted">Группировка</label>
              <select className="form-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                <option value="day">по дням</option>
                <option value="hour">по часам</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Charts & matrices */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="m-0">Динамика</h6>
                <div className="text-muted small">{series?.points?.length || 0} точек</div>
              </div>
              <LineChart
                height={220}
                points={series?.points || []}
                lines={[
                  { key: 'invite_success', label: 'Invite success' },
                  { key: 'message_sent', label: 'Message sent' },
                  { key: 'failed_total', label: 'Failed (i+m)' },
                ]}
              />
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h6 className="mb-3">Матрица статусов</h6>
              <Matrix matrix={stats?.matrix} />
            </div>
          </div>
        </div>
      </div>

      {/* Top sources */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h6 className="mb-3">Топ источников (по total)</h6>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Источник</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Success</th>
                  <th className="text-end">Sent</th>
                  <th className="text-end">Failed</th>
                  <th className="text-end">CR</th>
                </tr>
              </thead>
              <tbody>
                {(topSources || []).length === 0 ? (
                  <tr><td colSpan={6} className="text-muted">Нет данных</td></tr>
                ) : (
                  topSources.map((r, i) => (
                    <tr key={r.source_channel || i}>
                      <td>{r.source_channel || '—'}</td>
                      <td className="text-end">{r.total}</td>
                      <td className="text-end">{r.success}</td>
                      <td className="text-end">{r.sent}</td>
                      <td className="text-end">{r.failed}</td>
                      <td className="text-end">{(r.cr * 100).toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive" style={{ maxHeight: '65vh' }}>
          <table className="table table-hover align-middle m-0">
            <thead className="table-light sticky-top" style={{ top: 0, zIndex: 1 }}>
              <tr>
                <Th onClick={() => toggleOrdering('id')} activeField={ordering} field="id" style={{width:'6rem'}}>ID</Th>
                <Th onClick={() => toggleOrdering('user_id')} activeField={ordering} field="user_id">User ID</Th>
                <Th onClick={() => toggleOrdering('username')} activeField={ordering} field="username">Username</Th>
                <Th onClick={() => toggleOrdering('name')} activeField={ordering} field="name">Имя</Th>
                <Th onClick={() => toggleOrdering('phone')} activeField={ordering} field="phone">Телефон</Th>
                <Th onClick={() => toggleOrdering('source_channel')} activeField={ordering} field="source_channel">Источник</Th>
                <th>Инвайт</th>
                <th>Сообщение</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} />
              ) : error ? (
                <tr><td colSpan={8} className="text-danger p-4">{error}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="text-center p-5 text-muted">Ничего не найдено</td></tr>
              ) : (
                items.map(row => (
                  <tr key={row.id}>
                    <td className="text-secondary">#{row.id}</td>
                    <td>{row.user_id}</td>
                    <td className="fw-semibold">{row.username || '—'}</td>
                    <td>{row.name || '—'}</td>
                    <td>{row.phone || '—'}</td>
                    <td>{row.source_channel || '—'}</td>
                    <td>{badgeInvite(row.invite_status)}</td>
                    <td>{badgeMessage(row.message_status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="d-flex justify-content-between align-items-center p-3 border-top">
          <div className="small text-muted">Стр. {page}</div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" disabled={!hasPrev || loading || page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Назад</button>
            <button className="btn btn-outline-secondary btn-sm" disabled={!hasNext || loading} onClick={() => setPage(p => p+1)}>Вперёд</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children, field, activeField, onClick, ...rest }) {
  const is = activeField === field || activeField === `-${field}`;
  const dir = activeField === `-${field}` ? '↓' : (activeField === field ? '↑' : '');
  return (
    <th role="button" onClick={onClick} {...rest}>
      <span className="user-select-none">{children} {is && <small className="text-muted">{dir}</small>}</span>
    </th>
  );
}

function badgeInvite(s) {
  const map = { pending: 'secondary', success: 'success', failed: 'danger' };
  const label = { pending: 'pending', success: 'success', failed: 'failed' }[s] || s || '—';
  const variant = map[s] || 'secondary';
  return <span className={`badge bg-${variant}`}>{label}</span>;
}

function badgeMessage(s) {
  const map = { pending: 'secondary', sent: 'primary', failed: 'danger' };
  const label = { pending: 'pending', sent: 'sent', failed: 'failed' }[s] || s || '—';
  const variant = map[s] || 'secondary';
  return <span className={`badge bg-${variant}`}>{label}</span>;
}

async function authedFetch(url, opts = {}) {
  const access = localStorage.getItem('access');
  const refresh = localStorage.getItem('refresh');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (access) headers['Authorization'] = `Bearer ${access}`;

  const res = await fetch(url, { ...opts, headers });
  if (res.status !== 401) {
    // /photo/ может вернуть не-JSON; здесь у нас только JSON эндпоинты
    return res.json();
  }

  // Try refresh
  if (!refresh) throw new Error('Не авторизован');
  const r = await fetch('http://127.0.0.1:8000/api/token/refresh/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh })
  });
  if (!r.ok) throw new Error('Сессия истекла');
  const data = await r.json();
  localStorage.setItem('access', data.access);

  const retryHeaders = { ...headers, Authorization: `Bearer ${data.access}` };
  const retry = await fetch(url, { ...opts, headers: retryHeaders });
  if (!retry.ok) throw new Error('Ошибка запроса');
  return retry.json();
}

function KPI({ title, value, icon, accent = 'secondary' }) {
  return (
    <div className="col-6 col-lg-3">
      <div className={`card border-0 shadow-sm h-100 bg-${accent}-subtle`}>
        <div className="card-body d-flex align-items-center gap-3">
          <div style={{ fontSize: 26 }}>{icon}</div>
          <div>
            <div className="text-muted small">{title}</div>
            <div className="h4 m-0">{value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows({ rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={8}>
            <div className="placeholder-wave p-2">
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-1 me-2"></span>
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-2 me-2"></span>
              <span className="placeholder col-3"></span>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function Matrix({ matrix }) {
  const inv = ['pending','success','failed'];
  const msg = ['pending','sent','failed'];
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle matrix">
        <thead>
          <tr>
            <th></th>
            {msg.map((m) => <th key={m} className="text-center text-muted">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {inv.map((i) => (
            <tr key={i}>
              <th className="text-muted">{i}</th>
              {msg.map((m) => {
                const v = matrix?.[i]?.[m] || 0;
                const cls = (i==='success'&&m==='sent') ? 'bg-success-subtle' : (i==='failed'||m==='failed') ? 'bg-danger-subtle' : 'bg-body-tertiary';
                return <td key={m} className={`text-center fw-semibold ${cls}`}>{v}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineChart({ height = 220, points = [], lines = [] }) {
  // Build derived values
  const data = (points || []).map(p => ({
    ts: p.ts,
    invite_success: p.invite_success || 0,
    invite_failed: p.invite_failed || 0,
    message_sent: p.message_sent || 0,
    message_failed: p.message_failed || 0,
    failed_total: (p.invite_failed || 0) + (p.message_failed || 0),
  }));
  const width = 680; // fits col-xl-8
  const padding = { l: 40, r: 10, t: 10, b: 24 };
  const innerW = width - padding.l - padding.r;
  const innerH = height - padding.t - padding.b;

  const maxY = Math.max(1, ...data.flatMap(d => lines.map(l => d[l.key] || 0)));
  const x = (i) => (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW);
  const y = (v) => innerH - (v / maxY) * innerH;

  const buildPath = (key) => {
    if (!data.length) return '';
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${padding.l + x(i)} ${padding.t + y(d[key] || 0)}`).join(' ');
    };

  const ticks = 5;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxY / ticks) * i));

  return (
    <div className="chart-wrap" style={{ overflowX: 'auto' }}>
      <svg width={width} height={height}>
        {/* axes */}
        <line x1={padding.l} y1={padding.t} x2={padding.l} y2={padding.t + innerH} stroke="#ccc" />
        <line x1={padding.l} y1={padding.t + innerH} x2={padding.l + innerW} y2={padding.t + innerH} stroke="#ccc" />
        {/* y ticks */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padding.l - 4} x2={padding.l} y1={padding.t + y(t)} y2={padding.t + y(t)} stroke="#888" />
            <text x={padding.l - 6} y={padding.t + y(t)} textAnchor="end" dominantBaseline="middle" className="tick">{t}</text>
          </g>
        ))}
        {/* paths */}
        {lines.map((l, idx) => (
          <path key={l.key} d={buildPath(l.key)} fill="none" stroke={palette(idx)} strokeWidth="2" />
        ))}
        {/* legend */}
        {lines.map((l, idx) => (
          <g key={`leg-${l.key}`} transform={`translate(${padding.l + idx*160}, ${padding.t})`}>
            <rect width="12" height="12" fill={palette(idx)} />
            <text x="16" y="10" className="legend">{l.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function palette(i){
  const colors = ['#0d6efd', '#198754', '#dc3545', '#6f42c1', '#20c997'];
  return colors[i % colors.length];
}

function Style(){
  return (
    <style>{`
      .matrix td, .matrix th { vertical-align: middle; }
      .tick { fill: #6c757d; font-size: 11px; }
      .legend { fill: #6c757d; font-size: 12px; }
    `}</style>
  );
}
