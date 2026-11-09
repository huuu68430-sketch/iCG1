/**
 * iCG1 — مولّد لعبة المافيا v5
 * يحوّل النموذج `mafia_v5_iCG1 (4).html` إلى ملف اللعبة الحقيقي:
 *   1) الصور المخفية داخل الملف (base64) تخرج إلى public/mafia/
 *   2) كل اللاعبين الوهميين (بوتات) يُحذفون
 *   3) النقل يتحول من ntfy.sh إلى Supabase (نافذة حقيقية بين الأجهزة)
 *   4) اللوبي يحصل على زر «مشاهدة طريقة اللعب»
 *   5) الغرفة تُبلّغ التطبيق المضيف بالكود والنتيجة (نقاط + روابط)
 *
 * التشغيل: node scripts/mafia-port.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'mafia_v5_iCG1 (4).html');
const OUT = path.join(ROOT, 'public', 'mafia.html');
const EXP_SRC = path.join(ROOT, 'mafia_explainer.html');
const EXP_OUT = path.join(ROOT, 'public', 'mafia-explainer.html');
const ASSETS = 'mafia/';

let html = fs.readFileSync(SRC, 'utf8');
const fails = [];
const used = [];

/* الصور المخفيّة داخل النموذج تخرج إلى ملفات */
fs.mkdirSync(path.join(ROOT, 'public', ASSETS), { recursive: true });
const dumpAssets = (text, names, dir) => {
  let i = 0;
  const extOf = m => (m === 'jpg' ? 'jpeg' : m);
  return text.replace(/data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)/g, (_, ext, b64) => {
    const name = names[i++];
    if (!name) return `data:image/${ext};base64,${b64}`;
    if (extOf(ext) !== path.extname(name).slice(1)) { fails.push(`[أصول] نوع غير متوقع في ${name}`); return ''; }
    fs.writeFileSync(path.join(ROOT, 'public', ASSETS, name), Buffer.from(b64, 'base64'));
    return `${dir}${name}`;
  });
};


/** استبدال نصّي مع ضمان عدد مرات التطابق */
function sub(find, to, count = 1, label = '') {
  const parts = html.split(find);
  const got = parts.length - 1;
  if (got !== count) { fails.push(`[${label || find.slice(0, 48)}] توقعت ${count} وطابق ${got}`); return; }
  html = parts.join(to);
  used.push(label || find.slice(0, 48));
}

/** إزالة سطر كاملاً (بمقدمة نصية مميزة) */
function dropLine(prefix) {
  const lines = html.split('\n');
  const i = lines.findIndex(l => l.trim().startsWith(prefix));
  if (i < 0) { fails.push(`[سطر] لم يوجد: ${prefix.slice(0, 48)}`); return; }
  lines.splice(i, 1);
  html = lines.join('\n');
  used.push('سطر: ' + prefix.slice(0, 40));
}

/** إزالة نطاق أسطر بمقدمة بداية ونهاية (شامل) */
function dropRange(startPrefix, endPrefix) {
  const lines = html.split('\n');
  const a = lines.findIndex(l => l.trim().startsWith(startPrefix));
  const b = lines.findIndex(l => l.trim().startsWith(endPrefix));
  if (a < 0 || b < 0 || b < a) { fails.push(`[نطاق] ${startPrefix.slice(0, 30)} → ${endPrefix.slice(0, 30)}`); return; }
  lines.splice(a, b - a + 1);
  html = lines.join('\n');
  used.push(`نطاق: ${startPrefix.slice(0, 28)}`);
}

/** استبدال نطاق أسطر (شامل) بنص جديد */
function replaceRange(startPrefix, linesCount, text) {
  const lines = html.split('\n');
  const a = lines.findIndex(l => l.trim().startsWith(startPrefix));
  if (a < 0) { fails.push(`[استبدال نطاق] ${startPrefix.slice(0, 40)}`); return; }
  lines.splice(a, linesCount, ...text.split('\n'));
  html = lines.join('\n');
  used.push(`تبديل نطاق: ${startPrefix.slice(0, 28)}`);
}

/* ============================================================
   1) إخراج الصور من داخل الملف
   ============================================================ */
const ASSET_LIST = [
  'stage-bg.jpeg', 'bg-doctor.jpeg', 'bg-mafia.jpeg', 'bg-elder.jpeg',
  'brand.png', 'bg-doctor.jpeg', 'bg-joker.jpeg', 'bg-detective.jpeg',
  'bg-mafia.jpeg', 'bg-elder.jpeg',
];
html = dumpAssets(html, ASSET_LIST, ASSETS);
if (/base64,[A-Za-z0-9+/=]{2000,}/.test(html)) fails.push('[أصول] بقيت صورة كبيرة داخل الملف');

/* ============================================================
   2) حذف البوتات وكل ما هو وهمي
   ============================================================ */
sub(',bot:!!bot', '', 1, 'البوت: علامة اللاعب');
sub('function addP(name,pid,bot){', 'function addP(name,pid){', 1, 'وسيط البوت');
/* علامة البوت تبقى في نسخة الهوست كي تعرف لوحة التحكم عدد البوتات */
sub('id:pid||rid(6)', 'id:safeId(pid)||rid(6)', 1, 'معرّف المقعد');
sub('pn:plan(),min:CFG.min,P:G.P.map', 'pn:plan(),min:CFG.min,mx:CFG.max,P:G.P.map', 1, 'سقف اللاعبين للهوست');
sub('const privSend=p=>{if(!p.bot)SY.tx(privFor(p))};', 'const privSend=p=>SY.tx(privFor(p));', 1, 'privSend');
html = html.replace(/;bot(Mafia|Doc|Elder|Chat|Vote|Det)\(\)/g, () => { used.push('نداء بوت'); return ''; });
sub('if(!p.bot)', '', 4, 'if(!p.bot)');
sub('if(!q.bot)', '', 2, 'if(!q.bot)');
sub('p.ready=!!p.bot', 'p.ready=false', 3, 'p.ready');
sub('${p.b?"🤖":""}', '', 3, 'شارة البوت');
dropLine('/* --- البوتات للتجربة --- */');
// الدوال المتبقية بعد حذف الكتلة
['const botMafia=', 'const botDoc=', 'const botElder=', 'const BCH=', 'const botChat=', 'const botVote=', 'const later=', 'const botDet=', 'else if(c==="bots"&&G.ph==="join")']
  .forEach(p => dropLine(p));
