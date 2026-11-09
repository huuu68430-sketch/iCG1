/* =========================================================================
   iCG1 – محرك الإطارات (Frames Runtime)
   الإطارات الـ16 نفسها الموجودة في «معرض الإطارات.html» بالحرف،
   لكن مقاس الصورة الشخصية (blue avatar) يُركَّب فوقها صورة المستخدم.
   يُستخدم من React (FrameArt) ومن codenames.html.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------- أدوات الرسم (نفس معرض الإطارات) ---------- */
const P=(r,a)=>{a=a*Math.PI/180;return[100+r*Math.cos(a),100+r*Math.sin(a)]};
const R=(r,w,s,x='')=>`<circle cx="100" cy="100" r="${r}" fill="none" stroke="${s}" stroke-width="${w}" ${x}/>`;
const A=(n,r,f,o=-90)=>Array.from({length:n},(_,i)=>{const a=i*360/n,[x,y]=P(r,a+o);return f(i,a,x,y)}).join('');
const G=(id,c,v)=>`<linearGradient id="${id}" ${v||'x1="0" y1="0" x2="1" y2="1"'}>${c.map((s,i)=>`<stop offset="${i/(c.length-1)}" stop-color="${s}"/>`).join('')}</linearGradient>`;
const D=(i,m=.2)=>`style="animation-delay:${-(i*m).toFixed(2)}s"`;
const St=(x,y,s,f='#fff',i=0)=>`<path class="tw" ${D(i,.37)} d="M${x} ${y-s}Q${x} ${y} ${x+s} ${y}Q${x} ${y} ${x} ${y+s}Q${x} ${y} ${x-s} ${y}Q${x} ${y} ${x} ${y-s}z" fill="${f}"/>`;
const rot=(a,c)=>`<g transform="rotate(${a} 100 100)">${c}</g>`;
const hx=(x,y,r,f)=>`<polygon points="${[0,1,2,3,4,5].map(j=>P(r,j*60).map((v,k)=>(k?y-100:x-100)+v).map(v=>v.toFixed(1)).join(',')).join(' ')}" fill="${f}" stroke="#fff" stroke-width=".8"/>`;
const V='x1="0" y1="0" x2="0" y2="1"';
const sweep=(r,w,d=4)=>R(r,w,'#fff',`stroke-dasharray="46 ${(2*Math.PI*r-46).toFixed(0)}" class="s" opacity=".85" filter="url(#gl)" style="animation-duration:${d}s"`);


