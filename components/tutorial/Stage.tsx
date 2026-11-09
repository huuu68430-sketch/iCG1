import React from 'react';
import { motion } from 'framer-motion';
import type { Part, TileItem } from './types';
import { TutAvatar, TutFace } from './TutAvatar';

interface StageProps {
  parts: Part[];
  /** العنصر الذي سيطير إليه الموس في هذه الخطوة */
  targetId?: string;
  pressed?: boolean;
  /** تقدّم الخطوة 0..1 — يحرّك المؤقّت والأشرطة */
  progress?: number;
  depth?: number;
}

const targetCls = (id: string | undefined, props: StageProps) =>
  id && id === props.targetId ? `tut-target${props.pressed ? ' tut-press' : ''}` : '';

const Tile: React.FC<{ item: TileItem; props: StageProps }> = ({ item, props }) => (
  <div
    data-tut={item.id}
    className={`tile ${item.state || 'idle'} ${targetCls(item.id, props)}`}
  >
    <span>{item.label}</span>
    {item.sub && <small>{item.sub}</small>}
    {item.players && item.players.length > 0 && (
      <span className="av">
        {item.players.slice(0, 5).map((p, i) => (
          <img key={`${p.name}-${i}`} src={p.avatar} alt="" referrerPolicy="no-referrer" />
        ))}
      </span>
    )}
  </div>
);

