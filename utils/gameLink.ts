/**
 * رابط الدخول المختصر للعبة المافيا: /m=ROOMCODE
 * المسار المختصر = لاعب، والشاشة الكبيرة ولوحة الإدارة يبقيان على المسار الطويل.
 */
const SHORT_ROOM_PATH = /^\/m=([a-z0-9]{3,12})$/i;

export const readShortRoomCode = (): string => {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(SHORT_ROOM_PATH);
  return match ? match[1].toUpperCase() : '';
};

export const isShortRoomRoute = (): boolean =>
  typeof window !== 'undefined' && SHORT_ROOM_PATH.test(window.location.pathname);

export const buildShortJoinLink = (code: string): string =>
  `${window.location.origin}/m=${String(code || '').trim().toUpperCase()}`;

/**
 * رابط الدخول المختصر لكود نيمز: /cn=ROOMCODE
 * رابط واحد لكل الناس — النظام يعرف فريق كل شخص وليدره من حسابه.
 */
const SHORT_CN_PATH = /^\/cn=([a-z0-9]{3,12})$/i;

export const readCnRoomCode = (): string => {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(SHORT_CN_PATH);
  return match ? match[1].toUpperCase() : '';
};

export const isCnRoomRoute = (): boolean =>
  typeof window !== 'undefined' && SHORT_CN_PATH.test(window.location.pathname);

export const buildCnJoinLink = (code: string): string =>
  `${window.location.origin}/cn=${String(code || '').trim().toUpperCase()}`;