sub('else if(a==="bots")cmd("bots",{n:6});', '', 1, 'زر البوت (هوست قديم)');
sub('<button class="btn" data-a="bots">${ic("users")} 6 بوتات تجريبية</button>', '', 1, 'زر البوت v4');
sub('<button class="hb2" data-a="bots">${ic("users")} 6 بوتات تجريبية</button>', '', 2, 'زر البوت v5');
sub('<button class="tl" id="bBot" title="إضافة لاعبين تجريبيين" style="width:auto;padding:0 14px;gap:8px;align-items:center;display:flex"></button>', '', 1, 'زر البوت في الشاشة');
sub('const bb=$("#bBot");if(bb)bb.style.display=ph==="join"?"flex":"none"', '', 1, 'إظهار زر البوت');
html = html.replace(/\$\("#bBot"\)\.innerHTML=[\s\S]*?\$\("#bSnd"\)\.innerHTML=ic\("vol"\);/, '$("#bSnd").innerHTML=ic("vol");');
if (/\$\("#bBot"\)/.test(html)) fails.push('[بوت] بقايا إشارة إلى #bBot');
if (/\bbot(Mafia|Doc|Elder|Chat|Vote|Det)\b/.test(html)) fails.push('[بوت] بقايا دالة بوت');
sub('const CFG={server:"https://ntfy.sh",min:5,max:20};', 'const CFG={min:5,max:20};', 1, 'CFG');

/* ============================================================
   3) روابط الدخول: الرابط المختصر الحقيقي
   ============================================================ */
dropLine('const link=m=>m==="h"?');
// يُعاد تعريف link داخل كتبة النقل الجديدة

/* ============================================================
   4) النقل: Supabase بدل ntfy.sh
   ============================================================ */
