import React from 'react';

interface IabsLogoProps {
  size?: 'sm' | 'md' | 'lg';
  subtitle?: boolean;
  showArena?: boolean;
}

type LogoSize = 'sm' | 'md' | 'lg';

const SIZES: Record<LogoSize, {
  mark: string;
  arena: string;
  sub: string;
  divider: string;
  rowGap: string;
}> = {
  sm: {
    mark: 'text-[34px] md:text-[42px]',
    arena: 'text-[16px] md:text-[22px]',
    sub: 'text-[8px] md:text-[10px]',
    divider: 'h-8 md:h-11',
    rowGap: 'gap-2 md:gap-3',
  },
  md: {
    mark: 'text-[54px] md:text-[76px]',
    arena: 'text-[26px] md:text-[40px]',
    sub: 'text-[10px] md:text-[13px]',
    divider: 'h-14 md:h-20',
    rowGap: 'gap-3 md:gap-5',
  },
  lg: {
    mark: 'text-[clamp(58px,13vw,104px)] lg:text-[104px]',
    arena: 'text-[clamp(26px,6.4vw,56px)] lg:text-[56px]',
    sub: 'text-[11px] md:text-[15px]',
    divider: 'h-16 md:h-24 lg:h-28',
    rowGap: 'gap-3 md:gap-5 lg:gap-7',
  },
};

/**
 * الشعار: iABS (يسار) — فاصل — ARENA (يمين)
 * iABS = علامة 5 طبقات كما في REPLICA_IABS_DESIGN.md
 * ARENA = خط مختلف (El Messiri) + دخول خاص
 */
export const IabsLogo: React.FC<IabsLogoProps> = ({
  size = 'md',
  subtitle = true,
  showArena = true
}) => {
  const s = SIZES[size] || SIZES.md;
  const letters = ['i', 'A', 'B', 'S'];

  return (
    <div className="relative w-full flex flex-col items-center select-none">
      <div className={`flex items-center justify-center ${s.rowGap}`} dir="ltr">

        {/* ===== iABS (يسار) — 5 طبقات ===== */}
        <h1
          className={`wm-mark relative font-gaming leading-none tracking-wide select-none text-center ${s.mark}`}
          dir="ltr"
          aria-label="iABS"
        >
          {/* الطبقة 1: العمق البعيد */}
          <span aria-hidden="true" className="wm-depth wm-depth-2 font-gaming leading-none tracking-wide">iABS</span>
          {/* الطبقة 2: العمق القريب */}
          <span aria-hidden="true" className="wm-depth wm-depth-1 font-gaming leading-none tracking-wide">iABS</span>
          {/* الطبقة 3: الحروف — دخول متتابع (wm-in) + طفو دائم (wm-wave) */}
          <span aria-hidden="true" className="relative z-10">
            {letters.map((l, i) => (
              <span
                key={i}
                className="wm-letter wm-stroke font-gaming"
                style={{ ['--i' as any]: i }}
              >
                <span className="wm-wave">{l}</span>
              </span>
            ))}
          </span>
          {/* الطبقة 4: اللمعة الزاحفة */}
          <span aria-hidden="true" className="wm-sheen font-gaming leading-none tracking-wide z-20">iABS</span>
        </h1>

        {showArena && (
          <>
            {/* الفاصل المتوهج */}
            <span
              aria-hidden="true"
              className={`wm-divider block w-[2px] ${s.divider} shrink-0 rounded-full`}
            />

            {/* ===== ARENA (يمين) — خط مختلف ===== */}
            <h2
              className={`wm-arena font-display font-black leading-none text-center ${s.arena}`}
              dir="ltr"
              aria-label="iABS ARENA"
            >
              <span
                className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white/85 to-[#FF2D2D]"
                style={{ WebkitTextStroke: '0.6px rgba(255,255,255,0.35)' }}
              >
                ARENA
              </span>
            </h2>
          </>
        )}
      </div>

      {subtitle && (
        <p
          className={`font-gaming text-stroke ${s.sub} mt-1.5 tracking-[0.32em] text-center`}
          dir="ltr"
          aria-hidden="true"
        >
          KING OF ACCEPTANCE
        </p>
      )}
    </div>
  );
};

export default IabsLogo;