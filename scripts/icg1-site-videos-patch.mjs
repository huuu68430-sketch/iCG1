// يُصلح تشغيل فيديوهات البثوث السابقة واللقطات في حزمة icg1-site المبنية.
// السببان: (1) كل الجلب يمرّ بوسيط /api/kick?endpoint= الذي يُعيد 404 خارج الإنتاج،
// فتبقى بيانات تجريبية قديمة بروابط m3u8 محذوفة؛ (2) المشغّل يفضّل HLS الأصلي في
// كروم، وأشرطة clips.kick.com تصل بـ Content-Type: application/octet-stream فيرفضها
// العنصر <video> بخطأ "تنسيق الفيديو غير مدعوم".
// الاستبدال معدود: أي فرق في العدد يوقف السكربت قبل الكتابة.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = path.join(ROOT, 'public', 'icg1-site');
const ASSETS = path.join(SITE, 'assets');

const STATS = path.join(ASSETS, 'StatsSection-DjFMOqU5.js');
const SESSION = path.join(ASSETS, 'SessionReport-DUFcWubQ.js');
const INDEX_HTML = path.join(SITE, 'index.html');

// ── جلب كيك مباشرةً من المتصفح، والوسيط يبقى خياراً ثانياً ──────────────────
// يُحقن في index.html كـ script تقليدي قبل حزمة ES، فيسري على كل استدعاءات fetch
// بما فيها تلك المكتوبة داخل StatsSection وSessionReport.
const SHIM = `
  <!-- فيديوهات كيك: جلب مباشر أولاً، ووسيط /api/kick احتياطاً (كان 404 خارج الإنتاج فيُبقي بيانات قديمة ميّتة) -->
  <script>
    (function () {
      var native = window.fetch.bind(window);
      var ALLOW = /^https:\\/\\/(kick\\.com|web\\.kick\\.com|api\\.kick\\.com)\\//i;
      window.fetch = function (input, init) {
        var raw = typeof input === 'string' ? input : (input && input.url) || '';
        var key = '/api/kick?endpoint=';
        var at = raw.indexOf(key);
        if (at < 0) return native(input, init);
        var target;
        try { target = decodeURIComponent(raw.slice(at + key.length).split('&')[0]); } catch (e) { return native(input, init); }
        if (!ALLOW.test(target)) return native(input, init);
        return native(target, init || { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.ok ? r : native(input, init); })
          .catch(function () { return native(input, init); });
      };
    })();
  </script>
`;

