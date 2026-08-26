import { useEffect, useState } from 'react';
import { useCatalogueStore, useVisibleTools } from '../stores/catalogueStore.js';
import { useLoanStore, useOpenLoans, useOverdueLoans, selectLoanBusy } from '../stores/loanStore.js';
import { AddToolForm } from '../components/AddToolForm.jsx';
import { RowsSkeleton } from '../components/Skeletons.jsx';
import { toast } from '../stores/uiStore.js';

/** Page 4 — keeper only. The Saturday-morning desk: check in, add, retire. */
export default function Desk() {
  const loadTools = useCatalogueStore((s) => s.load);
  const loadLoans = useLoanStore((s) => s.load);
  const loanStatus = useLoanStore((s) => s.status);
  const open = useOpenLoans();
  const overdue = useOverdueLoans();
  const [tab, setTab] = useState('checkin');

  useEffect(() => { loadTools(); loadLoans(); }, [loadTools, loadLoans]);

  return (
    <div className="u-shell page">
      <div className="page__head">
        <p className="eyebrow">Keeper desk</p>
        <h1 className="page__title">Saturday morning.</h1>
        <p className="page__body u-measure">
          Everything out of the building, and the two things you do most:
          check tools back in, and add new donations to the catalogue.
        </p>
      </div>

      {overdue.length > 0 && (
        <p className="alert" role="status">
          {overdue.length} {overdue.length === 1 ? 'tool is' : 'tools are'} overdue.
          Worth a phone call before the end of the day.
        </p>
      )}

      <div className="tabs" role="tablist">
        {[['checkin', `Out now (${open.length})`], ['add', 'Add a tool'], ['catalogue', 'Whole catalogue']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id}
                  className={`tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'checkin' && (
        loanStatus === 'loading' ? <RowsSkeleton count={3} /> :
        open.length === 0 ? (
          <div className="state">
            <p className="state__title">Everything is back</p>
            <p className="state__body">Every tool is on its shelf. Rare, and worth enjoying.</p>
          </div>
        ) : (
          <div className="rows">{open.map((loan) => <CheckInRow key={loan.id} loan={loan} />)}</div>
        )
      )}

      {tab === 'add' && <AddToolForm />}
      {tab === 'catalogue' && <CatalogueAdmin />}
    </div>
  );
}

function CheckInRow({ loan }) {
  const checkIn = useLoanStore((s) => s.checkIn);
  const busy = useLoanStore(selectLoanBusy(loan.id));
  const loadTools = useCatalogueStore((s) => s.load);

  async function handle() {
    const res = await checkIn(loan);
    // The tool's status changed server-side; refresh so the catalogue agrees.
    if (res.ok) loadTools();
  }

  return (
    <article className={`tag row${loan.overdue ? ' row--overdue' : ''}`}>
      <p className="tag__id">
        <span>{loan.tool?.assetTag}</span>
        <span>{loan.overdue ? 'OVERDUE' : `due ${loan.dueOn}`}</span>
      </p>
      <h3 className="tag__name">{loan.tool?.name}</h3>
      <p className="row__notes">
        With <strong>{loan.member?.name}</strong> since {loan.borrowedOn}
        {loan.note && <> — “{loan.note}”</>}
      </p>
      <div className="row__meta">
        <span className={`pip pip--${loan.overdue ? 'out' : 'in'}`}>
          {loan.overdue ? `Overdue since ${loan.dueOn}` : `Due ${loan.dueOn}`}
        </span>
        <span className="row__deposit">{loan.member?.email}</span>
      </div>
      <div className="row__actions">
        <button className="btn btn--tape btn--sm" onClick={handle} disabled={!!busy}>
          {busy === 'return' && <span className="spinner" />}
          {busy === 'return' ? 'Checking in…' : 'Check it back in'}
        </button>
      </div>
    </article>
  );
}

function CatalogueAdmin() {
  const status = useCatalogueStore((s) => s.status);
  const remove = useCatalogueStore((s) => s.remove);
  const rowBusy = useCatalogueStore((s) => s.rowBusy);
  const tools = useVisibleTools();
  const term = useCatalogueStore((s) => s.term);
  const setTerm = useCatalogueStore((s) => s.setTerm);

  if (status === 'loading') return <RowsSkeleton />;

  return (
    <>
      <label className="field" style={{ maxWidth: '22rem', marginBottom: '1.5rem' }}>
        <span className="field__label">Find a tool</span>
        <input className="input" type="search" value={term} placeholder="TS-0117, sander…"
               onChange={(e) => setTerm(e.target.value)} />
      </label>
      <div className="rows">
        {tools.map((tool) => (
          <article className="tag row" key={tool.id}>
            <p className="tag__id"><span>{tool.assetTag}</span><span>Shelf {tool.shelf}</span></p>
            <h3 className="tag__name">{tool.name}</h3>
            <div className="row__meta">
              <span className={`pip pip--${tool.status === 'in' ? 'in' : 'out'}`}>{tool.status}</span>
              <span className="row__deposit">£{tool.deposit}</span>
            </div>
            <div className="row__actions">
              <button className="btn btn--danger btn--sm" disabled={!!rowBusy[tool.id]}
                      onClick={async () => {
                        const res = await remove(tool);
                        if (res?.ok && res.meta?.retired) {
                          toast.ok(`${tool.assetTag} retired — ${res.meta.keptFor} loans of history kept.`);
                        }
                      }}>
                {rowBusy[tool.id] === 'delete' && <span className="spinner" />}
                {rowBusy[tool.id] === 'delete' ? 'Retiring…' : 'Retire'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
