import { useState } from 'react';
import { useCatalogueStore } from '../stores/catalogueStore.js';
import { useSessionStore, selectIsKeeper } from '../stores/sessionStore.js';

const BLANK = { assetTag: '', name: '', category: 'power', shelf: '', deposit: '', notes: '' };

export function AddToolForm() {
  const isKeeper = useSessionStore(selectIsKeeper);
  const create = useCatalogueStore((s) => s.create);
  const busy = useCatalogueStore((s) => s.formBusy);
  const [values, setValues] = useState(BLANK);
  const [fields, setFields] = useState({});

  if (!isKeeper) return null;

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setFields({});
    const res = await create({
      ...values,
      assetTag: values.assetTag.trim().toUpperCase(),
      name: values.name.trim(),
      shelf: values.shelf.trim(),
      deposit: Number(values.deposit || 0),
    });
    if (res.ok) setValues(BLANK);
    else if (res.fields) setFields(res.fields);
  }

  return (
    <form className="panel addform" onSubmit={submit} noValidate>
      <fieldset disabled={busy} className="addform__set">
        <legend className="addform__legend">Add a tool</legend>
        <div className="addform__grid">
          <Cell label="Asset tag" error={fields.assetTag}>
            <input className="input" value={values.assetTag} onChange={set('assetTag')}
                   placeholder="TS-0142" aria-invalid={!!fields.assetTag} />
          </Cell>
          <Cell label="Name" error={fields.name}>
            <input className="input" value={values.name} onChange={set('name')}
                   placeholder="Random orbital sander" aria-invalid={!!fields.name} />
          </Cell>
          <Cell label="Category" error={fields.category}>
            <select className="select" value={values.category} onChange={set('category')}>
              {['power','garden','decorate','access','measure','hand'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Cell>
          <Cell label="Shelf" error={fields.shelf}>
            <input className="input" value={values.shelf} onChange={set('shelf')}
                   placeholder="B2" aria-invalid={!!fields.shelf} />
          </Cell>
          <Cell label="Deposit (£)" error={fields.deposit}>
            <input className="input" type="number" min="0" max="500" value={values.deposit}
                   onChange={set('deposit')} placeholder="0" aria-invalid={!!fields.deposit} />
          </Cell>
          <Cell label="Notes" error={fields.notes} wide>
            <input className="input" value={values.notes} onChange={set('notes')}
                   placeholder="Anything the next borrower needs to know." />
          </Cell>
        </div>
        <button className="btn btn--tape addform__submit" type="submit" disabled={busy}>
          {busy && <span className="spinner" />}{busy ? 'Adding…' : 'Add tool'}
        </button>
      </fieldset>
    </form>
  );
}

function Cell({ label, error, wide, children }) {
  return (
    <label className={`field${wide ? ' field--wide' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}