replaceRange('/* ===== النقل ===== */', 5, `/* ===== النقل: حقيقي أونلاين عبر Supabase ===== */
const safeId=s=>String(s==null?"":s).replace(/[^A-Za-z0-9_-]/g,"").slice(0,40);
/* صور كيك روابط S3 موقّعة (طويلة وتنتهي بعد دقائق): السقف القديم كان يقطعها فتختفي الصورة */
const avExp=u=>{const m=/X-Amz-Date=(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z/.exec(String(u||""));if(!m)return false;
 const s=Number((/[?&]X-Amz-Expires=(\\d+)/.exec(String(u))||["","600"])[1]);return Date.now()>Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])+s*1000};
const avUrl=s=>{const u=String(s==null?"":s).trim();return /^https:\\/\\/[^"'<>\\s]{1,1200}$/.test(u)&&!avExp(u)?u:""};
const DB={url:"",key:"",ready:false};
const BUS={me:null,wait:[],seen:[],set:new Set()};
const HERE=location.href.split(/[?#]/)[0].replace(/[^/]*$/,"");
let APPU=location.origin+"/";
const whenDb=fn=>{if(DB.ready)fn();else BUS.wait.push(fn)};
const seen=u=>{if(!u)return false;if(BUS.set.has(u))return true;BUS.set.add(u);BUS.seen.push(u);if(BUS.seen.length>3000)BUS.seen.splice(0,1500).forEach(k=>BUS.set.delete(k));return false};
const parentNote=o=>{try{parent&&parent!==window&&parent.postMessage(Object.assign({source:"icg-mafia"},o),"*")}catch(e){}};
addEventListener("message",e=>{const d=e.data;if(!d||d.type!=="icg:mafia:cfg")return;
 if(d.url&&d.key){DB.url=String(d.url).replace(/\\/+$/,"");DB.key=String(d.key);DB.ready=true}
 if(d.app)APPU=String(d.app).replace(/\\/+$/,"")+"/";
 if(d.me){const pg=BUS.me?String(BUS.me.gk||""):"";const prk=BUS.me?String(BUS.me.rk||""):"";BUS.me=d.me;if(MODE==="p"&&(accId()!==P.pid||String(d.me.gk||"")!==pg||String(d.me.rk||"")!==prk)){P.joined=false;P.nextAt=0}if(MODE==="p"){P.pid=accId()||P.pid;render();syncProf()}}
 if(!DB.ready)return;
 BUS.wait.splice(0).forEach(f=>{try{f()}catch(x){}});
 rejoin();});
const hdr=extra=>Object.assign({apikey:DB.key,Authorization:"Bearer "+DB.key,"Content-Type":"application/json"},extra||{});
const NET={warn:0,bad:0,stop:0,db:null};
const stopped=()=>NET.stop&&Date.now()<NET.stop;
function dbFlag(ok){if(NET.db===ok)return;NET.db=ok;parentNote({type:"icg:mafia:db",ok:ok?1:0})}
function netBad(msg){NET.bad++;if(NET.bad<4)return;NET.bad=0;NET.stop=Date.now()+30000;dbFlag(0);
 if(NET.warn&&Date.now()-NET.warn<20000)return;NET.warn=Date.now();toast(msg)}
async function post(table,rows,merge){
 if(!DB.ready||stopped()||!rows||!rows.length)return false;
 try{const r=await fetch(DB.url+"/rest/v1/"+table+(merge?"?on_conflict="+encodeURIComponent(merge):""),
   {method:"POST",headers:hdr(merge?{Prefer:"resolution=merge-duplicates"}:null),body:JSON.stringify(rows)});
   if(!r.ok)netBad("تعذّر الحفظ في قاعدة البيانات — تأكد من تنفيذ SQL");else NET.bad=0;
   return r.ok}catch(e){netBad("انقطع الاتصال بالخادم");return false}}
async function del(table,filt){
 if(!DB.ready||stopped())return false;
 try{const r=await fetch(DB.url+"/rest/v1/"+table+"?"+filt,{method:"DELETE",headers:hdr()});return r.ok}catch(e){return false}}
/* روابط اللعبة: المختصر للاعب، كامل للوحة والشاشة */
const link=m=>m==="h"?APPU+"mahmah-game?r="+ROOM+"&m=h&k="+HK
  :m==="s"?APPU+"mahmah-game?r="+ROOM+"&m=s"
  :APPU+"m="+ROOM;
/* الإطارات: 16 إطاراً من محرك الإطارات + إطار صورة (النظام القديم) */
const FR_IDS=["basic","ramadan","dark","crown","fire","crystal","emerald","neon","galaxy","diamond","gold","imperial","thunder","royal","astral","vip"];
const frId=s=>{const v=String(s==null?"":s).trim().toLowerCase();return FR_IDS.includes(v)?v:""};
const frUrl=s=>{const u=String(s==null?"":s).trim();return /^(https:\\/\\/|\\/(?!\\/))[^"'<>\\s]{1,170}$/.test(u)?u:""};
/* تحدي الانضمام: رمز لمرة واحدة يربط إثبات الحساب بالغرفة واللحظة — بلا كشف مفتاح العضو */
const CHQ=[];let CH="";
function newCh(){try{const a=new Uint8Array(8);crypto.getRandomValues(a);CH=[...a].map(x=>x.toString(16).padStart(2,"0")).join("")}
 catch(e){CH=rid(16)}CHQ.push({v:CH,t:Date.now()});if(CHQ.length>10)CHQ.shift();return CH}
newCh();
const chLive=v=>CHQ.some(c=>c.v===v&&Date.now()-c.t<180000);
/* التحدي صالح طوال عمره (تدوير كل ٣٠ ثانية): تحديث الملف الشخصي للجوال نفسه يجب أن ينجح بلا انتظار تدوير */
const FAILS={};
const tooMany=h=>{const k=String(h).toLowerCase();const f=FAILS[k]||{n:0,t:Date.now()};if(Date.now()-f.t>60000){f.n=0;f.t=Date.now()}FAILS[k]=f;return f.n>=5};
const markFail=h=>{const k=String(h).toLowerCase();const f=FAILS[k]||{n:0,t:Date.now()};if(Date.now()-f.t>60000){f.n=0;f.t=Date.now()}f.n++;FAILS[k]=f};
const shaHex=async s=>{try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(s)));
 return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}catch(e){return""}};
/* التحقق من ملكية الحساب داخل قاعدة البيانات (دالة SQL آمنة لا تُرجع شيئاً من بيانات العضو)
   null = الشبكة/قاعدة البيانات معطّلة — لا يُحسب على اللاعب. true = مطابق. */
async function verifyAcc(handle,ch,token){
 if(!DB.ready||stopped())return null;
 if(!chLive(ch))return "stale";
 if(!/^[a-f0-9]{64}$/.test(String(token||"")))return "bad";
 try{const r=await fetch(DB.url+"/rest/v1/rpc/mafia_verify",{method:"POST",headers:hdr({"Content-Type":"application/json"}),
   body:JSON.stringify({p_handle:String(handle).toLowerCase(),p_room:ROOM.toUpperCase(),p_nonce:ch,p_token:String(token).toLowerCase()})});
  if(!r.ok){netBad("تعذّر التحقق من الحسابات — نفّذ ملف supabase/mafia_verify.sql");return null}
  return(await r.json())===true?true:"no"}
 catch(e){netBad("تعذّر التحقق من الحسابات — نفّذ ملف supabase/mafia_verify.sql");return null}}
/* تثبيت لاعب موثوق: مقعد جديد أو تحديث مقعد قائم بالملف الشخصي */
function applyProf(p,m){if(!p)return;p.av=avUrl(m.av);p.fr=frId(m.fr);p.fu=frUrl(m.fu);p.ap=1}
function seatAcc(h,nm,m){const p=pl(h);
 if(p){if(G.ph==="join")p.name=nm;applyProf(p,m);drawStage();pubAll();hostSync();SY.tx(privFor(p));return}
 if(G.ph!=="join")return tx(h,{t:"rej",x:"اللعبة بدأت بالفعل",h:1});
 if(G.P.length>=CFG.max)return tx(h,{t:"rej",x:"اللعبة ممتلئة",h:1});
 const np=addP(nm,h);if(np){applyProf(np,m);drawStage();pubAll();hostSync()}}
/* الطبقة: جدول mafia_bus — كل رسالة سطر، وكل جهاز يقرأ ما يخصه فقط.
   بدون قاعدة البيانات تبقى القنوات المحلية (نفس الجهاز) حتى لا تموت اللعبة. */
const SY={id:rid(6),fns:[],bc:null,q:[],busy:false,pending:false,timer:0,tickN:0,last:0,
 init(){
  try{this.bc=new BroadcastChannel("icg1mf"+ROOM);this.bc.onmessage=e=>{const m=e.data;if(m&&m.f!==this.id&&!seen(m.u))this.rx(m)}}catch(e){}
  whenDb(()=>{if(this.timer)return;this.timer=setInterval(()=>this.tick(),700);this.tick();
   if(MODE==="s")dbRoom();
   parentNote({type:"icg:mafia:ready",mode:MODE,room:ROOM,db:1})});
  setTimeout(()=>{if(!DB.ready){parentNote({type:"icg:mafia:ready",mode:MODE,room:ROOM,db:0});
   toast("وضع هذا الجهاز فقط — نفّذ ملف SQL للعب بين الهواتف")}},5000)},
 mine(){return MODE==="s"?"or=(dst.is.null,dst.eq.stage)":MODE==="h"?"dst=eq.host":"or=(dst.is.null,dst.eq."+safeId(P.pid)+")"},
 async tick(){
  if(!DB.ready)return;
  if(!this.busy&&!stopped()){this.busy=true;
   try{const u=DB.url+"/rest/v1/mafia_bus?select=id,msg&room_code=eq."+encodeURIComponent(ROOM)+"&"+this.mine()+"&id=gt."+this.last+"&order=id.asc&limit=300";
    const r=await fetch(u,{headers:hdr()});
    if(r.ok){NET.bad=0;dbFlag(1);for(const row of await r.json()){if(row.id>this.last)this.last=row.id;const m=row.msg;if(m&&m.f!==this.id&&!seen(m.u))this.rx(m)}}
    else netBad("تعذّر قراءة غرفة اللعبة — تأكد من تشغيل SQL الخاص بها")}
   catch(e){netBad("تعذّر قراءة غرفة اللعبة — تأكد من تشغيل SQL الخاص بها")}
   this.busy=false;}
  if(MODE==="s"&&++this.tickN%60===0)del("mafia_bus","room_code=eq."+encodeURIComponent(ROOM)+"&created_at=lt."+new Date(Date.now()-120000).toISOString());
  this.flush()},
 rx(m){if(m&&m.f!==this.id)this.fns.forEach(f=>{try{f(m)}catch(e){}})},
 tx(m){m.f=this.id;m.u=rid(8);seen(m.u);try{this.bc&&this.bc.postMessage(m)}catch(e){}
  if(DB.ready){this.q.push(m);if(this.q.length>300)this.q.splice(0,this.q.length-300);this.flush()}},
 async flush(){
  if(!DB.ready||this.pending||!this.q.length)return;
  this.pending=true;const batch=this.q.splice(0,50);
  const rows=batch.map(m=>({room_code:ROOM,src:m.f,dst:m.to==null?null:String(m.to),msg:m}));
  const ok=await post("mafia_bus",rows);
  if(!ok)this.q.unshift(...batch);
  this.pending=false;
  if(this.q.length&&DB.ready)setTimeout(()=>this.flush(),400)}};
/* ===== التجديد في قاعدة البيانات (الغرفة، الأدوار، الأحداث، النتيجة) ===== */
const ROOMSTATE={t:0};
function dbRoom(){if(!DB.ready||Date.now()-ROOMSTATE.t<2500)return;ROOMSTATE.t=Date.now();
 post("mafia_rooms",[{code:ROOM,host_handle:null,state:pubObj(),updated_at:new Date().toISOString()}],"code")}
function dbRoles(){if(!DB.ready)return;
 post("mafia_roles",G.P.map(p=>({room_code:ROOM,user_id:p.id,username:p.name,role:p.role})),"room_code,user_id")}
function dbEvents(kind,payload){if(!DB.ready)return;post("mafia_events",[{room_code:ROOM,kind,payload:payload||{}}])}
function dbMatch(){if(!DB.ready)return;
 post("mafia_matches",[{room_code:ROOM,winner:G.win||"",rounds:G.rd,
   players:G.P.map(p=>({id:p.id,name:p.name,alive:!!p.alive,role:p.role}))}])}
function announceRoom(){parentNote({type:"icg:mafia:room",room:ROOM,playerLink:link("p"),hostLink:link("h")})}`);

