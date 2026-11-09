import { chatService } from './chatService';
import { adminApi } from './adminCenter';

export interface WatchedCode {
    code: string;
    active: boolean;
}

/**
 * كودات الدردشة تكتبها الجماهير كلها — لذلك المطابقة تتم محلياً على قائمة
 * الأكواد النشطة، ولا يُرسَل للسيرفر إلا كود مطابق فعلاً.
 */
const normalize = (text: string) => text.trim().replace(/^!/, '').toUpperCase();

export const startPromoWatcher = (
    getCodes: () => WatchedCode[],
    onClaimed: (message: string, bad?: boolean) => void,
): (() => void) => {
    chatService.connect('icg1');
    let queued = Promise.resolve();

    const unbind = chatService.onMessage((msg) => {
        const raw = normalize(String(msg.content || ''));
        if (raw.length < 3) return;
        const matched = getCodes().find(c => c.active && normalize(c.code) === raw);
        if (!matched) return;
        const username = String(msg.user?.username || '').trim();
        if (!username) return;
        // رسالة واحدة لكل لاعب ضمن نفس الكود — حتى لا تتضاعف المكافأة مع تكرار الكتابة
        queued = queued.then(async () => {
            const r = await adminApi.run('promo.claimChat', { username, code: matched.code });
            if (r.ok) {
                const amount = Number(r.data?.amount || 0);
                onClaimed(`✅ ${username} استخدم «${matched.code}» وحصل ${amount.toLocaleString('en-US')} نقطة`);
            } else if (r.error && !/استخدم|سبق|موقوف|منتهي/i.test(r.error)) {
                onClaimed(`⚠️ ${matched.code}: ${r.error}`, true);
            }
        });
    });

    return () => { unbind(); };
};
