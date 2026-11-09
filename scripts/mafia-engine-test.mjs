// اختبار منطق محرّك المافيا: محاكاة مباريات كاملة والتأكد من نهايتها بشكل صحيح
import {
  createRoomState, dealRoles, nextPhase, plan, resetToLobby, voteCounts, aliveSeats,
} from '../.tmp-mafia-engine.mjs';

const mkSeats = (n) => Array.from({ length: n }, (_, i) => ({
  id: `u${i}`, name: `لاعب${i}`, handle: `u${i}`, avatar: null,
  alive: true, ready: false, muted: false, joinedAt: Date.now() + i,
}));

const rnd = (n) => Math.floor(Math.random() * n);
let fails = 0;

for (const n of [5, 6, 7, 8, 10, 12]) {
  for (let run = 0; run < 40; run++) {
    let s = createRoomState();
    s.P = mkSeats(n);
    const dealt = dealRoles(s);
    if (dealt.err) { console.log('deal error', n, dealt.err); fails++; continue; }
    s = dealt.state;
    const roles = dealt.roles;

    const mafiaIds = Object.entries(roles).filter(([, r]) => r === 'mafia').map(([id]) => id);
    if (mafiaIds.length !== plan(s).m) { console.log('mafia count mismatch'); fails++; }
    if (Object.keys(roles).length !== n) { console.log('role count mismatch'); fails++; }

    let guard = 0;
    while (s.ph !== 'end' && guard++ < 400) {
      if (s.ph === 'deal' || s.ph === 'reveal') { s = nextPhase(s, roles); continue; }
      if (s.ph === 'night') {
        if (s.st === 'mafia') {
          const targets = aliveSeats(s).filter(p => roles[p.id] !== 'mafia');
          if (targets.length) mafiaIds.forEach(id => { s.nt.mv[id] = targets[rnd(targets.length)].id; });
        }
        if (s.st === 'doctor') {
          const a = aliveSeats(s);
          if (a.length) s.nt.protect = a[rnd(a.length)].id;
        }
        if (s.st === 'elder') {
          const a = aliveSeats(s).filter(p => roles[p.id] !== 'elder');
          if (a.length) s.nt.silence = a[rnd(a.length)].id;
        }
        s = nextPhase(s, roles);
        continue;
      }
      if (s.ph === 'day') {
        if (s.st === 'vote') {
          const a = aliveSeats(s);
          a.forEach(p => {
            const others = a.filter(x => x.id !== p.id);
            s.votes[p.id] = others.length ? others[rnd(others.length)].id : 'skip';
          });
        }
        s = nextPhase(s, roles);
        continue;
      }
      break;
    }

    if (s.ph !== 'end' || !s.win) {
      console.log('game did not end', n, s.ph, s.st);
      fails++;
      continue;
    }

    const mafiaLeft = aliveSeats(s).filter(p => roles[p.id] === 'mafia').length;
    const othersLeft = aliveSeats(s).length - mafiaLeft;
    if (s.win === 'town' && mafiaLeft !== 0) { console.log('town won with mafia alive'); fails++; }
    if (s.win === 'mafia' && mafiaLeft < othersLeft) { console.log('mafia won without majority'); fails++; }
    if (s.win === 'mafia' && mafiaLeft === 0) { console.log('mafia won with zero mafia'); fails++; }
    if (voteCounts(s) && typeof voteCounts(s) !== 'object') { fails++; }

    // إعادة اللوبي
    const fresh = resetToLobby(s);
    if (fresh.ph !== 'join' || fresh.P.some(p => !p.alive)) { console.log('reset failed'); fails++; }
  }
}

console.log(fails === 0 ? '✅ OK — كل المباريات انتهت بشكل صحيح' : `❌ فشل ${fails}`);
process.exit(fails === 0 ? 0 : 1);