/* ============================================================
   5) الانضمام على الشاشة: تحقق حقيقي من ملكية حساب Kick
   ============================================================ */
replaceRange('if(m.t==="join"){let p=pl(m.pid);', 2, `if(m.t==="join"){const h=safeId(m.pid);if(!h||h.length<3)return;const nm=String(m.name||"").trim().slice(0,16)||h;
  /* بلا قاعدة بيانات لا يوجد ما نتحقق منه — تبقى اللعبة على الجهاز نفسه فقط */
  if(!DB.ready)return seatAcc(h,nm,m);
  if(!m.c||!m.k||!m.a)return tx(h,{t:"rej",x:"الدخول بحساب Kick فقط — سجّل الدخول ثم أعد المحاولة",h:1});
  if(tooMany(h))return tx(h,{t:"rej",x:"محاولات كثيرة — انتظر دقيقة ثم أعد الدخول",h:1});
  if(!chLive(m.k))return tx(h,{t:"rej",x:"انتهت صلاحية التحقق — أعد المحاولة"});
  verifyAcc(h,m.k,m.a).then(v=>{
   if(v===null)return tx(h,{t:"rej",x:"تعذّر التحقق من الحسابات الآن — جرّب بعد لحظات"});
   if(v==="stale")return tx(h,{t:"rej",x:"انتهت صلاحية التحقق — أعد المحاولة"});
   if(v==="bad")return tx(h,{t:"rej",x:"الإثبات لم يكتمل على جوالك — سجّل الخروج وادخل من جديد (١)",h:1});
   if(v!==true){markFail(h);return tx(h,{t:"rej",x:"مفتاح حسابك على جوالك لا يطابق حسابك في الموقع — سجّل الخروج وادخل من جديد (٢)",h:1})}
   seatAcc(h,nm,m)})}`);

/* ============================================================
   6) دخول اللاعب بحسابه — بلا كتابة اسم
   ============================================================ */
sub(
  'function pBoot(){SY.init();SY.fns.push(pRx);try{P.pid=localStorage.getItem("mf"+ROOM)||null}catch(e){}if(P.pid){P.joined=true;hello()}render();setInterval(()=>{if(P.joined&&!P.pub)hello()},4000);setInterval(ptick,500)}',
  `function accId(){return BUS.me?safeId(BUS.me.handle||BUS.me.id):""}
function profSig(){const m=BUS.me;if(!m)return "";return [String(m.name||""),avUrl(m.avatar),frId(m.fr),frUrl(m.fu)].join("|")}
let PSIG="";
function joinProof(){const g=BUS.me&&BUS.me.gk;return g&&P.ck?shaHex(g+"|"+ROOM.toUpperCase()+"|"+P.ck):Promise.resolve("")}
function tryAutoJoin(force){if(MODE!=="p"||!BUS.me||!BUS.me.gk||!P.ck)return;const id=accId();if(!id)return;
 if(P.joined&&P.pid===id&&!force)return;P.pid=id;P.name=String(BUS.me.name||id).trim().slice(0,16)||id;P.joined=true;P.rej="";
 joinProof().then(a=>{if(!a){P.joined=false;return render()}
  PSIG=profSig();SY.tx({t:"join",pid:P.pid,name:P.name,av:avUrl(BUS.me.avatar),fr:frId(BUS.me.fr),fu:frUrl(BUS.me.fu),k:P.ck,c:1,a,to:"stage"});render()})}
function syncProf(){if(MODE!=="p"||!P.joined||!BUS.me)return;const s=profSig();if(!s||s===PSIG)return;tryAutoJoin(true)}
function rejoin(){if(MODE==="p"&&BUS.me&&BUS.me.gk&&(!P.joined||!P.pub)&&Date.now()>(P.nextAt||0))tryAutoJoin()}
function pBoot(){SY.init();SY.fns.push(pRx);P.pid=accId()||rid(6);render();
 setInterval(()=>{if(P.joined&&!P.pub)hello()},4000);
 setInterval(rejoin,2600);
 setInterval(ptick,500)}`,
  1, 'pBoot: حساب Kick فقط');

/* الرفض يرجع اللاعب لانتظار قصير بدل إغراق الشبكة */
sub('else if(m.t==="rej"){P.rej=m.x;P.joined=false;render()}',
  'else if(m.t==="rej"){P.rej=m.x;P.joined=false;P.nextAt=Date.now()+(m.h?12000:6000);parentNote({type:"icg:mafia:needkey"});render()}',
  1, 'الرفض: انتظار قصير');

/* اللاعب يلتقط تحدي الشاشة قبل أن يرسل إثباته */
sub('function pRx(m){if(m.to&&m.to!==P.pid)return;',
  'function pRx(m){if(m.to&&m.to!==P.pid)return;\n if(m.t==="ch"){if(m.k&&m.k!==P.ck){P.ck=m.k;if(!P.joined)rejoin()}return}',
  1, 'pRx: تحدي الانضمام');

