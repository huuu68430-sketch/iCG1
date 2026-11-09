import React from 'react';

export const BASE_ICONS: Record<string, string> = {
  mafia: `<path class="g" d="M17 27C17 13 24 8 32 8s15 5 15 19z"/><path class="k" d="M17 21.5h30"/><ellipse class="g" cx="32" cy="28" rx="27" ry="5.5"/><path class="g" d="M10 37h19v5a7 7 0 0 1-7 7h-5a7 7 0 0 1-7-7z"/><path class="g" d="M35 37h19v5a7 7 0 0 1-7 7h-5a7 7 0 0 1-7-7z"/><path class="s" d="M29 40h6"/><path class="s" d="M24 57q8 4 16 0"/>`,
  code: `<rect class="g" x="4" y="8" width="25" height="14" rx="3"/><rect class="t" x="35" y="8" width="25" height="14" rx="3"/><path class="s" d="M41 15h13"/><rect class="t" x="4" y="25" width="25" height="14" rx="3"/><path class="s" d="M10 32h13"/><rect class="g" x="35" y="25" width="25" height="14" rx="3"/><rect class="t" x="4" y="42" width="25" height="14" rx="3"/><path class="s" d="M12 46l9 6M21 46l-9 6"/><rect class="t" x="35" y="42" width="25" height="14" rx="3"/><path class="s" d="M41 49h13"/>`,
  letters: `<rect class="t" x="3" y="16" width="18" height="30" rx="4"/><rect class="g" x="23" y="16" width="18" height="30" rx="4"/><rect class="t" x="43" y="16" width="18" height="30" rx="4"/><text class="tx" x="12" y="40" text-anchor="middle">ف</text><text class="tk" x="32" y="40" text-anchor="middle">ر</text><text class="tx" x="52" y="40" text-anchor="middle">ح</text><path class="s" d="M3 54h58"/>`,
  bomb: `<circle class="t" cx="29" cy="39" r="19"/><path class="s" d="M17 34a12 12 0 0 1 6-8"/><rect class="g" x="23" y="14" width="12" height="8" rx="2"/><path class="s" d="M29 14c0-6 5-7 9-10"/><path class="s" d="M47 0v9M42.500 4.500h9M43.800 1.300l6.400 6.400M50.200 1.300l-6.400 6.400"/><path class="s" d="M29 39v-8M29 39l7 4"/><circle class="g" cx="29" cy="39" r="2.500"/>`,
  globe: `<circle class="t" cx="30" cy="35" r="22"/><ellipse class="s" cx="30" cy="35" rx="10" ry="22"/><path class="s" d="M8 35h44M12 24h36M12 46h36"/><path class="g" d="M48 3c-6 0-10 4.500-10 10 0 7 10 16 10 16s10-9 10-16c0-5.500-4-10-10-10z"/><circle class="dk" cx="48" cy="13" r="3.500"/>`,
  type: `<path class="g" d="M36 1L23 16h8l-3 8L44 8h-8z"/><rect class="t" x="3" y="27" width="58" height="31" rx="6"/><g class="g"><rect x="9" y="33" width="6" height="6" rx="1.500"/><rect x="19" y="33" width="6" height="6" rx="1.500"/><rect x="29" y="33" width="6" height="6" rx="1.500"/><rect x="39" y="33" width="6" height="6" rx="1.500"/><rect x="49" y="33" width="6" height="6" rx="1.500"/><rect x="14" y="42" width="6" height="6" rx="1.500"/><rect x="24" y="42" width="6" height="6" rx="1.500"/><rect x="34" y="42" width="6" height="6" rx="1.500"/><rect x="44" y="42" width="6" height="6" rx="1.500"/></g>`,
  lock: `<rect class="t" x="11" y="27" width="42" height="31" rx="7"/><path class="s" d="M20 27V19a12 12 0 0 1 23.500-3.500"/><circle class="g" cx="32" cy="40" r="5"/><path class="g" d="M29.500 43h5l1.500 10h-8z"/>`,
  truth: `<path class="g" d="M6 5h28a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-8 7v-7H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z"/><path class="k" d="M11 17l6 6 11-12"/><path class="t" d="M30 29h28a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4h-4v7l-8-7H30a4 4 0 0 1-4-4V33a4 4 0 0 1 4-4z"/><path class="s" d="M38 36l12 12M50 36L38 48"/>`,
  chair: `<rect class="t" x="8" y="6" width="8" height="28" rx="3"/><rect class="t" x="8" y="32" width="32" height="8" rx="3"/><path class="s" d="M12 40v18M36 40v18"/><circle class="g" cx="47" cy="27" r="6.500"/><path class="s" d="M53.500 26V8l8 5"/>`,
  wheel: `<circle class="t" cx="32" cy="35" r="24"/><path class="g" d="M32 35L32.0 11.0A24 24 0 0 1 48.97 18.03z"/><path class="g" d="M32 35L56.0 35.0A24 24 0 0 1 48.97 51.97z"/><path class="g" d="M32 35L32.0 59.0A24 24 0 0 1 15.03 51.97z"/><path class="g" d="M32 35L8.0 35.0A24 24 0 0 1 15.03 18.03z"/><circle class="s" cx="32" cy="35" r="24"/><circle class="dk" cx="32" cy="35" r="6"/><circle class="g" cx="32" cy="35" r="3"/><path class="g" d="M24 1h16l-8 15z"/>`,
  flag: `<path class="s" d="M10 4v56"/><path class="t" d="M10 8c8-5 14 4 22 0s14-4 22 0v26c-8-4-14-4-22 0s-14 5-22 0z"/><path class="g" d="M10 17c8-5 14 4 22 0s14-4 22 0v9c-8-4-14-4-22 0s-14 5-22 0z"/>`,
  highlow: `<path class="g" d="M17 4L31 21H23V34H11V21H3z"/><path class="t" d="M41 30H53V43H61L47 59L33 43H41z"/>`,
  
  // Custom crafted icons for remaining games in the same exact luxury gold line/fill style:
  raffle: `<rect class="t" x="10" y="22" width="44" height="34" rx="5"/><rect class="g" x="6" y="14" width="52" height="10" rx="3"/><path class="s" d="M32 14v42"/><path class="s" d="M32 14C28 6 18 6 18 14c4 0 14 0 14 0z"/><path class="s" d="M32 14c4-8 14-8 14 0-4 0-14 0-14 0z"/><circle class="g" cx="32" cy="14" r="3"/>`,
  blur: `<path class="t" d="M6 32s10-18 26-18 26 18 26 18-10 18-26 18-26-18-26-18z"/><circle class="g" cx="32" cy="32" r="10"/><circle class="dk" cx="32" cy="32" r="5"/><circle class="g" cx="34" cy="30" r="1.5"/><path class="s" d="M6 32s10-18 26-18 26 18 26 18-10 18-26 18-26-18-26-18z"/>`,
  grid: `<rect class="t" x="8" y="8" width="48" height="48" rx="8"/><path class="s" d="M8 24h48M8 40h48M24 8v48M40 8v48"/><circle class="g" cx="32" cy="32" r="5"/><circle class="s" cx="32" cy="32" r="14"/>`,
  fawazir: `<path class="t" d="M32 8c-12 0-22 10-22 22 0 8 4 15 11 19v5h22v-5c7-4 11-11 11-19 0-12-10-22-22-22z"/><path class="g" d="M26 54h12v4H26z"/><circle class="g" cx="32" cy="28" r="8"/><path class="k" d="M32 23v6m0 4v1"/>`,
  masaqil: `<circle class="t" cx="24" cy="36" r="16"/><circle class="g" cx="44" cy="24" r="12"/><circle class="s" cx="24" cy="36" r="16"/><circle class="s" cx="44" cy="24" r="12"/><path class="s" d="M20 28l-8-8M48 16l8-8"/>`,
  team: `<path class="t" d="M14 12l18-6 18 6v18c0 14-18 26-18 26S14 44 14 30V12z"/><path class="g" d="M32 16v32M22 26h20"/><circle class="g" cx="32" cy="26" r="4"/>`,
  cups: `<path class="t" d="M12 20h14l-3 24h-8z"/><path class="g" d="M25 14h14l-3 24h-8z"/><path class="t" d="M38 20h14l-3 24h-8z"/><circle class="g" cx="32" cy="50" r="4"/><path class="s" d="M6 56h52"/>`,
  territory: `<path class="t" d="M32 6l20 12v24l-20 12-20-12V18z"/><path class="g" d="M32 18l10 6v12l-10 6-10-6V24z"/><circle class="dk" cx="32" cy="30" r="3"/>`,
  draw: `<path class="t" d="M10 32c0-12 10-22 22-22s22 10 22 22c0 6-4 10-10 10h-6c-3 0-5 2-5 5 0 2 1 4 1 5 0 4-4 8-9 8-8 0-15-8-15-18z"/><circle class="g" cx="22" cy="24" r="4"/><circle class="g" cx="32" cy="20" r="4"/><circle class="g" cx="42" cy="24" r="4"/><circle class="g" cx="42" cy="34" r="3"/><path class="s" d="M38 58l18-18 4 4-18 18z"/>`,
  fruit: `<circle class="t" cx="32" cy="36" r="18"/><path class="g" d="M32 18c0-8 6-10 10-10-2 4-2 8 0 10-4 0-8-1-10 0z"/><path class="s" d="M32 18v8"/><path class="s" d="M22 36c4 6 16 6 20 0"/><circle class="g" cx="26" cy="32" r="2.5"/><circle class="g" cx="38" cy="32" r="2.5"/>`,
  brand: `<path class="g" d="M10 46l6-24 16 14 16-14 6 24z"/><circle class="g" cx="10" cy="18" r="4"/><circle class="g" cx="32" cy="14" r="5"/><circle class="g" cx="54" cy="18" r="4"/><rect class="t" x="10" y="46" width="44" height="8" rx="2"/>`,
  vote: `<rect class="t" x="12" y="16" width="40" height="40" rx="6"/><path class="s" d="M12 28h40"/><path class="g" d="M22 10h20v8H22z"/><path class="s" d="M22 40l6 6 14-14"/>`,
  bridge: `<rect class="t" x="12" y="12" width="18" height="16" rx="3"/><rect class="g" x="34" y="12" width="18" height="16" rx="3"/><rect class="g" x="12" y="36" width="18" height="16" rx="3"/><rect class="t" x="34" y="36" width="18" height="16" rx="3"/><path class="s" d="M8 8v48M56 8v48"/><circle class="s" cx="32" cy="32" r="4"/>`,
  lava: `<path class="g" d="M12 54L26 22h12l14 32z"/><path class="t" d="M24 22c0 8 4 12 8 12s8-4 8-12"/><path class="s" d="M20 14c-4-4-4-10 0-12 2 4 6 6 6 8-2 2-4 2-6-4z"/><path class="s" d="M36 12c-3-4-3-8 0-10 2 3 5 5 5 7-1 2-3 2-5-4z"/><path class="s" d="M6 54h52"/>`
};

