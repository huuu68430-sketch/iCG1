import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Play, Pause, RotateCcw, ChevronRight, ChevronLeft, Gamepad2, ListChecks } from 'lucide-react';
import type { GameTutorial, Step } from './types';
import { getTutorial } from '../../data/game_tutorials';
import { Stage } from './Stage';
import { PhoneMock } from './PhoneMock';
import { TutFace } from './TutAvatar';
import './tutorial.css';

const FLY_START = 320;
const FLY_DUR = 760;
const DEFAULT_MS = 4600;

interface Props {
  viewId: string;
  onClose: () => void;
  onPlay?: (viewId: string) => void;
}

const Cursor: React.FC<{ x: number; y: number; pressed: boolean }> = ({ x, y, pressed }) => (
  <motion.div
    className="tut-cursor"
    initial={false}
    animate={{ x, y, scale: pressed ? 0.82 : 1 }}
    transition={{ duration: FLY_DUR / 1000, ease: [0.16, 1, 0.3, 1] }}
  >
    <svg viewBox="0 0 24 24">
      <path
        d="M4 2 L4 19 L8.6 14.8 L11.4 21 L14.4 19.6 L11.7 13.7 L18.4 13.2 Z"
        fill="#fff8e6"
        stroke="#1a1006"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
    <AnimatePresence>
      {pressed && (
        <motion.span
          className="tut-ripple"
          initial={{ scale: 0.2, opacity: 0.95 }}
          animate={{ scale: 1.9, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.75, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  </motion.div>
);

export const GameTutorialModal: React.FC<Props> = ({ viewId, onClose, onPlay }) => {
  const tut: GameTutorial | undefined = useMemo(() => getTutorial(viewId), [viewId]);
  const steps = tut?.steps || [];
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [cam, setCam] = useState({ ox: 50, oy: 50, scale: 1 });
  const [showRules, setShowRules] = useState(false);
  const elapsedRef = useRef(0);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  const step: Step | undefined = steps[idx];
  const stepMs = step?.ms ?? DEFAULT_MS;

  /* ====== مؤقّت الخطوة (rAF حتى يبقى التقدّم ناعماً مع الإيقاف) ====== */
  useEffect(() => {
    if (!tut || !playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(80, now - last);
      last = now;
      elapsedRef.current += dt;
      if (elapsedRef.current >= stepMs) {
        if (idx >= steps.length - 1) {
          elapsedRef.current = stepMs;
          setElapsed(stepMs);
          setPlaying(false);
          return;
        }
        elapsedRef.current = 0;
        setElapsed(0);
        setIdx(i => i + 1);
      } else {
        setElapsed(elapsedRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, idx, stepMs, steps.length, tut]);

  const goto = useCallback((n: number) => {
    elapsedRef.current = 0;
    setElapsed(0);
    setIdx(Math.max(0, Math.min(steps.length - 1, n)));
    setPlaying(true);
  }, [steps.length]);

  /* ====== مكان الموس والكاميرا ====== */
  const measure = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || !step) return;

    /* المشهد يقيس نفسه: لو المحتوى أطول من الإطار نصغّر خطوته فقط */
    const inner = scene.querySelector('.tut-step') as HTMLElement | null;
    if (inner) {
      const cs = getComputedStyle(inner);
      const avail = inner.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const kids = Array.from(inner.children) as HTMLElement[];
      const gap = parseFloat(cs.rowGap) || 0;
      const need = kids.reduce((a, k) => a + k.offsetHeight, 0) + gap * Math.max(0, kids.length - 1);
      inner.style.fontSize = need > avail && avail > 0
        ? `calc(1em * ${Math.max(0.62, (avail / need) * 0.97)})`
        : '';
    }

    const W = scene.offsetWidth;
    const H = scene.offsetHeight;

    let pt: { x: number; y: number } | null = null;
    if (step.click) {
      const el = scene.querySelector(`[data-tut="${step.click}"]`) as HTMLElement | null;
      if (el) {
        let x = 0, y = 0;
        let node: HTMLElement | null = el;
        while (node && node !== scene) {
          x += node.offsetLeft;
          y += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        pt = { x: x + el.offsetWidth * 0.62, y: y + el.offsetHeight * 0.6 };
      }
    }
    if (!pt) {
      pt =
        step.at === 'chat' ? { x: W * 0.08, y: H * 0.66 } :
        step.at === 'phone' ? { x: W * 0.14, y: H * 0.82 } :
        { x: W / 2, y: H / 2 };
    }
    setCursor(pt);
    const zoom = step.zoom ?? (step.click ? 1.14 : 1);
    setCam({ ox: (pt.x / W) * 100, oy: (pt.y / H) * 100, scale: zoom });
  }, [step]);

  useLayoutEffect(() => { measure(); }, [measure, idx]);

  /* AnimatePresence mode="wait" يركّب المشهد بعد انتهاء الخروج — نعيد القياس بعده */
  useEffect(() => {
    const t = window.setTimeout(measure, 470);
    return () => window.clearTimeout(t);
  }, [measure, idx]);

  /* ====== موسيق الخطوة: هل ضغطنا الآن؟ ====== */
  const arrived = elapsed >= FLY_START + FLY_DUR;
  const pressed = !!step?.click && arrived && elapsed < stepMs - 260;
  const progress = Math.min(1, elapsed / stepMs);
  const phoneTap = !!step?.phone?.tap && arrived;

  /* ====== الشات المتراكم ====== */
  const feed = useMemo(() => {
    if (!tut) return [] as { m: NonNullable<Step['chat']>[number]; k: string }[];
    const before: { m: NonNullable<Step['chat']>[number]; k: string }[] = [];
    steps.forEach((s, si) => {
      if (si < idx) (s.chat || []).forEach((m, mi) => before.push({ m, k: `${si}:${mi}` }));
    });
    const now = (step?.chat || [])
      .map((m, mi) => ({ m, k: `${idx}:${mi}` }))
      .filter((_, mi) => elapsed > 620 + mi * 560);
    return [...before, ...now].slice(-9);
  }, [tut, steps, idx, step, elapsed]);

  /* ====== Esc / مسافة / أسهم ====== */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === 'ArrowLeft') goto(idx - 1);
      else if (e.key === 'ArrowRight') goto(idx + 1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, goto, idx]);

  if (!tut || !step) return null;

  const last = idx === steps.length - 1;

  return (
    <div className="tut-root" role="dialog" aria-modal="true" aria-label={`شرح ${tut.title}`}>
      <motion.div
        className="tut-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <div className="tut-dust" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, bottom: '-4%', animationDuration: `${9 + (i % 5) * 2.4}s`, animationDelay: `${i * 0.7}s` }} />
        ))}
      </div>

      <motion.div
        className="tut-shell"
        initial={{ opacity: 0, scale: 0.94, y: 26 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* ===== الرأس ===== */}
        <div className="tut-head">
          <div className="tut-emblem">{tut.emoji}</div>
          <div style={{ minWidth: 0 }}>
            <div className="tut-title">{tut.title}</div>
            <div className="tut-tag">{tut.tagline}</div>
          </div>
          <div className="tut-badges">
            <span className="tut-badge">
              {tut.join === 'phone' ? ' يلعب من جواله' : tut.join === 'both' ? '💬 شات + 📱 جوال' : '💬 يلعب من الشات'}
            </span>
            {tut.joinWord && <span className="tut-badge">كلمة الدخول: {tut.joinWord}</span>}
            <span className="tut-badge">{steps.length} خطوات</span>
            <button className="tut-btn ghost" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => setShowRules(s => !s)}>
              <ListChecks size={14} /> القواعد
            </button>
          </div>
          <button className="tut-close" onClick={onClose} aria-label="إغلاق الشرح">
            <X size={18} />
          </button>
        </div>

        {/* ===== الجسم ===== */}
        <div className="tut-body">
          <div className="tut-stagebox">
            <div className="tut-stage" onClick={() => setPlaying(p => !p)}>
              <div className="tut-onair">
                <span className="tut-rec"><i /> شرح حي</span>
                <b>iCG1</b>
                <span>{tut.title}</span>
                <span className="spacer">{step.chip}</span>
                <span>{String(idx + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
              </div>

              <motion.div
                className="tut-camera"
                initial={false}
                animate={{ scale: cam.scale }}
                style={{ transformOrigin: `${cam.ox}% ${cam.oy}%` }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="tut-scene" ref={sceneRef}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={idx}
                      className="tut-scene tut-step"
                      style={{ position: 'absolute', inset: 0 }}
                      initial={{ opacity: 0, scale: 1.03, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.985, filter: 'blur(4px)' }}
                      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Stage parts={step.parts} targetId={step.click} pressed={pressed} progress={progress} />
                    </motion.div>
                  </AnimatePresence>

                  {!step.noCursor && (
                    <Cursor x={cursor.x} y={cursor.y} pressed={pressed} />
                  )}
                </div>
              </motion.div>

              {/* ترجمة الفيديو */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${idx}-cap`}
                  className="tut-caption"
                  initial={{ opacity: 0, y: 16, scale: .96, x: '-50%' }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
                  exit={{ opacity: 0, y: 10, scale: .98, x: '-50%' }}
                  transition={{ duration: .38, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="n">{idx + 1}</span>
                  <span>{step.narration}</span>
                </motion.div>
              </AnimatePresence>

              {(tut.join === 'phone' || tut.join === 'both') && step.phone && (
                <PhoneMock scene={step.phone} tapping={phoneTap} />
              )}
            </div>
          </div>

          {/* ===== السكة ===== */}
          <div className="tut-rail">
            <AnimatePresence initial={false}>
              {showRules && (
                <motion.div
                  className="tut-panel"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <h4><i /> كيف تشتغل</h4>
                  <ul className="tut-rules">
                    {tut.rules.map((r, i) => (
                      <li key={i}><b>{i + 1}</b><span>{r}</span></li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#e8be6e', fontWeight: 800 }}>🏆 {tut.scoring}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="tut-panel tut-chat">
              <h4><i /> {tut.join === 'chat' || tut.join === 'both' ? 'الشات وقت اللعبة' : 'اللاعبون'}</h4>
              <div className="feed">
                <AnimatePresence initial={false}>
                  {feed.map(({ m, k }) => (
                    <motion.div
                      key={k}
                      className={`msg ${m.kind === 'sys' ? 'sys' : ''}`}
                      initial={{ opacity: 0, y: 12, scale: .97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: .3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {m.kind === 'sys' ? (
                        <span>{m.text}</span>
                      ) : (
                        <>
                          <TutFace player={m.player} px={26} />
                          <span className="txt">
                            <span className="nm">{m.player.name}</span>
                            <span className={`bd ${(m.kind === 'answer' || m.kind === 'join') ? 'code' : ''}`}>{m.text}</span>
                          </span>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="tut-panel">
              <h4><i /> مراحل الشرح</h4>
              <div className="tut-steps">
                {steps.map((s, i) => (
                  <button key={i} className={`tut-stepdot ${i === idx ? 'on' : ''}`} onClick={() => goto(i)}>
                    {i + 1}. {s.chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== شريط التشغيل ===== */}
        <div className="tut-foot">
          <button className="tut-btn round" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'إيقاف' : 'تشغيل'}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button className="tut-btn round ghost" onClick={() => goto(idx - 1)} aria-label="السابق">
            <ChevronRight size={16} />
          </button>
          <button className="tut-btn round ghost" onClick={() => goto(idx + 1)} aria-label="التالي">
            <ChevronLeft size={16} />
          </button>

          <div
            className="tut-track"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
              goto(Math.floor(ratio * steps.length));
            }}
          >
            <span className="fill" style={{ width: `${((idx + progress) / steps.length) * 100}%` }} />
            {steps.map((_, i) => (
              <span
                key={i}
                className={`tick ${i <= idx ? 'done' : ''}`}
                style={{ left: `${(i / steps.length) * 100}%` }}
              />
            ))}
          </div>

          <button className="tut-btn round ghost" onClick={() => goto(0)} aria-label="إعادة">
            <RotateCcw size={15} />
          </button>
          {onPlay && (
            <button className="tut-btn" onClick={() => { onClose(); onPlay(viewId); }}>
              <Gamepad2 size={16} /> {last ? 'ابدأها الآن' : 'العب مباشرة'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