const renderPart = (part: Part, i: number, props: StageProps) => {
  const key = `${part.t}-${i}`;
  switch (part.t) {
    case 'kicker':
      return <div key={key} className="p-kicker">{part.text}</div>;

    case 'headline':
      return (
        <div key={key} className="p-headline">
          {part.text}
          {part.sub && <small>{part.sub}</small>}
        </div>
      );

    case 'bigText':
      return (
        <div key={key} data-tut={part.id} className={`p-bigtext ${targetCls(part.id, props)}`}>
          {part.text}
          {part.sub && <small>{part.sub}</small>}
        </div>
      );

    case 'art':
      return (
        <div key={key} data-tut={part.id} className={targetCls(part.id, props)}>
          <div className="p-art" style={{ filter: part.blur ? `blur(${part.blur}px)` : undefined }}>
            {part.emoji}
          </div>
          {part.caption && <div className="p-art-cap">{part.caption}</div>}
        </div>
      );

    case 'tiles':
      return (
        <div key={key} className="p-tiles-wrap">
          <div
            className="p-tiles"
            data-tut={part.id}
            style={{ gridTemplateColumns: `repeat(${part.cols || Math.min(part.items.length, 4)}, minmax(0, 1fr))` }}
          >
            {part.items.map((it, n) => <Tile key={n} item={it} props={props} />)}
          </div>
          {part.caption && <div className="p-tiles cap p-art-cap" style={{ marginTop: '.4em' }}>{part.caption}</div>}
        </div>
      );

    case 'tally':
      return (
        <div key={key} data-tut={part.id} className={`p-tally ${targetCls(part.id, props)}`}>
          {part.rows.map((r, n) => (
            <div className="tally-row" key={n}>
              <span>{r.label}</span>
              <span className="who">
                {(r.players || []).slice(0, 4).map((p, k) => (
                  <img key={k} src={p.avatar} alt="" referrerPolicy="no-referrer" />
                ))}
                {r.votes != null && <b style={{ color: '#e8be6e' }}>{r.votes}</b>}
              </span>
              <div className={`track ${r.tone || ''}`}>
                <motion.i
                  initial={{ width: 0 }}
                  animate={{ width: `${r.pct}%` }}
                  transition={{ duration: .9, ease: [0.16, 1, 0.3, 1], delay: .15 + n * .12 }}
                />
                <span><em style={{ fontStyle: 'normal' }}>{r.label}</em><b>{r.pct}%</b></span>
              </div>
            </div>
          ))}
          {part.caption && <div className="p-art-cap">{part.caption}</div>}
        </div>
      );

    case 'bar':
      return (
        <div key={key} data-tut={part.id} className={`p-bar ${part.tone || ''} ${targetCls(part.id, props)}`}>
          <motion.i initial={{ width: 0 }} animate={{ width: `${part.pct}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
          {part.label && <label>{part.label}</label>}
        </div>
      );

    case 'ring': {
      const C = 2 * Math.PI * 44;
      const left = Math.max(0, Math.ceil(part.seconds * (1 - (props.progress ?? 0))));
      const low = left <= 5;
      return (
        <div key={key} data-tut={part.id} className={`p-ring ${low ? 'low' : ''} ${targetCls(part.id, props)}`}>
          <svg viewBox="0 0 100 100">
            <circle className="bg" cx="50" cy="50" r="44" />
            <circle
              className="fg"
              cx="50"
              cy="50"
              r="44"
              strokeDasharray={C}
              strokeDashoffset={C * (props.progress ?? 0)}
              style={{ transition: 'stroke-dashoffset .12s linear' }}
            />
          </svg>
          <b>{left}</b>
          {part.label && <label>{part.label}</label>}
        </div>
      );
    }

    case 'chips':
      return (
        <div key={key} className="p-chips">
          {part.items.map((c, n) => <span key={n} className={`p-chip ${c.tone || ''}`}>{c.text}</span>)}
        </div>
      );

    case 'roster':
      return (
        <div key={key} data-tut={part.id} className={targetCls(part.id, props)}>
          <div className="p-roster">
            {part.players.map((p, n) => <TutAvatar key={n} player={p} px={44} />)}
          </div>
          {part.caption && <div className="p-art-cap" style={{ marginTop: '.35em' }}>{part.caption}</div>}
        </div>
      );

    case 'podium':
      return (
        <div key={key} className="p-podium">
          {part.players.map((p, n) => (
            <div className={`pod p${n + 1}`} key={n}>
              <TutAvatar player={p} px={n === 0 ? 46 : 38} />
              {part.points?.[n] && <span className="pts">{part.points[n]}</span>}
              <div className="box">{['١', '٢', '٣'][n]}</div>
            </div>
          ))}
        </div>
      );

    case 'portrait':
      return (
        <div key={key} data-tut={part.id} className={`p-portrait ${targetCls(part.id, props)}`}>
          <TutAvatar player={part.player} px={72} name={false} />
          <div className="nm">{part.player.name}</div>
          {part.caption && <div className="cap">{part.caption}</div>}
        </div>
      );

    case 'cta':
      return (
        <div key={key} style={{ display: 'grid', placeItems: 'center' }}>
          <div data-tut={part.id} className={`p-cta ${part.tone || ''} ${targetCls(part.id, props)}`}>
            {part.text}
            {part.hint && <small>{part.hint}</small>}
          </div>
        </div>
      );

    case 'code':
      return (
        <div key={key} data-tut={part.id} className={`p-code ${targetCls(part.id, props)}`}>
          {part.digits.map((d, n) => (
            <span key={n} className={`d ${d === '?' ? 'unk' : part.revealed ? 'hit' : ''}`}>{d}</span>
          ))}
        </div>
      );

    case 'wheel': {
      const n = part.numbers.length;
      return (
        <div key={key} data-tut={part.id} className={`p-wheel ${targetCls(part.id, props)}`}>
          <div className="disc" />
          {part.numbers.map((num, k) => (
            <div className="seg" key={k} style={{ transform: `rotate(${(k * 360) / n}deg)` }}>
              <b style={{ color: num === part.active ? '#ff8f6f' : undefined }}>{num}</b>
            </div>
          ))}
          <div className="hub">{part.active || 'iCG1'}</div>
          <div className="needle" />
          {part.caption && <div className="p-art-cap" style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}>{part.caption}</div>}
        </div>
      );
    }

    case 'note':
      return <div key={key} data-tut={part.id} className={`p-note ${part.tone || ''} ${targetCls(part.id, props)}`}>{part.text}</div>;

    case 'row':
      return (
        <div key={key} className="p-row">
          {part.parts.map((p, n) => renderPart(p, n, props))}
        </div>
      );

    default:
      return null;
  }
};

export const Stage: React.FC<StageProps> = (props) => (
  <>
    {props.parts.map((p, i) => renderPart(p, i, props))}
  </>
);

export const PlayerFaceRow: React.FC<{ players: { name: string; avatar: string }[] }> = ({ players }) => (
  <div className="p-roster">
    {players.map((p, i) => <TutFace key={i} player={p as any} px={26} />)}
  </div>
);