/* شاشة الانضمام: بطاقة الحساب بدل خانة الاسم */
sub(
  'if(!P.joined)return wrap("",`<h1>المافيا</h1><p style="color:#ff9aa6">${esc(P.rej)}</p><p>اكتب اسمك للانضمام</p><div class="pb"><input class="inp" id="nm" maxlength="16" placeholder="اسمك" autocomplete="off"><button class="btn p" data-a="join">انضمام ${ic("play","f")}</button></div>`);',
  `if(!P.joined){const acc=BUS.me,who=acc?{name:acc.name,n:acc.name,av:avUrl(acc.avatar),fr:frId(acc.fr),fu:frUrl(acc.fu)}:null;
 return wrap("",\`<h1 style="font-size:clamp(26px,3vw,52px)">\${who?"جارٍ دخولك إلى اللعبة…":"المافيا"}</h1>
 \${who?\`<div class="acc">\${av(who,74)}<div><b>\${esc(acc.name||acc.handle)}</b><span>@\${esc(acc.handle)} · Kick</span></div></div>\`:""}
 <p>\${who?"ثوانٍ ويكتمل دخولك تلقائياً":"المافيا للأعضاء المسجّلين فقط — سجّل دخولك بحساب Kick"}</p>
 <div class="big" style="color:var(--gold)">\${ic("load","spin")}</div>
 <div class="pb"><button class="howbtn" data-how>📖 كيف ألعب؟</button></div>
 \${P.rej?\`<p style="color:#ff9aa6;font-size:14px;max-width:520px;margin:14px auto 8px">\${esc(P.rej)}</p><button class="btn" data-a="join">إعادة المحاولة</button>\`:""}\`)}`,
  1, 'شاشة الانضمام بالحساب');

sub('if(a==="join"){const nm=($("#nm").value||"").trim();if(!nm)return toast("اكتب اسمك");P.pid=P.pid||rid(6);P.name=nm;try{localStorage.setItem("mf"+ROOM,P.pid)}catch(x){}P.rej="";P.joined=true;SY.tx({t:"join",pid:P.pid,name:nm,to:"stage"});render()}',
  'if(a==="join"){P.rej="";P.nextAt=0;tryAutoJoin(true)}', 1, 'زر الدخول بالحساب');

sub('if(e.key==="Enter"&&e.target.id==="nm"){const b=document.querySelector("[data-a=join]");b&&b.click()}',
  '', 1, 'حذف مرجع خانة الاسم');

/* لا مقعد بلا حساب: أي محاولة انضمام مجهولة تُرد، والمعرّف المحلي يُسحب حتى يصل تحدٍّ جديد */
sub('else if(m.t==="unk"){P.pub=null;P.joined=false;try{localStorage.removeItem("mf"+ROOM)}catch(e){}render()}',
  'else if(m.t==="unk"){P.pub=null;P.joined=false;P.ck="";render()}', 1, 'unk: بلا مقعد');

/* ============================================================
   5.5) صورة العضو من Kick + إطار موقعه المجهّز
   ============================================================ */
sub(
  'const av=(p,s)=>`<span class="av" style="--c:${p.c||p.col};${s?`--s:${s}px`:""}"><i>${esc([...(p.n||p.name)][0]||"?").toUpperCase()}</i></span>`;',
  `const av=(p,s)=>{const st=\`--c:\${p.c||p.col};\${s?\`--s:\${s}px\`:""}\`;const F=window.ICG1Frames;
 const face=p.av?\`<img src="\${esc(p.av)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">\`:"";
 const ini=\`<i>\${esc([...(p.n||p.name||"?")][0]||"?").toUpperCase()}</i>\`;
 if(F&&p.fr&&F.indexOf(p.fr)>=0)return \`<span class="av fx" style="\${st}">\${F.avatar({frameId:p.fr,src:p.av||"",initial:String(p.n||p.name||"?").slice(0,2)})}</span>\`;
 return \`<span class="av\${p.fu?" fu":""}" style="\${st}">\${face}\${ini}\${p.fu?\`<img class="frl" src="\${esc(p.fu)}" alt="" onerror="this.remove()">\`:""}</span>\`};`,
  1, 'أفاتار: صورة العضو + إطاره');
sub('c:p.col,a:p.alive?1:0,r:p.ready?1:0}',
  'c:p.col,a:p.alive?1:0,r:p.ready?1:0,av:p.av||"",fr:p.fr||"",fu:p.fu||""}', 1, 'نشر الصورة والإطار للجوال');
sub('n:p.name,r:p.role,a:p.alive?1:0,b:p.bot?1:0,rd:p.ready?1:0,m:p.muted?1:0}',
  'n:p.name,r:p.role,a:p.alive?1:0,b:p.bot?1:0,rd:p.ready?1:0,m:p.muted?1:0,av:p.av||"",fr:p.fr||"",fu:p.fu||""}', 1, 'نشر الصورة والإطار للوحة');

/* ============================================================
   6) الشاشة الكبرى تُبلّغ التطبيق + تسجيل الأدوار والنتيجة
   ============================================================ */
sub('addEventListener("pointerdown",()=>ac(),{once:true});drawStage()}',
  `addEventListener("pointerdown",()=>ac(),{once:true});drawStage();
 announceRoom();whenDb(announceRoom);setInterval(()=>{if(G.ph==="join")announceRoom()},5000);
 /* تحدي الانضمام: يصل كل الهواتف ويتجدد كل نصف دقيقة */
 setInterval(()=>{if(!CHQ.length||Date.now()-CHQ[CHQ.length-1].t>30000)newCh();tx(null,{t:"ch",k:CH})},4000)}`, 1, 'stageMain tail');

html += `
<script>
/* ===== التجديد إلى قاعدة البيانات + نهاية اللعبة ===== */
(function(){
if(MODE!=="s")return;
const _deal=deal;deal=function(){const e=_deal();if(!e){dbRoles();dbEvents("deal",{players:G.P.length,m:plan().m})}return e};
const _rg=resetGame;resetGame=function(){if(DB.ready)del("mafia_roles","room_code=eq."+encodeURIComponent(ROOM));_rg()};
const _op=resolveOp;resolveOp=function(){_op();if(G.res&&G.res.id)dbEvents("kill",{id:G.res.id,name:G.res.name,saved:G.res.ok===false})};
const _rv=resolveVote;resolveVote=function(){_rv();if(G.res&&G.res.ej)dbEvents("exile",{id:G.res.id,name:G.res.name})};
const _eg=endGame;endGame=function(w){const r=_eg(w);dbMatch();dbEvents("end",{win:w,rounds:G.rd});
 parentNote({type:"icg:mafia:end",room:ROOM,winner:w,rounds:G.rd,
   players:G.P.map(p=>({id:p.id,name:p.name,alive:!!p.alive,role:p.role,av:p.av||"",ap:p.ap?1:0}))});return r};
/* pubAll ثابت (const) — لذا نلتقط التغييرات من hostSync */
const _hs=hostSync;hostSync=function(){_hs();dbRoom()};
})();
</script>
`;

/* ============================================================
   7) زر «مشاهدة طريقة اللعب» + الطبقة الشارحة
   ============================================================ */
