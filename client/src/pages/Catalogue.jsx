import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCatalogueStore, useVisibleTools, useCounts, selectIsFiltering } from '../stores/catalogueStore.js';
import { useSessionStore, selectIsKeeper } from '../stores/sessionStore.js';
import { RowsSkeleton, StatsSkeleton } from '../components/Skeletons.jsx';
import { EmptyCatalogue, EmptyFiltered, CatalogueError } from '../components/EmptyStates.jsx';
import { ToolCard } from '../components/ToolCard.jsx';

const CATEGORIES = ['', 'power', 'garden', 'decorate', 'access', 'measure', 'hand'];

/** Page 1 — public. The shelf, searchable, with live counts. */
export default function Catalogue() {
  const location = useLocation();
  const load = useCatalogueStore((s) => s.load);
  const status = useCatalogueStore((s) => s.status);
  const error = useCatalogueStore((s) => s.error);
  const total = useCatalogueStore((s) => s.tools.length);
  const term = useCatalogueStore((s) => s.term);
  const category = useCatalogueStore((s) => s.category);
  const setTerm = useCatalogueStore((s) => s.setTerm);
  const setCategory = useCatalogueStore((s) => s.setCategory);
  const clearFilters = useCatalogueStore((s) => s.clearFilters);
  const visible = useVisibleTools();
  const counts = useCounts();
  const isKeeper = useSessionStore(selectIsKeeper);
  const filtering = useCatalogueStore(selectIsFiltering);

  useEffect(() => { load(); }, [load]);

  const loading = status === 'loading' || status === 'idle';

  return (
    <div className="u-shell page">
      {location.state?.denied && (
        <p className="alert" role="alert">That area is for {location.state.denied} accounts.</p>
      )}

      <div className="page__head">
        <p className="eyebrow">On the shelf</p>
        <h1 className="page__title">Own the hole. Not the drill.</h1>
        <p className="page__body u-measure">
          Everything the shed owns, and whether it is here today. Members borrow
          up to three things at a time for a week.
        </p>
      </div>

      {loading ? <StatsSkeleton /> : status === 'ready' && (
        <div className="stats">
          {[
            { label: 'in the catalogue', value: counts.total },
            { label: 'on the shelf', value: counts.onShelf, tone: 'in' },
            { label: 'out on loan', value: counts.onLoan, tone: 'out' },
            { label: 'in repair', value: counts.inRepair, tone: 'repair' },
          ].map((c) => (
            <div className={`card stat${c.tone ? ` stat--${c.tone}` : ''}`} key={c.label}>
              <p className="stat__label">{c.label}</p>
              <p className="stat__value">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="filters">
        <label className="field filters__search">
          <span className="field__label">Search the catalogue</span>
          <input className="input" type="search" value={term} disabled={loading}
                 placeholder="sander, TS-0117, goggles…" onChange={(e) => setTerm(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Category</span>
          <select className="select" value={category} disabled={loading}
                  onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c || 'all'} value={c}>{c || 'All shelves'}</option>)}
          </select>
        </label>
      </div>

      <p className="page__count" role="status" aria-live="polite">
        {loading && 'Loading the catalogue…'}
        {status === 'ready' && `${visible.length} of ${total} tools`}
        {status === 'error' && 'Catalogue unavailable'}
      </p>

      {loading && <RowsSkeleton />}
      {status === 'error' && <CatalogueError error={error} onRetry={load} />}
      {status === 'ready' && total === 0 && <EmptyCatalogue canAdd={isKeeper} />}
      {status === 'ready' && total > 0 && visible.length === 0 && (
        <EmptyFiltered term={term} category={category} onClear={clearFilters} />
      )}
      {status === 'ready' && visible.length > 0 && (
        <div className="rows">
          {visible.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
        </div>
      )}

      {isKeeper && (
        <p className="page__aside">
          Keeper? <Link to="/desk">Go to the desk</Link> to add tools and check them in.
        </p>
      )}
    </div>
  );
}
