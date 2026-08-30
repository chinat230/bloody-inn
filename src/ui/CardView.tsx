import { def, typeColor } from '../engine';
import type { Card } from '../engine';

export function GuestCard(props: {
  card: Card;
  dead?: boolean;
  selected?: boolean;
  legal?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const d = def(props.card);
  const aff =
    d.affinity === 'bribe' ? ' ₣' : d.affinity === 'build' ? ' ⚒' : d.affinity === 'kill' ? ' †' : d.affinity === 'bury' ? ' ⚰' : '';
  return (
    <div
      className={`guest-card${props.dead ? ' dead' : ''}${props.selected ? ' selected' : ''}${props.legal ? ' legal' : ''}`}
      onClick={props.onClick}
      role={props.onClick ? 'button' : undefined}
    >
      <div className="banner" style={{ background: typeColor(d.type) }}>
        {d.type}
        {aff}
      </div>
      <div className="occ">{props.dead ? `† ${d.name}` : d.name}</div>
      <div className="meta">
        <span className="pips">{'●'.repeat(d.rank) || '○'}</span>
        <span>{d.pocket}F</span>
      </div>
      {!props.dead && d.annex && !props.compact && <div className="annex">{d.annex.name}</div>}
    </div>
  );
}
