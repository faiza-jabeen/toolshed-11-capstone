import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { api } from '../api/http.js';
import { StatsSkeleton } from '../components/Skeletons.jsx';

/** Stretch goal 1 — page 6, keeper only. Charts load lazily; recharts is big. */
const Charts = lazy(() => import('../components/DashboardCharts.jsx'));

const iso = (d) => d.toISOString().slice(0, 10);
const ago = (days) => iso(new Date(Date.now() - days * 86400_000));
const PRESETS = [['28', 'Last 4 weeks', 28], ['90', 'Last 3 months', 90], ['365', 'Last year', 365]];

export default function Dashboard() {
  const [preset, setPreset] = useState('90');
  const [range, setRange] = useState({ from: ago(90), to: iso(new Date()) });
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(async ({ from, to }) => {
    setState((s) => ({ ...s, status: s.data ? 'refreshing' : 'loading' }));
    try {
      const data = await api(`/stats?from=${from}&to=${to}`, { auth: true });
      setState({ status: 'ready', data, error: null });
    } catch (error) {
      setState((s) => ({ ...s, status: 'error', error }));
    }
  }, []);

  useEffect(() => { load(range); }, [load, range]);

  const { status, data, error } = state;
  const first = status === 'loading' && !data;

  return (
    <div className="u-shell page">
      <div className="page__head">
        <p className="eyebrow">Keeper dashboard</p>
        <h1 className="page__title">Is the shed actually being used?</h1>
        <p className="page__body u-measure">
          Aggregated in SQL and returned in one request. The trustees see this
          before each quarterly meeting.
        </p>
      </div>

      <div className="controls__presets" role="group" aria-label="Date range">
        {PRESETS.map(([id, label, days]) => (
          <button key={id} className={`chip${preset === id ? ' is-active' : ''}`}
                  aria-pressed={preset === id}
                  onClick={() => { setPreset(id); setRange({ from: ago(days), to: iso(new Date()) }); }}>
            {label}
          </button>
        ))}
      </div>

      {status === 'refreshing' && (
        <p className="page__count" role="status"><span className="spinner" /> Updating figures…</p>
      )}

      {status === 'error' && !data && (
        <div className="state state--error" role="alert">
          <p className="state__title">The dashboard could not load</p>
          <p className="state__body">{error.message}</p>
          <button className="btn btn--primary" onClick={() => load(range)}>Try again</button>
        </div>
      )}

      {first ? <StatsSkeleton /> : data && (
        <Suspense fallback={<StatsSkeleton />}>
          <Charts data={data} />
        </Suspense>
      )}
    </div>
  );
}
