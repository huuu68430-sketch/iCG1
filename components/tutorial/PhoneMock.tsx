import React, { useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PhoneScene } from './types';
import { TutFace } from './TutAvatar';

/** رمز QR وهمي لكن بشكل حقيقي: ثلاث زوايا كشف + نمط ثابت من اسم الغرفة */
const FakeQR: React.FC<{ seed: string }> = ({ seed }) => {
  const N = 21;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const cells: React.ReactNode[] = [];
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x > N - 8 && y < 7) || (x < 7 && y > N - 8);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (inFinder(x, y)) continue;
      if (rnd() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#0a0805" />);
    }
  }
  const finder = (fx: number, fy: number) => (
    <g key={`${fx}-${fy}`}>
      <rect x={fx} y={fy} width={7} height={7} fill="none" stroke="#0a0805" strokeWidth={1} />
      <rect x={fx + 2} y={fy + 2} width={3} height={3} fill="#0a0805" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges">
      {cells}
      {finder(0, 0)}
      {finder(N - 7, 0)}
      {finder(0, N - 7)}
    </svg>
  );
};

interface Props {
  scene?: PhoneScene;
  /** يلمس الإبهام العنصر المطلوب */
  tapping?: boolean;
  compact?: boolean;
}

export const PhoneMock: React.FC<Props> = ({ scene, tapping }) => {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || !scene?.tap) return setPt(null);
    const sel = scene.tap === 'primary' ? '[data-pt="primary"]' : `[data-pt="tile-${scene.tap}"]`;
    const target = el.querySelector(sel) as HTMLElement | null;
    if (!target) return setPt(null);
    let x = 0, y = 0, node: HTMLElement | null = target;
    while (node && node !== el) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    setPt({ x: x + target.offsetWidth / 2, y: y + target.offsetHeight / 2 });
  }, [scene?.tap, scene?.kind, scene?.primary, scene?.tiles?.length]);

  if (!scene) return null;

  return (
    <div className="tut-phone" ref={boxRef}>
      <span className="tagline">هاتف المتابع</span>
      <div className="body">
        <span className="notch" />
        <div className="screen">
          <div className="statusbar">
            <span>iCG1</span>
            <span>9:41</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={scene.kind + scene.title}
              initial={{ opacity: 0, y: 10, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: .98 }}
              transition={{ duration: .34, ease: [0.16, 1, 0.3, 1] }}
              className="pstack"
              style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0 }}
            >
              <div className="ptitle">{scene.title}</div>
              {scene.sub && <div className="psub">{scene.sub}</div>}

              {scene.kind === 'qr' && (
                <>
                  <div className="qr"><FakeQR seed={scene.code || 'ICG1'} /></div>
                  {scene.code && <div className="codebox">{scene.code}</div>}
                </>
              )}

              {scene.kind === 'role' && scene.role && (
                <div className="rolecard">
                  <div>
                    <div className="emoji">{scene.role.team === 'mafia' ? '🎭' : scene.role.team === 'neutral' ? '🃏' : '🛡️'}</div>
                    <div className="rn">{scene.role.name}</div>
                    <div className="rd">{scene.role.desc}</div>
                  </div>
                </div>
              )}

              {scene.tiles && scene.tiles.length > 0 && (
                <div className="ptiles" style={{ gridTemplateColumns: `repeat(${scene.cols || 3}, minmax(0,1fr))` }}>
                  {scene.tiles.map((t, i) => (
                    <div key={i} data-pt={`tile-${i}`} className={`ptile ${t.state || ''} ${t.tone || ''}`}>
                      <span>{t.label}</span>
                      {t.sub && <small>{t.sub}</small>}
                    </div>
                  ))}
                </div>
              )}

              {scene.players && scene.players.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {scene.players.slice(0, 6).map((p, i) => (
                    <div className="prow" key={i}>
                      <TutFace player={p} px={18} />
                      <span>{p.name}</span>
                      {p.tag && <span style={{ marginInlineStart: 'auto', color: '#e8be6e' }}>{p.tag}</span>}
                    </div>
                  ))}
                </div>
              )}

              {scene.hint && <div className="hintline">{scene.hint}</div>}
              {scene.note && <div className="psub" style={{ color: '#e8be6e' }}>{scene.note}</div>}

              {scene.primary && (
                <div data-pt="primary" className={`pbtn ${scene.tone || ''}`}>{scene.primary}</div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {tapping && pt && (
            <motion.div
              className="tut-finger"
              style={{ left: pt.x, top: pt.y }}
              initial={{ opacity: 0, scale: .6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: .7 }}
              transition={{ duration: .22 }}
            >
              <span className="tip" />
              <motion.span
                className="tap"
                initial={{ scale: .3, opacity: .9 }}
                animate={{ scale: [0.3, 1.5], opacity: [0.9, 0] }}
                transition={{ duration: .7, repeat: Infinity, repeatDelay: .35 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <span className="glare" />
      </div>
    </div>
  );
};
