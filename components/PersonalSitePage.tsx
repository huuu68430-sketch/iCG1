import React, { useEffect } from 'react';
import { Gamepad2, ShoppingBag, Trophy } from 'lucide-react';

interface PersonalSitePageProps {
  onPlayNow: () => void;
  onOpenLeaderboard: () => void;
  onOpenStore: () => void;
}

/**
 * الصفحة الرئيسية: الموقع الشخصي iCG1 مبني كما هو (نسخة iABS_AR-main)
 * ويُعرض داخل iframe مستقل حتى لا يتعارض تصميمه مع بقية الموقع.
 * مع بوابة "ادخل العب الآن" للانتقال إلى ساحة الألعاب.
 */
export const PersonalSitePage: React.FC<PersonalSitePageProps> = ({
  onPlayNow,
  onOpenLeaderboard,
  onOpenStore,
}) => {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const type = event.data?.type;
      if (type === 'icg1:open-games') onPlayNow();
      else if (type === 'icg1:open-leaderboard') onOpenLeaderboard();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPlayNow, onOpenLeaderboard]);

  return (
    <div className="personal-site-page relative w-full h-full min-h-screen">
      <iframe
        src="/icg1-site/index.html"
        title="iCG1 Official"
        className="block w-full border-0"
        style={{ height: '100dvh', minHeight: '100vh' }}
        allow="autoplay; fullscreen; picture-in-picture"
      />

      {/* بوابة الألعاب العائمة — شريط سفلي بعرض الهاتف + منطقة أمان الآيفون */}
      <div className="fixed bottom-0 inset-x-0 z-40 px-3 pt-3 pb-[max(1.35rem,env(safe-area-inset-bottom))] md:inset-x-auto md:left-8 md:bottom-5 md:px-0 md:pb-0 md:pt-0">
        <div className="flex flex-col gap-2 rounded-[1.6rem] border border-[#F6DFAE]/30 bg-black/85 p-2 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl md:flex-row md:items-stretch md:gap-2 md:rounded-2xl">
          <button
            onClick={onPlayNow}
            className="group relative w-full inline-flex min-h-[52px] items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[#F6DFAE]/40 bg-gradient-to-b from-[#F6DFAE] via-[#E3B25C] to-[#A87B36] px-5 py-3 text-base md:w-auto md:text-sm font-black text-[#1a1206] shadow-[0_10px_30px_-8px_rgba(227,178,92,0.8)] transition-transform duration-300 hover:scale-[1.03] active:scale-95"
          >
            <span className="absolute inset-0 -translate-x-full bg-white/30 skew-x-[-20deg] transition-transform duration-700 group-hover:translate-x-full" />
            <Gamepad2 size={20} className="relative z-10" />
            <span className="relative z-10">ادخل العب الآن</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={onOpenLeaderboard}
              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base md:flex-none md:text-sm font-black text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Trophy size={18} className="text-[#E3B25C]" />
              <span>لوحة الصدارة</span>
            </button>

            <button
              onClick={onOpenStore}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base md:flex-none md:text-sm font-black text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ShoppingBag size={18} className="text-[#E3B25C]" />
              <span>المتجر</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