const patches = [
  {
    file: STATS,
    from: 'canPlayType("application/vnd.apple.mpegurl")&&N){s.src=N;',
    to: 'canPlayType("application/vnd.apple.mpegurl")&&N&&!window.MediaSource){s.src=N;',
    expect: 1,
    why: 'كروم يملك MediaSource ← اترك hls.js يتولّى الأشرطة بدل HLS الأصلي',
  },
  {
    file: STATS,
    from: 'A>1e6?Math.round(A/6e4):Math.round(A/60)',
    to: 'Math.max(1,Math.round(A/6e4))',
    expect: 1,
    why: 'مدة البث من كيك بالميلي ثانية دائماً (674000 = 11 دقيقة، لا 187 ساعة)',
  },
  {
    file: STATS,
    from: 'source:i||(L?"https://clips.kick.com/clips/f5/clip_01M5G9VRXYHJVT1RV6RQMVWDGT/playlist.m3u8":"https://stream.kick.com/0f3cb0ebce7/ivs/v1/196233775518/nkgXnCnlc2BN/2026/10/21/16/56/AziccfA6redM/media/hls/master.m3u8"),kickUrl:j||"https://kick.com/icg1/videos/01a15f64-e450-70c0-9e0e-6cedcaad149c"',
    to: 'source:i||"",kickUrl:j||"https://kick.com/icg1/videos"',
    expect: 1,
    why: 'إسقاط روابط العرض التجريبي المحذوفة',
  },
  {
    file: STATS,
    from: '}else P(!1)}).catch(()=>{P(!1)}):P(!1);return()=>{j=!0,i&&i.destroy()}',
    to: '}else P(!1)}).catch(()=>{P(!1)}):(P(!1),le("هذه النسخة غير متاحة على كيك."));return()=>{j=!0,i&&i.destroy()}',
    expect: 1,
    why: 'بث بلا مصدر ← رسالة واضحة بدل مشغّل أسود صامت',
  },
  {
    file: STATS,
    from: 'if(L.isSupported()){const E=new L({enableWorker:!0,lowLatencyMode:!0});i=E,',
    to: 'if(L.isSupported()){let __nf=0;const E=new L({enableWorker:!0,lowLatencyMode:!0});i=E,',
    expect: 1,
    why: 'عدّاد أخطاء الشبكة',
  },
  {
    file: STATS,
    from: 'T.type===L.ErrorTypes.NETWORK_ERROR?(E==null||E.startLoad(),V("خطأ في الشبكة - جاري إعادة المحاولة..."))',
    to: 'T.type===L.ErrorTypes.NETWORK_ERROR?(++__nf>3?(le("هذه النسخة لم تعد متاحة على كيك — تُحذف التسجيلات بعد أسبوع من البث."),E==null||E.destroy()):(E==null||E.startLoad(),V("خطأ في الشبكة - جاري إعادة المحاولة...")))',
    expect: 1,
    why: 'إيقاف إعادة المحاولة اللانهائية لشريط محذوف',
  },
  {
    file: STATS,
    from: 'onClick:()=>{le(null),g.current&&(g.current.load(),g.current.play().catch(()=>{}))}',
    to: 'onClick:()=>{le(null),S&&K({...S})}',
    expect: 1,
    why: '«إعادة المحاولة» تُعيد تشغيل hls.js نفسه (load() وحده لا يفعل شيئاً مع MSE)',
  },
  {
    file: SESSION,
    from: 'canPlayType("application/vnd.apple.mpegurl")&&i){t.src=i;',
    to: 'canPlayType("application/vnd.apple.mpegurl")&&i&&!window.MediaSource){t.src=i;',
    expect: 1,
    why: 'نفس تفضيل hls.js في تقرير الجلسة',
  },
];

const apply = () => {
  const byFile = new Map();
  for (const p of patches) {
    if (!fs.existsSync(p.file)) throw new Error(`missing file: ${p.file}`);
    const list = byFile.get(p.file) || [];
    list.push(p);
    byFile.set(p.file, list);
  }

  for (const [file, list] of byFile) {
    let src = fs.readFileSync(file, 'utf8');
    for (const p of list) {
      const found = src.split(p.from).length - 1;
      if (found !== p.expect) {
        throw new Error(`${path.basename(file)}: توقعت ${p.expect} وموجود ${found} ← ${JSON.stringify(p.from.slice(0, 70))}\n   (${p.why})`);
      }
      src = src.split(p.from).join(p.to);
      console.log(`ok  ${path.basename(file)}  ${p.why}`);
    }
    fs.writeFileSync(file, src);
  }

  // الحقن في index.html: مرة واحدة فقط، قبل وسم الحزمة.
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  if (html.includes('kickFetchShimMarker')) {
    console.log('skip index.html — الشيم موجود مسبقاً');
  } else {
    const anchor = '  <script type="module" crossorigin src="/icg1-site/assets/index-pzFdS_Fn.js"></script>';
    const n = html.split(anchor).length - 1;
    if (n !== 1) throw new Error(`index.html: توقعت 1 وموجود ${n} لنقطة الحقن`);
    html = html.replace(anchor, `  <!--kickFetchShimMarker-->\n${SHIM}\n${anchor}`);
    fs.writeFileSync(INDEX_HTML, html);
    console.log('ok  index.html  شيم الجلب المباشر');
  }
};

apply();
console.log('\nتم.');