sub('<p class="st" style="color:${ok?"#7dffb0":"var(--gold)"}">${ok?"جاهزون! اللعبة تبدأ فقط عندما يضغط المدير"',
  '<button class="howbtn" data-how>📖 مشاهدة طريقة اللعب</button><p class="st" style="color:${ok?"#7dffb0":"var(--gold)"}">${ok?"جاهزون! اللعبة تبدأ فقط عندما يضغط المدير"', 1, 'لوبي الشاشة: زر الشرح');

sub('<h1>أنت داخل اللعبة!</h1><p>انتظر حتى يبدأ الهوست التوزيع</p>',
  '<h1>أنت داخل اللعبة!</h1><p>انتظر حتى يبدأ المدير التوزيع</p><button class="howbtn" data-how>📖 مشاهدة طريقة اللعب</button>', 1, 'جوال: زر الشرح في الانتظار');

html += `
<style>
/* ===== صورة العضو الحقيقية + إطار موقعه داخل اللوبي ===== */
.av{overflow:hidden;position:relative}
.av>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;
 background:#fff;filter:saturate(1.06) contrast(1.04);transition:filter .4s}
.seat.dead .av>img{filter:grayscale(1) brightness(.62)}
.av.fx{overflow:visible;background:none!important;box-shadow:none!important;border-color:transparent!important}
.av.fx>img{z-index:1}
.av.fx>svg{position:absolute;left:-21%;top:-21%;width:142%;height:142%;z-index:3;overflow:visible;pointer-events:none}
.av.fu{overflow:visible}
.av>img.frl{inset:auto;left:-20%;top:-20%;width:140%;height:140%;object-fit:contain;background:none;filter:none;z-index:3}
.acc{display:flex;align-items:center;gap:14px;justify-content:center;margin:6px auto 10px}
.acc b{display:block;font:800 20px var(--dsp);color:#ffe9b8;line-height:1.2}
.acc span{display:block;font:700 12px Tajawal;letter-spacing:.4px;color:#a79a9a;direction:ltr;text-align:right}
/* ===== شرح طريقة اللعب ===== */
.howbtn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px;justify-content:center;
 padding:10px 22px;border-radius:99px;font:800 15px Tajawal,var(--dsp);letter-spacing:.3px;color:#1a1006;
 background:linear-gradient(180deg,#f9e0a4,#c08b3a);box-shadow:0 0 26px #e8be6e66,inset 0 0 12px #fff6;
 transition:transform .2s,box-shadow .2s;animation:gp 2.4s ease-in-out infinite}
.howbtn:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 0 40px #e8be6ecc}
.howbtn:active{transform:scale(.96)}
#how{position:fixed;inset:0;z-index:99999;display:none;background:#04030a}
#how.on{display:block;animation:hwi .4s cubic-bezier(.2,1,.3,1) both}
@keyframes hwi{from{opacity:0;transform:scale(1.04)}}
#how>iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
#how .hbar{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;align-items:center;gap:10px;
 padding:10px 14px;background:linear-gradient(#07060be6,#07060b00)}
#how .hbar b{font:italic 800 20px var(--dsp);color:#ffe9b8;text-shadow:0 0 18px #e8be6e}
#how .hbar .x{all:unset;cursor:pointer;margin-inline-start:auto;padding:7px 16px;border-radius:99px;
 background:#ffffff1a;border:1px solid #ffffff44;color:#fff;font:800 14px Tajawal}
#how .hbar .x:hover{background:#e8be6e;color:#1a1006}
</style>
<script>
(function(){
const el=document.createElement("div");el.id="how";el.setAttribute("aria-hidden","true");
el.innerHTML='<div class="hbar"><b>شرح طريقة اللعب</b><button class="x" id="howx">إغلاق ✕</button></div><iframe title="شرح طريقة اللعب" allow="fullscreen" data-src="'+HERE+'mafia-explainer.html"></iframe>';
document.body.appendChild(el);
const open=()=>{el.classList.add("on");el.setAttribute("aria-hidden","false");
 const f=el.querySelector("iframe");if(!f.src)f.src=f.dataset.src;parentNote({type:"icg:mafia:how",open:1})};
const close=()=>{el.classList.remove("on");el.setAttribute("aria-hidden","true");parentNote({type:"icg:mafia:how",open:0})};
document.addEventListener("click",e=>{if(e.target.closest("[data-how]")){open();return}
 if(e.target.closest("#howx")||e.target===el)close()});
addEventListener("keydown",e=>{if(e.key==="Escape")close()});
})();
</script>
`;

/* ============================================================
   8) زر الإدارة: يفتح اللوحة في نافذة ثانية فوراً
   ============================================================ */
sub('</head>', '<script src="frames-runtime.js"></script>\n</head>', 1, 'تحميل محرك الإطارات');

sub('<button class="tl" id="bHost" title="رابط الهوست">',
  '<button class="tl" id="bHost" title="لوحة الإدارة — نافذة جديدة">', 1, 'عنوان زر الإدارة');

sub('$("#bHost").onclick=()=>{$("#hl").textContent=link("h");$("#ho").href=link("h");$("#dp").classList.add("on")};',
  `$("#bHost").onclick=()=>{const u=link("h");const w=window.open(u,"icg1host");
 if(w){toast("فُتحت لوحة الإدارة في نافذة جديدة");$("#dp").classList.remove("on")}
 else{$("#hl").textContent=u;$("#ho").href=u;$("#dp").classList.add("on");toast("المتصفح منع النافذة — استخدم الرابط أو انسخه")}};`,
  1, 'فتح لوحة الإدارة في نافذة ثانية');

/* ============================================================
   9) بوتات المدير: 4 كحد أقصى (بديل خفيف عن بوتات النموذج المحذوفة)
   ============================================================ */
