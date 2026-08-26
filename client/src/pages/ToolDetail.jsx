import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/http.js';
import { useSessionStore, selectSessionStatus, selectIsKeeper } from '../stores/sessionStore.js';
import { useLoanStore } from '../stores/loanStore.js';

const LABEL = { in: 'On the shelf', out: 'Out on loan', repair: 'In repair' };
const plus = (d) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);

/** Page 2 — one tool, and the place a member actually borrows it. */
export default function ToolDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const signedIn = useSessionStore(selectSessionStatus) === 'authenticated';
  const isKeeper = useSessionStore(selectIsKeeper);
  const borrow = useLoanStore((s) => s.borrow);
  const borrowing = useLoanStore((s) => s.borrowing);

  const [state, setState] = useState({ status: 'loading', tool: null, error: null });
  const [dueOn, setDueOn] = useState(plus(7));
  const [note, setNote] = useState('');
  const [fields, setFields] = useState({});

  useEffect(() => {
    let live = true;
    setState({ status: 'loading', tool: null, error: null });
    api(`/tools/${id}`)
      .then((tool) => live && setState({ status: 'ready', tool, error: null }))
      .catch((error) => live && setState({ status: 'error', tool: null, error }));
    return () => { live = false; };
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    setFields({});
    const res = await borrow(state.tool, { dueOn, note });
    if (res.ok) navigate('/loans');
    else if (res.fields) setFields(res.fields);
  }

  if (state.status === 'loading') {
    return (
      <div className="u-shell page">
        <div className="skeleton" style={{ height: '.8rem', width: '30%' }} />
        <div className="skeleton" style={{ height: '2.5rem', width: '60%', marginTop: '1rem' }} />
        <div className="skeleton" style={{ height: '10rem', width: '100%', marginTop: '2rem' }} />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="u-shell page">
        <div className="state state--error" role="alert">
          <p className="state__title">That tool could not be loaded</p>
          <p className="state__body">{state.error.message}</p>
          <Link className="btn btn--primary" to="/">Back to the catalogue</Link>
        </div>
      </div>
    );
  }

  const tool = state.tool;
  const available = tool.status === 'in';

  return (
    <div className="u-shell page detail">
      <p className="crumb"><Link to="/">← Catalogue</Link></p>

      <div className="detail__head">
        <p className="eyebrow">{tool.assetTag} · Shelf {tool.shelf}</p>
        <h1 className="page__title">{tool.name}</h1>
        <p className={`pip pip--${available ? 'in' : 'out'} detail__pip`}>{LABEL[tool.status]}</p>
      </div>

      <div className="detail__grid">
        <div className="panel">
          <h2 className="panel__title">What you should know</h2>
          <p className="detail__notes">{tool.notes || 'Nothing recorded for this one.'}</p>
          <dl className="facts">
            <div className="facts__row"><dt>Deposit</dt><dd>£{tool.deposit}, refunded on return</dd></div>
            <div className="facts__row"><dt>Shelf</dt><dd>{tool.shelf}</dd></div>
            <div className="facts__row"><dt>Category</dt><dd>{tool.category}</dd></div>
            {tool.currentLoan && (
              <div className="facts__row">
                <dt>Back on</dt>
                <dd className={tool.currentLoan.overdue ? 'is-overdue' : undefined}>
                  {tool.currentLoan.dueOn}{tool.currentLoan.overdue && ' — overdue'}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="panel">
          <h2 className="panel__title">Borrow it</h2>

          {!signedIn && (
            <>
              <p className="detail__notes">Members borrow up to three tools at a time.</p>
              <Link className="btn btn--tape" to="/signin" state={{ from: { pathname: `/tools/${id}` } }}>
                Sign in to borrow
              </Link>
            </>
          )}

          {signedIn && !available && (
            <div className="state">
              <p className="state__title">Not available right now</p>
              <p className="state__body">
                {tool.status === 'out'
                  ? `It is with another member${tool.currentLoan ? ` until ${tool.currentLoan.dueOn}` : ''}. Check back then.`
                  : 'It is in for repair. The keepers will put it back on the shelf when it is fixed.'}
              </p>
              <Link className="btn btn--ghost" to="/">Find something else</Link>
            </div>
          )}

          {signedIn && available && (
            <form onSubmit={submit} noValidate className="detail__form">
              <label className="field">
                <span className="field__label">Bring it back by</span>
                <input className="input" type="date" value={dueOn} min={plus(1)} max={plus(isKeeper ? 14 : 7)}
                       onChange={(e) => setDueOn(e.target.value)} aria-invalid={!!fields.dueOn}
                       disabled={borrowing === tool.id} />
                {fields.dueOn
                  ? <span className="field__error">{fields.dueOn}</span>
                  : <span className="field__hint">Up to {isKeeper ? 14 : 7} days.</span>}
              </label>

              <label className="field">
                <span className="field__label">What is it for?</span>
                <input className="input" value={note} maxLength={200} placeholder="Putting up shelves in the back bedroom."
                       onChange={(e) => setNote(e.target.value)} aria-invalid={!!fields.note}
                       disabled={borrowing === tool.id} />
                {fields.note
                  ? <span className="field__error">{fields.note}</span>
                  : <span className="field__hint">Optional. Helps us decide what to buy next.</span>}
              </label>

              <button className="btn btn--tape" type="submit" disabled={borrowing === tool.id}>
                {borrowing === tool.id && <span className="spinner" />}
                {borrowing === tool.id ? 'Reserving…' : `Borrow — £${tool.deposit} deposit`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
