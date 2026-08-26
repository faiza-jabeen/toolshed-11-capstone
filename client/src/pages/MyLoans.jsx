import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoanStore, useOpenLoans, useClosedLoans, selectLoanBusy } from '../stores/loanStore.js';
import { useSessionStore, selectUser } from '../stores/sessionStore.js';
import { RowsSkeleton } from '../components/Skeletons.jsx';

const plus = (d) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

/** Page 3 — protected. A member's own borrowing. */
export default function MyLoans() {
  const user = useSessionStore(selectUser);
  const load = useLoanStore((s) => s.load);
  const status = useLoanStore((s) => s.status);
  const error = useLoanStore((s) => s.error);
  const open = useOpenLoans();
  const closed = useClosedLoans();

  useEffect(() => { load({ scope: 'mine' }); }, [load]);

  return (
    <div className="u-shell page">
      <div className="page__head">
        <p className="eyebrow">Your account</p>
        <h1 className="page__title">What you have out, {user.name.split(' ')[0]}.</h1>
        <p className="page__body u-measure">
          Three tools at a time, seven days each. Extend a loan here if a job
          runs over; the keepers check tools back in at the desk.
        </p>
      </div>

      {status === 'loading' && <RowsSkeleton count={3} />}

      {status === 'error' && (
        <div className="state state--error" role="alert">
          <p className="state__title">Your loans could not be loaded</p>
          <p className="state__body">{error.message}</p>
          <button className="btn btn--primary" onClick={() => load({ scope: 'mine' })}>Try again</button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <h2 className="section__label">Out now ({open.length})</h2>
          {open.length === 0 ? (
            <div className="state">
              <p className="state__title">Nothing out at the moment</p>
              <p className="state__body">
                When you borrow something it appears here with its return date.
              </p>
              <Link className="btn btn--tape" to="/">Browse the shelf</Link>
            </div>
          ) : (
            <div className="rows">{open.map((loan) => <OpenLoan key={loan.id} loan={loan} />)}</div>
          )}

          <h2 className="section__label">Previously borrowed ({closed.length})</h2>
          {closed.length === 0 ? (
            <p className="page__count">Nothing yet — this fills up as you return things.</p>
          ) : (
            <ul className="history">
              {closed.slice(0, 20).map((loan) => (
                <li className="history__row" key={loan.id}>
                  <span className="history__tag">{loan.tool?.assetTag}</span>
                  <span className="history__name">{loan.tool?.name}</span>
                  <span className="history__dates">{loan.borrowedOn} → {loan.returnedOn}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function OpenLoan({ loan }) {
  const patch = useLoanStore((s) => s.patch);
  const busy = useLoanStore(selectLoanBusy(loan.id));
  const [extending, setExtending] = useState(false);
  const [dueOn, setDueOn] = useState(loan.dueOn);
  const [fieldError, setFieldError] = useState('');

  async function save(e) {
    e.preventDefault();
    setFieldError('');
    const res = await patch(loan.id, { dueOn, note: loan.note }, 'extend');
    if (res.ok) setExtending(false);
    else setFieldError(res.fields?.dueOn ?? '');
  }

  return (
    <article className={`tag row${loan.overdue ? ' row--overdue' : ''}`}>
      <p className="tag__id">
        <span>{loan.tool?.assetTag}</span>
        <span>{loan.tool?.category}</span>
      </p>
      <h3 className="tag__name">{loan.tool?.name}</h3>
      {loan.note && <p className="row__notes">{loan.note}</p>}

      <div className="row__meta">
        <span className={`pip pip--${loan.overdue ? 'out' : 'in'}`}>
          {loan.overdue ? `Overdue since ${loan.dueOn}` : `Due back ${loan.dueOn}`}
        </span>
        <span className="row__deposit">borrowed {loan.borrowedOn}</span>
      </div>

      {extending ? (
        <form className="row__extend" onSubmit={save}>
          <label className="field">
            <span className="field__label">New return date</span>
            <input className="input" type="date" value={dueOn} min={plus(1)} max={plus(7)}
                   onChange={(e) => setDueOn(e.target.value)} aria-invalid={!!fieldError} />
            {fieldError && <span className="field__error">{fieldError}</span>}
          </label>
          <div className="row__actions">
            <button className="btn btn--tape btn--sm" type="submit" disabled={busy === 'extend'}>
              {busy === 'extend' && <span className="spinner" />}{busy === 'extend' ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn--ghost btn--sm" type="button" onClick={() => setExtending(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="row__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setExtending(true)}>Extend</button>
          <span className="row__hint">Return it at the desk.</span>
        </div>
      )}
    </article>
  );
}