html += `
<style>
/* ===== شارة البوت في قائمة اللاعبين (لوحة المدير فقط) ===== */
#app .pc2 .nn .btg{font-style:normal;font:800 9px Tajawal;padding:1px 6px;border-radius:99px;
 background:#4fa3ff2e;border:1px solid #4fa3ff66;color:#9ccfff;margin-inline-start:6px;vertical-align:middle}
</style>
<script>
/* ===== بوتات المدير: 4 كحد أقصى ===== */
(function(){
const MAXB=4,BN=["سلطان","نورة","فهد","ريم"];
const botCount=()=>G.P.filter(p=>p.bot).length;
function addBots(){
 if(G.ph!=="join")return;
 let left=Math.min(MAXB-botCount(),CFG.max-G.P.length);
 for(let i=0;i<left;i++){
  const used=new Set(G.P.map(p=>p.name.toLowerCase()));
  const name=BN.find(n=>!used.has(n.toLowerCase()));
  if(!name)break;
  const p=addP(name,null);
  if(!p)break;
  p.bot=true;lg(name+" (بوت) انضم");
 }
 drawStage();pubAll();hostSync();
}
if(MODE==="s"){
 const _ocb=onCmd;
 onCmd=function(m){if(m.c==="bots"){addBots();return}return _ocb(m)};
 const _ad=afterDeal;
 afterDeal=function(){G.P.forEach(p=>{if(p.bot)p.ready=true});return _ad()};
 const pk=a=>a.length?a[Math.floor(Math.random()*a.length)]:null;
 const _en=enter;
 enter=function(ph,st){
  _en(ph,st);
  const B=G.P.filter(p=>p.bot&&p.alive);
  if(!B.length)return;
  if(ph==="night"&&st==="mafia"){
   const maf=B.filter(p=>p.role==="mafia");
   maf.forEach(p=>{const t=pk(alive().filter(x=>x.role!=="mafia"));if(t)G.nt.mv[p.id]=t.id});
   if(maf.length){const ms=ofr("mafia");
    if(ms.every(x=>G.nt.mv[x.id])&&new Set(ms.map(x=>G.nt.mv[x.id])).size===1)
     setTimeout(()=>{if(G.st==="mafia")next()},1800)}
  }else if(ph==="night"&&st==="doctor"){
   const d=B.find(p=>p.role==="doctor"),t=d&&pk(alive());
   if(t)G.nt.protect=t.id;
  }else if(ph==="night"&&st==="elder"){
   const e=B.find(p=>p.role==="elder"),t=e&&pk(alive().filter(x=>x.id!==e.id));
   if(t)G.nt.silence=t.id;
  }else if(ph==="day"&&st==="vote"){
   B.forEach(p=>{const t=pk(alive().filter(x=>x.id!==p.id));G.votes[p.id]=t?t.id:"skip"});
  }
 };
}
if(MODE==="h"){
 const _hr=hRender;
 hRender=function(){
  _hr();
  const v=H.hv;if(!v||v.ph!=="join")return;
  const acts=$("#app .hs2 .acts");if(!acts)return;
  const n=v.P.filter(p=>p.b).length,old=!v.mx,left=Math.min(MAXB-n,(v.mx||CFG.max)-v.P.length);
  const b=document.createElement("button");
  b.type="button";b.className="hb2";
  b.innerHTML=ic("users")+" "+(old?"إضافة بوتات — حدّث الشاشة":"إضافة بوتات ("+n+"/4)");
  b.disabled=old||n>=4||left<=0;
  if(old)b.title="صفحة العرض تعمل بنسخة قديمة — حدّثها (F5) مرة واحدة";
  b.onclick=()=>{
   const had=v.P.length;
   b.disabled=true;b.textContent="جارٍ إضافة البوتات…";
   cmd("bots");
   setTimeout(()=>{const cur=H.hv;if(!(cur&&cur.P.length>had))toast("لم تصل الإضافة — حدّث صفحة الشاشة الكبيرة (F5) ثم أعد المحاولة")},4000);
  };
  acts.appendChild(b);
  const rows=document.querySelectorAll("#app .pls2 .pc2");
  v.P.forEach((p,i)=>{if(!p.b||!rows[i])return;const nm=rows[i].querySelector(".nn");
   if(nm&&!nm.querySelector(".btg")){const s=document.createElement("i");s.className="btg";s.textContent="بوت";nm.appendChild(s)}});
 };
 hRender();
}
})();
</script>
`;

/* ============================================================
   10) دردشة اللاعب: فقاعات واضحة + ظهور فوري لكل رسالة
   ============================================================ */
/* الشاشة تذيّل كل رسالة بمعرّف دردشة (mid) وهوية صاحبها (pid) —
   معرّف مستقل لأن النقل يعيد كتابة u لكل رسالة عند إعادة بثّها */
sub('tx(q.id,{t:"mchat",n:p.name,x})', 'tx(q.id,{t:"mchat",n:p.name,x,pid:p.id,mid:m.mid})', 1, 'دردشة المافيا: pid/mid');
sub('tx(null,{t:"chat",n:p.name,c:p.col,x})', 'tx(null,{t:"chat",n:p.name,c:p.col,x,pid:p.id,mid:m.mid})', 1, 'دردشة النهار: pid/mid');

/* صدى الرسالة يستبدل نسختها الفورية بدل أن يكرّرها (ومعي للمعنى عند شاشة قديمة) */
sub('else if(m.t==="chat"){P.dchat.push(m);P.dchat=P.dchat.slice(-60);lineAdd(m)}',
  'else if(m.t==="chat"){let i=m.mid?P.dchat.findIndex(x=>x.mid===m.mid):-1;if(i<0&&!m.mid)i=P.dchat.findIndex(x=>x.pe&&x.x===m.x&&x.n===m.n);if(i>=0){if(!m.mid){m.mid=P.dchat[i].mid;m.pid=P.pid}P.dchat[i]=m}else{P.dchat.push(m);P.dchat=P.dchat.slice(-60)}lineAdd(m)}',
  1, 'صّدى دردشة النهار');
sub('else if(m.t==="mchat"){P.mchat.push(m);P.mchat=P.mchat.slice(-60);lineAdd(m)}',
  'else if(m.t==="mchat"){let i=m.mid?P.mchat.findIndex(x=>x.mid===m.mid):-1;if(i<0&&!m.mid)i=P.mchat.findIndex(x=>x.pe&&x.x===m.x&&x.n===m.n);if(i>=0){if(!m.mid){m.mid=P.mchat[i].mid;m.pid=P.pid}P.mchat[i]=m}else{P.mchat.push(m);P.mchat=P.mchat.slice(-60)}lineAdd(m)}',
  1, 'صّدى دردشة المافيا');

/* فقاعة بدل سطر مسطّح: صورة، اسم، ورسالة — ورسالتك بلون ذهبي */
sub('const line=m=>m.sys?`<div class="sy">${esc(m.x)}</div>`:`<div><b>${esc(m.n)}</b> ${esc(m.x)}</div>`;',
  'const line=m=>m.sys?`<div class="sy">${esc(m.x)}</div>`:`<div class="ms${m.pid===P.pid?" me":""}${m.pe?" pe":""}"${m.mid?` data-mid="${esc(m.mid)}"`:""}>${av({n:m.n,c:m.c||col(m.n)},30)}<div class="bb"><b>${esc(m.n)}</b><span>${esc(m.x)}</span></div></div>`;',
  1, 'فقاعة الدردشة');
