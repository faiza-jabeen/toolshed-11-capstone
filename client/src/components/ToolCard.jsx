import { Link } from 'react-router-dom';

const LABEL = { in: 'On the shelf', out: 'Out on loan', repair: 'In repair' };

export function ToolCard({ tool }) {
  return (
    <article className="tag row">
      <p className="tag__id"><span>{tool.assetTag}</span><span>Shelf {tool.shelf}</span></p>
      <h2 className="tag__name">
        <Link className="row__link" to={`/tools/${tool.id}`}>{tool.name}</Link>
      </h2>
      <p className="row__notes">{tool.notes || <em>No notes yet.</em>}</p>
      <div className="row__meta">
        {/* Status is in words as well as colour — colour alone fails for anyone
            who cannot distinguish it, and for anyone printing the page. */}
        <span className={`pip pip--${tool.status === 'in' ? 'in' : 'out'}`}>{LABEL[tool.status]}</span>
        <span className="row__deposit">£{tool.deposit} deposit</span>
        <span className="row__cat">{tool.category}</span>
      </div>
    </article>
  );
}
