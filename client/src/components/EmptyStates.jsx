/**
 * Empty is not the same as loading, and "no results after filtering" is not the
 * same as "there is genuinely nothing here". Three different situations, three
 * different screens, each with the action that resolves it.
 */
export function EmptyCatalogue({ canAdd }) {
  return (
    <div className="state">
      <p className="state__title">The shed is empty</p>
      <p className="state__body">
        No tools have been logged yet. {canAdd
          ? 'Add the first one with the form above — asset tags run from TS-0001 upward.'
          : 'A keeper needs to add the first one. Sign in as a keeper if that is you.'}
      </p>
    </div>
  );
}

export function EmptyFiltered({ term, category, onClear }) {
  return (
    <div className="state">
      <p className="state__title">Nothing matches that</p>
      <p className="state__body">
        {term && <>No tool mentions “{term}”</>}
        {term && category && <> in {category}</>}
        {!term && category && <>Nothing on the {category} shelf right now</>}
        . Try a shorter word — the search looks at names, asset tags and notes.
      </p>
      <button className="btn btn--ghost" onClick={onClear}>Clear filters</button>
    </div>
  );
}

export function CatalogueError({ error, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">The catalogue did not load</p>
      <p className="state__body">
        {error?.message}
        {error?.status === 0 && ' Start the API with npm run dev in the server folder, then retry.'}
      </p>
      <button className="btn btn--primary" onClick={onRetry}>Try again</button>
    </div>
  );
}
