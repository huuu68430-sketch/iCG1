import type { TutPlayer } from '../components/tutorial/types';

const av = (n: number) => `/avatars/tut-${n}.webp`;

/** اللاعبون التجريبيون داخل الشروحات — أسماء موهومة، صور وأطارات حقيقية من معرض الإطارات */
export const TUT_PLAYERS: Record<string, TutPlayer> = {
  aboReem: { name: 'أبو ريم', avatar: av(1), frame: 'gold', tag: 'النجم' },
  nourah: { name: 'نورة ٢٢', avatar: av(2), frame: 'crown' },
  mishal: { name: 'مشعل HX', avatar: av(3), frame: 'neon', tag: 'المصوّت' },
  lulu: { name: 'لؤلؤة', avatar: av(4), frame: 'crystal' },
  saqr: { name: 'صقر الخليج', avatar: av(5), frame: 'fire' },
  dani: { name: 'دانيال', avatar: av(6), frame: 'galaxy' },
  wadha: { name: 'وضحة', avatar: av(2), frame: 'emerald' },
  turbo: { name: 'تربو ٩٩', avatar: av(3), frame: 'diamond' },
};

export const P = (key: keyof typeof TUT_PLAYERS, over: Partial<TutPlayer> = {}): TutPlayer => ({
  ...TUT_PLAYERS[key],
  ...over,
});

/** ترتيب جاهز للصفوف */
export const TUT_ROSTER = [TUT_PLAYERS.aboReem, TUT_PLAYERS.nourah, TUT_PLAYERS.mishal, TUT_PLAYERS.lulu, TUT_PLAYERS.saqr, TUT_PLAYERS.dani];