sub('function lineAdd(m){const c=$("#cl");if(c){c.insertAdjacentHTML("beforeend",line(m));c.scrollTop=c.scrollHeight}}',
  'function lineAdd(m){const c=$("#cl");if(!c)return;const old=m.mid?c.querySelector(\'[data-mid="\'+m.mid+\'"]\'):null;if(old)old.outerHTML=line(m);else c.insertAdjacentHTML("beforeend",line(m));c.scrollTop=c.scrollHeight}',
  1, 'إضافة سطر فوري/استبدال');

/* الإرسال يظهر عند اللاعب قبل وصول الصدى، ويُزال إن فشل خلال ٨ ثوانٍ */
sub('else if(a==="sendM"||a==="sendD"){const i=$("#ci"),x=(i.value||"").trim();if(!x)return;SY.tx({t:"chat",pid:P.pid,ch:a==="sendM"?"m":"d",x,to:"stage"});i.value="";i.focus()}});',
  `else if(a==="sendM"||a==="sendD"){const i=$("#ci"),x=(i.value||"").trim();if(!x)return;const mc=a==="sendD",mid=rid(8),msg={t:"chat",pid:P.pid,mid,ch:mc?"d":"m",x,to:"stage"};SY.tx(msg);
  const acc=me()||{n:P.name,c:col(P.name||"?")},q={t:"chat",n:acc.n||P.name,c:acc.c||col(acc.n||P.name),x,pid:P.pid,mid,pe:1},arr=mc?P.dchat:P.mchat;
  arr.push(q);if(arr.length>60)arr.splice(0,arr.length-60);lineAdd(q);
  setTimeout(()=>{const z=arr.findIndex(y=>y.mid===mid&&y.pe);if(z<0)return;arr.splice(z,1);const el=$('#cl [data-mid="'+mid+'"]');el&&el.remove()},8000);
  i.value="";i.focus()}});`,
  1, 'إرسال فوري + تنظيف المعلّق');

sub('<div class="chat" id="cl">', '<div class="chat" id="cl" data-empty="لا رسائل بعد — ابدأ النقاش">', 3, 'حاوية الدردشة: تلميح فارغ');

html += `
<style>
/* ===== دردشة اللاعب: فقاعات واضحة + إظهار فوري ===== */
.chat{gap:10px;min-height:150px;max-height:42vh;padding:14px;border-radius:20px;overflow-y:auto;
 background:linear-gradient(180deg,rgba(24,15,30,.94),rgba(6,4,10,.94));
 border:1px solid #ffffff1f;box-shadow:inset 0 1px 0 #ffffff0f,0 16px 36px #0007;
 scrollbar-width:thin;scrollbar-color:#e8be6e55 transparent}
.chat::-webkit-scrollbar{width:6px}
.chat::-webkit-scrollbar-thumb{background:#e8be6e55;border-radius:99px}
.chat::-webkit-scrollbar-track{background:transparent}
.chat:empty::before{content:attr(data-empty);margin:auto;padding:10px;color:#8d8194;font:700 14px Tajawal;text-align:center}
.chat .ms{display:flex;align-items:flex-end;gap:8px;width:auto;max-width:90%;align-self:flex-start;
 background:none;border:0;padding:0;box-shadow:none;animation:cin .32s cubic-bezier(.2,1,.3,1) both}
.chat .ms .bb{display:flex;flex-direction:column;gap:2px;width:auto;max-width:100%;padding:8px 12px;
 border-radius:16px 16px 5px 16px;background:#ffffff0d;border:1px solid #ffffff17;
 box-shadow:0 8px 18px #0006;animation:none}
.chat .ms .bb b{font:800 11px/1.2 Tajawal;color:#ffd98a;letter-spacing:.2px}
.chat .ms .bb span{font:600 14.5px/1.55 Tajawal;color:#f4eef8;word-break:break-word;overflow-wrap:anywhere}
.chat .ms.me{align-self:flex-end;flex-direction:row-reverse}
.chat .ms.me .av{display:none}
.chat .ms.me .bb{background:linear-gradient(135deg,#4b3511,#251a0b);border-color:#e8be6e59;
 border-radius:16px 16px 16px 5px;box-shadow:0 8px 18px #0006,inset 0 0 0 1px #ffe6a31a}
.chat .ms.me .bb b{display:none}
.chat .ms.pe{opacity:.55}
.chat .sy{align-self:center;padding:4px 12px;border-radius:99px;background:#ff4a5e1a;border:1px solid #ff4a5e40;
 color:#ffb3bb;font:800 12px Tajawal}
@keyframes cin{from{opacity:0;transform:translateY(7px) scale(.97)}}
.pb .row{gap:0;align-items:center;padding:5px;border-radius:20px;background:#00000066;border:1px solid #e8be6e4d;
 box-shadow:inset 0 1px 0 #ffffff10,0 8px 20px #0006;transition:border-color .2s,box-shadow .2s}
.pb .row:focus-within{border-color:#e8be6e;box-shadow:0 0 0 3px #e8be6e1f,0 8px 20px #0006}
.pb .row .inp{flex:1;max-width:none;padding:11px 14px;border:0;background:transparent;border-radius:14px;
 font:700 15px Tajawal;text-align:right;box-shadow:none}
.pb .row .inp::placeholder{color:#8d8194}
.pb .row .btn{padding:11px 14px;border-radius:14px;min-width:50px;box-shadow:none}
</style>
`;

/* ============================================================
   11) أخطاء؟
   ============================================================ */
if (fails.length) {
  console.error(' فشل التحويل:\n' + fails.map(f => '  - ' + f).join('\n'));
  process.exit(1);
}
fs.writeFileSync(OUT, html);
console.log(`✓ public/mafia.html — ${(html.length / 1024).toFixed(0)}KB (${used.length} تعديلًا)`);

/* ===== ملف الشرح: صوره تخرج للملفات (كل خلفيات الأدوار معرّفة فيه أصلاً) ===== */
let exp = fs.readFileSync(EXP_SRC, 'utf8');
exp = dumpAssets(exp, [
  'explainer-doctor.jpeg', 'explainer-joker.jpeg', 'explainer-detective.jpeg',
  'explainer-mafia.jpeg', 'explainer-elder.jpeg',
], ASSETS);
if (/base64,[A-Za-z0-9+/=]{2000,}/.test(exp)) fails.push('[شرح] بقيت صورة كبيرة داخل ملف الشرح');
fs.writeFileSync(EXP_OUT, exp);
if (fails.length) {
  console.error(' فشل التحويل:\n' + fails.map(f => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`✓ public/mafia-explainer.html — ${(exp.length / 1024).toFixed(0)}KB`);
