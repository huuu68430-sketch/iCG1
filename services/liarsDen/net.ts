/**
 * iCG1 — حانة الكذابين: طبقة Realtime Broadcast.
 * قناة عامة للغرفة + قناة خاصة لكل مقعد. لا postgres_changes ولا polling.
 * الملعب كله داخل القنوات؛ الجداول للهوية والحجز والنتيجة فقط.
 */
import { supabase } from '../supabase';
import { pubChannel, seatChannel } from './protocol';

type Handler = (msg: any) => void;

interface Sub {
  key: string;
  ch: any;
  ready: Promise<void>;
}

const waitSubscribed = (ch: any) =>
  new Promise<void>(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') finish();
    });
    setTimeout(finish, 4000);
  });

export class LiarsNet {
  private subs = new Map<string, Sub>();
  private closed = false;

  private open(key: string, name: string, handler: Handler): Promise<void> {
    const existing = this.subs.get(key);
    if (existing) return existing.ready;
    if (this.closed) return Promise.resolve();
    const ch = supabase.channel(name, { config: { broadcast: { self: true } } });
    ch.on('broadcast', { event: 'm' }, (payload: any) => {
      if (!this.closed && payload?.payload) handler(payload.payload);
    });
    const sub: Sub = { key, ch, ready: Promise.resolve() };
    this.subs.set(key, sub);
    sub.ready = waitSubscribed(ch);
    return sub.ready;
  }

  joinPub(code: string, onMessage: Handler, onPing?: Handler) {
    return this.open(`pub:${code}`, pubChannel(code), msg => {
      if (msg?.type === 'seats_ping') onPing?.(msg);
      else onMessage(msg);
    });
  }

  async joinSeat(code: string, seat: number, topic: string, onMessage: Handler) {
    if (!topic) return;
    await this.open(`seat:${seat}:${topic}`, seatChannel(code, topic), onMessage);
  }

  leaveSeat(seat: number) {
    for (const [key, sub] of this.subs) {
      if (key.startsWith(`seat:${seat}:`)) {
        this.subs.delete(key);
        supabase.removeChannel(sub.ch);
      }
    }
  }

  async publishPub(msg: any) {
    for (const sub of this.subs.values()) {
      if (sub.key.startsWith('pub:')) {
        await sub.ready;
        try { await sub.ch.send({ type: 'broadcast', event: 'm', payload: msg }); } catch { /* القناة تغلق */ }
        return;
      }
    }
  }

  async publishSeat(seat: number, msg: any) {
    for (const sub of this.subs.values()) {
      if (sub.key.startsWith(`seat:${seat}:`)) {
        await sub.ready;
        try { await sub.ch.send({ type: 'broadcast', event: 'm', payload: msg }); } catch { /* القناة تغلق */ }
        return;
      }
    }
  }

  close() {
    this.closed = true;
    for (const sub of this.subs.values()) supabase.removeChannel(sub.ch);
    this.subs.clear();
  }
}
