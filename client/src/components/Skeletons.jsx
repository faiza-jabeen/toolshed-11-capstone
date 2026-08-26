/**
 * Every data-fetching surface gets a skeleton shaped like its real content,
 * not a centred spinner. A spinner tells you to wait; a skeleton tells you
 * what you are waiting for, and keeps the layout from jumping when it arrives.
 */
export function StatsSkeleton() {
  return (
    <div className="stats" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div className="stat" key={i}>
          <div className="skeleton" style={{ height: '.65rem', width: '60%' }} />
          <div className="skeleton" style={{ height: '2rem', width: '40%', marginTop: '.7rem' }} />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ count = 6 }) {
  return (
    <div className="rows" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="tag row" key={i}>
          <div className="skeleton" style={{ height: '.65rem', width: '55%' }} />
          <div className="skeleton" style={{ height: '1.5rem', width: '78%', marginTop: '.7rem' }} />
          <div className="skeleton" style={{ height: '.65rem', width: '92%', marginTop: '.9rem' }} />
          <div className="skeleton" style={{ height: '.65rem', width: '64%', marginTop: '.4rem' }} />
          <div className="skeleton" style={{ height: '2.1rem', width: '100%', marginTop: '1.4rem' }} />
        </div>
      ))}
    </div>
  );
}

export function LineSkeleton({ width = '40%' }) {
  return <span className="skeleton" style={{ height: '.8rem', width, display: 'inline-block' }} aria-hidden="true" />;
}