const F=[
/*0 basic*/k=>`<defs>${G('a'+k,['#f5f5f4','#a8a29e','#e7e5e4','#78716c'])}</defs>${R(66,7,`url(#a${k})`)}${R(61,1,'#fff7')}${sweep(66,7)}`,
/*1 ramadan*/k=>`<defs>${G('a'+k,['#fde68a','#38bdf8','#fbbf24','#60a5fa'])}</defs>${R(66,6,`url(#a${k})`)}${R(73,1.5,'#fcd34d','stroke-dasharray="2 9" class="s r" style="animation-duration:30s"')}${A(10,80,(i,a,x,y)=>St(x,y,i%2?4:2.6,'#fef3c7',i))}<path class="pu" d="M100 10a18 18 0 1 0 16 25a15 15 0 1 1 -16 -25z" fill="#fde68a" filter="url(#gl)"/>${sweep(66,6,5)}`,
/*2 dark*/k=>`<defs>${G('a'+k,['#18181b','#52525b','#27272a','#71717a'])}</defs>${A(10,70,(i,a,x,y)=>`<circle class="pu" ${D(i,.3)} cx="${x}" cy="${y}" r="10" fill="#7c3aed" opacity=".4" filter="url(#bl)"/>`)}${R(66,8,`url(#a${k})`)}${R(74,2,'#a78bfa','stroke-dasharray="3 10" class="s r" style="animation-duration:14s"')}${R(58,1.5,'#7c3aed','stroke-dasharray="30 20" class="s" style="animation-duration:9s"')}<g class="fk" filter="url(#gl)"><ellipse cx="89" cy="34" rx="5" ry="2.2" fill="#ef4444" transform="rotate(14 89 34)"/><ellipse cx="111" cy="34" rx="5" ry="2.2" fill="#ef4444" transform="rotate(-14 111 34)"/></g>`,
/*3 crown*/k=>`<defs>${G('a'+k,['#f97316','#dc2626','#fbbf24','#ea580c'])}${G('c'+k,['#fff3b0','#f59e0b','#b45309'],V)}</defs>${R(71,3,'#fb923c','class="pu" filter="url(#gl)"')}${R(66,7,`url(#a${k})`)}<path d="M78 40L76 18L89 29L100 12L111 29L124 18L122 40Z" fill="url(#c${k})" stroke="#fff5" stroke-width=".8"/><rect x="77" y="38" width="46" height="6" rx="2" fill="url(#c${k})"/><circle cx="100" cy="26" r="3.2" fill="#ef4444" stroke="#fff" stroke-width=".7"/><circle cx="85" cy="40" r="2" fill="#38bdf8"/><circle cx="115" cy="40" r="2" fill="#38bdf8"/>${A(6,80,(i,a,x,y)=>i?St(x,y,4,'#fde68a',i):'',-60)}${sweep(66,7,5)}`,
/*4 fire*/k=>`<defs>${G('f'+k,['#fde047','#f97316','#dc2626'],'x1="0" y1="1" x2="0" y2="0"')}${G('a'+k,['#7f1d1d','#f97316','#fbbf24','#b91c1c'])}</defs>${R(72,5,'#f97316','opacity=".35" class="pu" filter="url(#bl)"')}${A(20,0,(i,a)=>rot(a,`<path class="fl" ${D(i,.13)} d="M92 42Q86 24 100 3Q99 20 109 27Q114 36 108 42Z" fill="url(#f${k})"/>`))}${A(20,0,(i,a)=>rot(a+9,`<path class="fl" ${D(i,.17)} d="M95 42Q92 31 100 17Q100 29 106 34Q107 39 105 42Z" fill="#fef08a" opacity=".9"/>`))}${R(65,8,`url(#a${k})`)}${R(60,1.5,'#fde047','stroke-dasharray="20 14" class="s r" style="animation-duration:6s"')}`,
/*5 crystal*/k=>`<defs>${G('a'+k,['#fbcfe8','#ec4899','#fdf2f8','#be185d'])}${G('s'+k,['#fff','#f9a8d4','#db2777'],V)}</defs><g class="s" style="animation-duration:50s">${A(12,0,(i,a)=>rot(a,`<polygon class="pu" ${D(i,.45)} points="94,42 100,${i%2?10:22} 106,42" fill="url(#s${k})" stroke="#fff9" stroke-width=".6"/>`))}</g>${R(65,7,`url(#a${k})`)}${R(60,1,'#fff9')}${A(8,82,(i,a,x,y)=>St(x,y,i%2?5:3,'#fbcfe8',i),-70)}${sweep(65,7,3.5)}`,
/*6 emerald*/k=>`<defs>${G('a'+k,['#6ee7b7','#059669','#a7f3d0','#047857'])}</defs><circle class="ex" cx="100" cy="100" r="66" fill="none" stroke="#34d399" stroke-width="2"/><circle class="ex" style="animation-delay:-1.5s" cx="100" cy="100" r="66" fill="none" stroke="#6ee7b7" stroke-width="1.5"/>${R(65,8,`url(#a${k})`)}${R(57,1.5,'#6ee7b7','stroke-dasharray="4 6" class="s r" style="animation-duration:12s"')}${A(8,72,(i,a,x,y)=>`<g class="pu" ${D(i,.3)}>${hx(x,y,6.5,'#10b981')}<path d="M${x-3} ${y-1}L${x} ${y-4}" stroke="#fff" stroke-width="1.2"/></g>`)}${A(8,80,(i,a,x,y)=>St(x,y,3,'#a7f3d0',i),-67.5)}${sweep(65,8,4)}`,
/*7 neon*/k=>`${R(72,3,'#e879f9','stroke-dasharray="50 30" class="s" filter="url(#gl)" style="animation-duration:5s"')}${R(60,2,'#22d3ee','stroke-dasharray="20 12" class="s r" filter="url(#gl)" style="animation-duration:7s"')}${R(66,10,'#22d3ee','class="fk" opacity=".35" filter="url(#bl)"')}<g class="fk">${R(66,5,'#67e8f9','filter="url(#gl)"')}${R(66,1.5,'#fff')}</g>${R(66,6,'#fff',`stroke-dasharray="14 ${(2*Math.PI*66-14).toFixed(0)}" class="s" filter="url(#gl)" style="animation-duration:2.5s"`)}`,
/*8 galaxy*/k=>`<defs>${G('a'+k,['#6366f1','#a855f7','#ec4899','#38bdf8','#6366f1'])}</defs><g class="s" style="animation-duration:12s">${R(66,10,`url(#a${k})`,'opacity=".6" filter="url(#bl)"')}${R(66,9,`url(#a${k})`)}</g>${R(80,1,'#c4b5fd','stroke-dasharray="1 5"')}${A(18,0,(i,a)=>St(...P(70+(i%3)*5,a-90),i%2?2.6:1.8,'#fff',i))}<g class="s" style="animation-duration:7s"><circle cx="100" cy="21" r="5" fill="#fbbf24" filter="url(#gl)"/></g><g class="s r" style="animation-duration:11s"><circle cx="100" cy="180" r="4" fill="#38bdf8" filter="url(#gl)"/><circle cx="100" cy="174" r="1.6" fill="#fff"/></g><g class="s" style="animation-duration:16s"><ellipse cx="100" cy="100" rx="80" ry="28" fill="none" stroke="#e9d5ff" stroke-width=".8" opacity=".6" transform="rotate(-25 100 100)"/></g>`,
/*9 diamond*/k=>`<defs>${G('a'+k,['#e0f2fe','#38bdf8','#fff','#0284c7'])}${G('d'+k,['#fff','#7dd3fc','#0ea5e9'],V)}</defs>${R(65,7,`url(#a${k})`)}${A(8,0,(i,a)=>rot(a,`<g class="pu" ${D(i,.3)}><polygon points="100,12 110,26 100,42 90,26" fill="url(#d${k})" stroke="#fff" stroke-width=".9"/><path d="M90 26H110M100 12V42" stroke="#fff9" stroke-width=".6"/></g>`))}${A(8,0,(i,a)=>rot(a+22.5,`<polygon points="100,26 104,32 100,38 96,32" fill="#bae6fd" stroke="#fff" stroke-width=".6"/>`))}${A(8,82,(i,a,x,y)=>St(x,y,4,'#fff',i),-67.5)}${sweep(65,7,3)}`,
/*10 gold*/k=>`<defs>${G('a'+k,['#fff3b0','#d97706','#fde68a','#92400e','#fcd34d'])}</defs><g class="s" style="animation-duration:24s">${R(65,10,`url(#a${k})`)}</g>${R(59.5,1.2,'#78350f')}${R(70.5,1,'#fef3c7','opacity=".7"')}${A(24,65,(i,a,x,y)=>`<circle class="tw" ${D(i,.09)} cx="${x}" cy="${y}" r="2.3" fill="#fff7c2"/>`)}${R(76,1.2,'#fbbf24','stroke-dasharray="1 5" class="s r" style="animation-duration:20s"')}${A(4,84,(i,a,x,y)=>St(x,y,6,'#fff3b0',i),-45)}${sweep(65,10,3.5)}`,
/*11 imperial*/k=>`<defs>${G('g'+k,['#fff3b0','#d97706','#fbbf24'],V)}${G('a'+k,['#fde68a','#b45309','#fcd34d','#92400e'])}</defs>${R(71,2.5,'#a855f7','class="pu" filter="url(#gl)"')}${A(16,0,(i,a)=>rot(a,`<path d="M95 40L100 ${i%2?8:20}L105 40z" fill="url(#g${k})" stroke="#fff6" stroke-width=".5"/>`))}${R(64,7,`url(#a${k})`)}${R(57,1,'#e9d5ff','stroke-dasharray="8 4" class="s r" style="animation-duration:15s"')}${A(8,64,(i,a,x,y)=>`<circle class="pu" ${D(i,.3)} cx="${x}" cy="${y}" r="3.6" fill="#c084fc" stroke="#fff" stroke-width=".9"/>`,-67.5)}${R(79,1,'#fcd34d','stroke-dasharray="14 6 2 6" class="s" style="animation-duration:30s"')}${sweep(64,7,4)}`,
/*12 thunder*/k=>`<defs>${G('a'+k,['#fef08a','#3b82f6','#fde047','#1d4ed8'])}</defs>${R(66,12,'#60a5fa','class="fk" opacity=".3" filter="url(#bl)"')}${R(72,2,'#93c5fd','stroke-dasharray="8 6 2 10" class="da"')}${R(66,6,`url(#a${k})`)}${A(8,0,(i,a)=>rot(a,`<polyline class="fk" ${D(i,.31)} points="100,36 93,24 105,18 95,3" fill="none" stroke="#fde047" stroke-width="2.6" stroke-linejoin="round" filter="url(#gl)"/>`))}${A(8,0,(i,a)=>rot(a+22.5,`<polyline class="fk" ${D(i,.23)} points="100,36 96,28 103,24 98,14" fill="none" stroke="#bfdbfe" stroke-width="1.6" stroke-linejoin="round"/>`))}${R(60,1,'#fff','stroke-dasharray="3 9" class="da"')}`,
/*13 royal*/k=>`<defs>${G('a'+k,['#fcd34d','#b91c1c','#fbbf24','#7f1d1d'])}${G('c'+k,['#fff3b0','#f59e0b','#92400e'],V)}</defs>${R(72,3,'#fbbf24','class="pu" filter="url(#gl)"')}${R(66,9,`url(#a${k})`)}${R(60.5,2,'#450a0a')}${A(7,0,(i,a)=>rot(a+51.4,`<polygon class="pu" ${D(i,.3)} points="100,26 105,34 100,44 95,34" fill="url(#c${k})" stroke="#fff6" stroke-width=".5"/>`))}<path d="M72 40L66 12L84 26L100 6L116 26L134 12L128 40Z" fill="url(#c${k})" stroke="#7c2d12" stroke-width=".8"/><rect x="72" y="38" width="56" height="7" rx="2.5" fill="url(#c${k})" stroke="#7c2d12" stroke-width=".6"/><circle cx="100" cy="24" r="4.2" fill="#ef4444" stroke="#fff" stroke-width=".8"/><circle cx="66" cy="11" r="3" fill="#fff"/><circle cx="100" cy="5" r="3" fill="#fff"/><circle cx="134" cy="11" r="3" fill="#fff"/><circle cx="84" cy="41.5" r="2" fill="#38bdf8"/><circle cx="116" cy="41.5" r="2" fill="#22c55e"/>${sweep(66,9,4.5)}`,
/*14 astral*/k=>`<defs>${G('a'+k,['#818cf8','#0ea5e9','#c4b5fd','#312e81'])}</defs>${R(66,10,'#6366f1','opacity=".4" class="pu" filter="url(#bl)"')}${R(64,8,`url(#a${k})`)}${R(58,1,'#fff8')}<g class="s" style="animation-duration:60s">${R(82,.8,'#fcd34d99')}${A(12,82,(i,a,x,y)=>`<text x="${x}" y="${y}" font-size="10" fill="#fcd34d" text-anchor="middle" dominant-baseline="central" transform="rotate(${a} ${x} ${y})">${'♈♉♊♋♌♍♎♏♐♑♒♓'[i]}\uFE0E</text>`)}</g>${R(73,.8,'#a5f3fc88','stroke-dasharray="1 3"')}${A(9,73,(i,a,x,y)=>St(x,y,i%3?2.5:4.5,'#e0f2fe',i),-80)}<g class="s r" style="animation-duration:14s"><ellipse cx="100" cy="100" rx="71" ry="22" fill="none" stroke="#67e8f9" stroke-width="1" opacity=".75" transform="rotate(30 100 100)"/><circle cx="162" cy="130" r="3.5" fill="#fbbf24" filter="url(#gl)"/></g>${sweep(64,8,4)}`,
/*15 vip*/k=>`<defs>${G('w'+k,['#fff','#fde68a','#f59e0b'],V)}${G('a'+k,['#ef4444','#f59e0b','#fde047','#22c55e','#06b6d4','#6366f1','#d946ef','#ef4444'])}</defs><g class="hu"><circle class="ex" cx="100" cy="100" r="66" fill="none" stroke="#fde047" stroke-width="2"/><g class="wg"><path fill="url(#w${k})" stroke="#fff8" stroke-width=".7" d="M50 100Q8 80 0 28Q26 50 36 45Q20 70 40 78Q22 92 46 96Q34 104 52 110Z"/></g><g transform="translate(200 0) scale(-1 1)"><g class="wg"><path fill="url(#w${k})" stroke="#fff8" stroke-width=".7" d="M50 100Q8 80 0 28Q26 50 36 45Q20 70 40 78Q22 92 46 96Q34 104 52 110Z"/></g></g><g class="s" style="animation-duration:6s">${R(66,11,`url(#a${k})`,'opacity=".6" filter="url(#bl)"')}${R(66,9,`url(#a${k})`)}</g>${R(73,1.3,'#fff','stroke-dasharray="2 6" class="s r" style="animation-duration:12s"')}<ellipse class="pu" cx="100" cy="14" rx="22" ry="6" fill="none" stroke="#fde047" stroke-width="2.5" filter="url(#gl)"/>${Array.from({length:10},(_,i)=>`<circle class="rs" ${D(i,.3)} cx="${58+(i*37)%86}" cy="${140+(i*13)%24}" r="${1.4+(i%3)*.6}" fill="#fde68a"/>`).join('')}${sweep(66,9,2.5)}<rect x="80" y="160" width="40" height="18" rx="9" fill="url(#w${k})" stroke="#b45309"/><text x="100" y="169.5" font-size="11" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="#7c2d12" font-family="Cairo,sans-serif">VIP</text></g>`
];

const L=[
['الإطار الأساسي','c',0,'إطار مجاني لكل عضو جديد'],
['إطار رمضان','r',0,'إطار رمضاني مميز بأجواء الشهر الفضيل'],
['إطار الظلام','r',0,'إطار الغموض المرعب'],
['تاج الملوك','e',5000,'تاج الملوك الذهبي الفاخر'],
['إطار النيران','e',6000,'إطار محاط بلهيب لا ينطفئ'],
['إطار الكريستال','e',6000,'كريستال وردي لامع يخطف الأنظار'],
['إطار الزمرد','e',10000,'زمرد أخضر مشع وطاقة نقية'],
['إطار النيون','e',10500,'إضاءة نيون قوية للمحترفين فقط'],
['إطار المجرة','l',5500,'يعكس اتساع الكون والفضاء'],
['الإطار الماسي','l',9000,'إطار الألماس النادر والمبهر'],
['الإطار الذهبي','l',8000,'إطار الذهب الفاخر للأعضاء المتألقين'],
['الإطار الإمبراطوري','l',11000,'إطار إمبراطوري حصري على المنصة'],
['إطار الرعد','l',12000,'طاقة كهربائية مرعبة ومخيفة'],
['الإطار الملكي','l',14000,'مخصص للأباطرة والملوك في المنصة'],
['الإطار الفلكي','l',20000,'نسخة محدودة من الإطار الفلكي'],
['الإطار الأسطوري','l',25000,'الإطار المتحرك الأسطوري (VIP)']
];

  const META = L.map(function (f, i) {
    return { id: ["basic","ramadan","dark","crown","fire","crystal","emerald","neon","galaxy","diamond","gold","imperial","thunder","royal","astral","vip"][i], index: i, name: f[0], rarity: f[1], price: f[2], description: f[3] };
  });
  const RN = { c: 'عادي', r: 'نادر', e: 'ملحمي', l: 'أسطوري' };

  /* ---------- ستايل الحركات (مُنسّق بمساحة أسماء icg1) ---------- */
  const CSS = `
.icg1-fa{display:block;overflow:visible}
.icg1-fa .s{animation:i1sp 10s linear infinite;transform-origin:100px 100px}
.icg1-fa .r{animation-direction:reverse}
.icg1-fa .pu{animation:i1pu 2.6s ease-in-out infinite;transform-origin:100px 100px}
.icg1-fa .tw{animation:i1tw 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.icg1-fa .fl{animation:i1fl .8s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 100%}
.icg1-fa .ex{animation:i1ex 3s ease-out infinite;transform-origin:100px 100px}
.icg1-fa .fk{animation:i1fk 1.7s linear infinite}
.icg1-fa .da{animation:i1da 1.1s linear infinite}
.icg1-fa .hu{animation:i1hu 6s linear infinite}
.icg1-fa .wg{animation:i1wg 1.5s ease-in-out infinite alternate;transform-origin:100px 100px}
.icg1-fa .rs{animation:i1rs 3s ease-in infinite}
@keyframes i1sp{to{transform:rotate(360deg)}}
@keyframes i1pu{0%,100%{opacity:.55;transform:scale(.98)}50%{opacity:1;transform:scale(1.03)}}
@keyframes i1tw{0%,100%{opacity:.1;transform:scale(.4)}50%{opacity:1;transform:scale(1.1)}}
@keyframes i1fl{from{transform:scaleY(.72) skewX(-7deg)}to{transform:scaleY(1.12) skewX(7deg)}}
@keyframes i1ex{from{transform:scale(1);opacity:.9}to{transform:scale(1.4);opacity:0}}
@keyframes i1fk{0%,19%,23%,54%,58%,100%{opacity:1}20%,22%,56%{opacity:.12}}
@keyframes i1da{to{stroke-dashoffset:-96}}
@keyframes i1hu{to{filter:hue-rotate(360deg)}}
@keyframes i1wg{from{transform:rotate(-6deg)}to{transform:rotate(7deg)}}
@keyframes i1rs{0%{transform:translateY(24px);opacity:0}30%{opacity:1}100%{transform:translateY(-46px);opacity:0}}
@media(prefers-reduced-motion:reduce){.icg1-fa *{animation-play-state:paused!important}}
`;

  let styled = false;
  function injectStyle() {
    if (styled || typeof document === 'undefined') return;
    styled = true;
    const s = document.createElement('style');
    s.setAttribute('data-icg1-frames', '');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  let seq = 0;
  const indexOf = function (id) {
    for (let i = 0; i < META.length; i++) if (META[i].id === id) return i;
    return -1;
  };

  /* رسم الإطار فقط (نفس عناصر المعرض) */
  function art(idOrIndex) {
    const i = typeof idOrIndex === 'number' ? idOrIndex : indexOf(idOrIndex);
    if (i < 0 || i >= F.length) return '';
    return F[i](i);
  }

  /* صورة المستخدم فوق الخلفية الزرقاء ثم الإطار فوقها */
  function avatar(o) {
    o = o || {};
    const idx = typeof o.frameId === 'number' ? o.frameId : indexOf(o.frameId);
    if (idx < 0) return '';
    const u = 'a' + (++seq);
    const clip = 'clip' + u;
    const bg = 'bg' + u;
    const initial = esc((o.initial || '?').toString().slice(0, 3).toUpperCase());
    const face = o.src
      ? '<image href="' + esc(o.src) + '" x="48" y="48" width="104" height="104" clip-path="url(#' + clip + ')" preserveAspectRatio="xMidYMid slice"/>'
      : '<text x="100" y="101" font-size="30" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="#fff" font-family="Cairo,Tajawal,sans-serif">' + initial + '</text>';
    return '<svg class="icg1-fa" viewBox="0 0 200 200" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'
      + '<defs>'
      + '<radialGradient id="' + bg + '" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e3a8a"/></radialGradient>'
      + '<clipPath id="' + clip + '"><circle cx="100" cy="100" r="52"/></clipPath>'
      + '<filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
      + '<filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>'
      + '</defs>'
      + '<circle cx="100" cy="100" r="52" fill="url(#' + bg + ')" stroke="#ffffff55" stroke-width="1.5"/>'
      + face
      + '<g>' + art(idx) + '</g>'
      + '</svg>';
  }

  injectStyle();

  window.ICG1Frames = { meta: META, rarity: RN, ids: ["basic","ramadan","dark","crown","fire","crystal","emerald","neon","galaxy","diamond","gold","imperial","thunder","royal","astral","vip"], art: art, avatar: avatar, indexOf: indexOf, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.ICG1Frames;
})();