export const GAME_DETAILS: Record<string, { title: string; desc: string; iconKey: string; isHot?: boolean }> = {
  MAHMAH_GAME: {
    title: "المافيا",
    desc: "اكشف المافيا بين اللاعبين قبل ما تسيطر على القرية.",
    iconKey: "mafia",
    isHot: true
  },
  EMOJI_CODE: {
    title: "كود نيمز",
    desc: "فريقان وكلمات سرية. لمّح بذكاء وخلّ فريقك يخمّن صح.",
    iconKey: "code",
    isHot: true
  },
  SAFE_CODE: {
    title: "فك الشفرة",
    desc: "حلّ الرموز وافتح القفل.",
    iconKey: "lock"
  },
  LETTER_GAME: {
    title: "حروف مع منصور",
    desc: "كوّن الكلمات من الحروف قبل الجميع.",
    iconKey: "letters"
  },
  TIME_BOMB: {
    title: "قنبلة موقوتة",
    desc: "مرّر القنبلة قبل ما تنفجر فيك.",
    iconKey: "bomb"
  },
  MAP_GUESSER: {
    title: "خمن الدولة",
    desc: "من الدلائل خمّن الدولة الصحيحة.",
    iconKey: "globe"
  },
  TYPING_RACE: {
    title: "سباق الكتابة",
    desc: "اكتب بأسرع ما تقدر وتصدّر القائمة.",
    iconKey: "type"
  },
  TRUTH_OR_LIE: {
    title: "صادق أم كذاب",
    desc: "من يقول الحقيقة ومن يكذب؟",
    iconKey: "truth"
  },
  MUSICAL_CHAIRS: {
    title: "الكرسي الموسيقي",
    desc: "اجلس قبل ما تتوقف الموسيقى.",
    iconKey: "chair"
  },
  SPIN_WHEEL: {
    title: "الروليت",
    desc: "الروليت تختار.. والقرار: تقصي أو تحيي.",
    iconKey: "wheel"
  },
  FLAG_QUIZ: {
    title: "الأعلام",
    desc: "اعرف العلم وجاوب أسرع من الكل.",
    iconKey: "flag"
  },
  HIGHER_LOWER: {
    title: "أعلى أم أقل",
    desc: "الرقم القادم أعلى أم أقل؟",
    iconKey: "highlow"
  },
  BLUR_GUESS: {
    title: "تخمين الصورة",
    desc: "خمّن الصورة المشوشة قبل أن تكتمل ملامحها.",
    iconKey: "blur"
  },
  CUP_SHUFFLE: {
    title: "تحدي الأكواب",
    desc: "ركز مع حركة الأكواب وخمن مكان الكرة.",
    iconKey: "cups"
  },
  DRAWING_CHALLENGE: {
    title: "تحدي الرسم",
    desc: "ارسم وخلي الشات يخمن رسمتك بأسرع وقت.",
    iconKey: "draw"
  },
  GLASS_BRIDGE_V2: {
    title: "جسر الزجاج",
    desc: "خطوة تفصلك عن السقوط.. اختر اللوح الآمن.",
    iconKey: "bridge"
  },
  FLOOR_IS_LAVA: {
    title: "أرضية الحمم",
    desc: "الأرض حمم بركانية! اقفز للأماكن المرتفعة وابقَ حيّاً.",
    iconKey: "lava"
  }
};
