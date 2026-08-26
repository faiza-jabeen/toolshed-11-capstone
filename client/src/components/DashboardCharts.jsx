import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

/**
 * Recharts takes colours as props, not CSS, so the tokens are read back out of
 * the stylesheet at render time. That also means the charts re-theme correctly
 * when dark mode is toggled, because this component re-renders with the new
 * computed values.
 */
const token = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const CATEGORY_COLOUR = {
  power: '#2F7D4F', garden: '#7A8B4A', access: '#4A6B8A',
  decorate: '#B4472C', measure: '#8B6F9A', hand: '#8B9793',
};

const fmt = new Intl.NumberFormat('en-GB');
const shortDate = (v) => new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function DashboardCharts({ data }) {
  const t = {
    paint: token('--paint', '#14332A'), tape: token('--tape', '#F5B915'),
    zinc: token('--zinc', '#8B9793'), rule: token('--zinc-2', '#C3CBC7'),
    flag: token('--flag', '#B4472C'), grow: token('--grow', '#2F7D4F'),
    ink: token('--ink', '#0D1A15'), surface: token('--chalk-2', '#fff'),
    mono: token('--mono', 'monospace'),
  };
  const axis = { stroke: t.zinc, fontSize: 11, fontFamily: t.mono, tickLine: false };
  const tip = {
    contentStyle: { background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 3, fontSize: 12, fontFamily: t.mono, color: t.ink },
    labelStyle: { color: t.ink },
  };

  const shelf = [
    { name: 'On the shelf', value: data.shelfState.onShelf ?? 0, fill: t.grow },
    { name: 'Out on loan', value: data.shelfState.onLoan ?? 0, fill: t.tape },
    { name: 'Overdue', value: data.shelfState.overdue ?? 0, fill: t.flag },
    { name: 'In repair', value: data.shelfState.inRepair ?? 0, fill: t.zinc },
  ].filter((s) => s.value > 0);

  return (
    <>
      <div className="stats">
        <Stat label="loans in this period" stat={data.summary.loans} />
        <Stat label="members who borrowed" stat={data.summary.members} />
        <Stat label="deposits held" stat={data.summary.deposits} prefix="£" />
        <Stat label="average days out" stat={data.summary.avgDays} invert />
      </div>

      <div className="grid">
        <Panel wide title="Borrowing over time"
               note="Weekly. The gap between the lines is stock currently out of the building.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.overTime} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={t.rule} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="weekStart" tickFormatter={shortDate} minTickGap={28} {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} labelFormatter={(v) => `Week of ${shortDate(v)}`} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: t.mono }} />
              <Line type="monotone" dataKey="loans" name="Borrowed" stroke={t.grow} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="returned" name="Returned" stroke={t.tape} strokeWidth={2} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Which shelves get used" note="Loans per category in this period.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byCategory} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 12 }}>
              <CartesianGrid stroke={t.rule} strokeDasharray="2 4" horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...axis} />
              <YAxis type="category" dataKey="category" width={72} {...axis} />
              <Tooltip {...tip} cursor={{ fill: 'rgba(127,127,127,.10)' }} />
              <Bar dataKey="loans" name="Loans" radius={[0, 2, 2, 0]}>
                {data.byCategory.map((r) => (
                  <Cell key={r.category} fill={CATEGORY_COLOUR[r.category] ?? t.zinc} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Where everything is right now" note="Live — not filtered by the dates above.">
          <div className="donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={shelf} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="84%"
                     paddingAngle={2} strokeWidth={0}>
                  {shelf.map((s) => <Cell key={s.name} fill={s.fill} />)}
                </Pie>
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: t.mono }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut__centre" aria-hidden="true">
              <span className="donut__figure">{shelf.reduce((n, s) => n + s.value, 0)}</span>
              <span className="donut__label">tools</span>
            </div>
          </div>
        </Panel>

        <Panel wide title="Tools earning their shelf space"
               note="The bottom of a long list is what gets sold off at the summer fair.">
          {data.busiest.length === 0 ? (
            <div className="state">
              <p className="state__title">Nothing went out in this period</p>
              <p className="state__body">Widen the dates.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Tag</th><th>Tool</th><th className="table__num">Loans</th></tr>
                </thead>
                <tbody>
                  {data.busiest.map((r) => (
                    <tr key={r.assetTag}>
                      <td className="table__tag">{r.assetTag}</td>
                      <td>
                        {r.name}
                        <span className="table__bar" aria-hidden="true"
                              style={{ '--w': `${(r.loans / data.busiest[0].loans) * 100}%` }} />
                      </td>
                      <td className="table__num">{r.loans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function Stat({ label, stat, prefix = '', invert = false }) {
  const { value, previous } = stat;
  const delta = !previous ? null : ((value - previous) / previous) * 100;
  const good = delta == null ? null : invert ? delta < 0 : delta > 0;
  return (
    <div className="card stat">
      <p className="stat__label">{label}</p>
      <p className="stat__value">{prefix}{fmt.format(value)}</p>
      {delta == null ? (
        <p className="stat__delta stat__delta--flat">no comparable period</p>
      ) : (
        <p className={`stat__delta stat__delta--${good ? 'good' : 'bad'}`}>
          <span aria-hidden="true">{delta > 0 ? '▲' : '▼'}</span>
          {Math.abs(delta).toFixed(0)}% vs. previous {prefix}{fmt.format(previous)}
        </p>
      )}
    </div>
  );
}

function Panel({ title, note, wide, children }) {
  return (
    <section className={`card panel${wide ? ' panel--wide' : ''}`}>
      <header className="panel__head">
        <h2 className="panel__title">{title}</h2>
        {note && <p className="panel__note">{note}</p>}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
