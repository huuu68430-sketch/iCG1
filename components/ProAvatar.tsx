import React, { useState, useEffect } from 'react';
import { User, Loader2 } from 'lucide-react';
import { getFrameUrl, isExpiredSignedUrl } from '../utils/assets';
import { chatService } from '../services/chatService';
import { supabase } from '../services/supabase';
import { FrameArt } from './FrameArt';
import { isFrameId } from '../data/frames';

interface ProAvatarProps {
    url?: string;
    username: string;
    frameUrl?: string;
    /** إطار جديد (من جدول frames) — يتقدّم على frameUrl القديم */
    frameId?: string | null;
    size?: string;
    className?: string;
    forceRefresh?: number; // Optional trigger to refresh
}

const frameCache: Record<string, string | null> = {};
const frameIdCache: Record<string, string | null> = {};
const avatarCache: Record<string, string | null> = {};

type FramePayload = { new?: any; old?: any };

/* قناة Realtime واحدة لكل الأفاتارات على الشاشة: كل أفاتار كان يفتح قناته الخاصة
   ويستقبل نفس حدث تحديث profiles — نفس النتيجة بتكلفة قناة واحدة. */
const frameWatchers = new Map<string, Set<(p: FramePayload) => void>>();
let frameChannel: any = null;

const ensureFrameChannel = () => {
    if (frameChannel) return;
    try {
        frameChannel = supabase
            .channel('profiles_frames_shared')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: FramePayload) => {
                const key = String(payload?.new?.username || payload?.old?.username || '').toLowerCase();
                frameWatchers.get(key)?.forEach(fn => { try { fn(payload); } catch (e) { } });
            })
            .subscribe();
    } catch (e) {
        console.warn('[ProAvatar] Frame realtime unavailable:', e);
        frameChannel = null;
    }
};

const addFrameWatcher = (user: string, fn: (p: FramePayload) => void) => {
    let set = frameWatchers.get(user);
    if (!set) { set = new Set(); frameWatchers.set(user, set); }
    set.add(fn);
    ensureFrameChannel();
    return () => { set?.delete(fn); };
};

type FrameRow = { url: string | null; id: string | null };
const framePending = new Map<string, Promise<FrameRow>>();

/* قراءة إطار العضو كانت تُكرَّر لكل أفاتار ظاهر في نفس اللحظة (لوحة الصدارة = عشرات الطلبات
   لنفس الاسم). الآن طلب واحد مشترك لكل اسم، والباقي ينتظر نتيجته. */
const loadFrameFor = (user: string): Promise<FrameRow> => {
    const running = framePending.get(user);
    if (running) return running;
    const task = (async (): Promise<FrameRow> => {
        let rows: any[] | null = null;
        const withId = await supabase
            .from('profiles')
            .select('active_frame_url, active_frame_id')
            .ilike('username', user)
            .limit(1);

        if (withId.error) {
            // الجدول لم يُحدَّث بعد (SQL الإطارات لم يُنفَّذ) — رجع للإطار القديم بأمان
            const legacy = await supabase
                .from('profiles')
                .select('active_frame_url')
                .ilike('username', user)
                .limit(1);
            rows = legacy.data;
        } else {
            rows = withId.data;
        }

        const data: any = rows?.[0];
        const url = data?.active_frame_url || null;
        const rawId = data?.active_frame_id || null;
        let id = rawId && isFrameId(rawId) ? rawId : null;

        // الإطار المجهّز يُشترى في جدول user_frames، وقد لا يكون مُزامناً مع profiles
        if (!id && !url) {
            const owned = await supabase
                .from('user_frames')
                .select('frame_id')
                .eq('is_equipped', true)
                .ilike('username', user)
                .limit(1);
            const ownedId = owned.data?.[0]?.frame_id || null;
            if (ownedId && isFrameId(ownedId)) id = ownedId;
        }
        return { url, id };
    })().finally(() => { framePending.delete(user); });
    framePending.set(user, task);
    return task;
};

export const ProAvatar: React.FC<ProAvatarProps> = ({
    url,
    username,
    frameUrl: initialFrameUrl,
    frameId: initialFrameId,
    size = "w-14 h-14",
    className = "",
    forceRefresh = 0
}) => {
    const [src, setSrc] = useState<string | undefined>(url || undefined);
    const [frameUrl, setFrameUrl] = useState<string | undefined>(initialFrameUrl);
    const [frameId, setFrameId] = useState<string | undefined>(
        initialFrameId && isFrameId(initialFrameId) ? initialFrameId : undefined
    );
    const [isRefreshing, setIsRefreshing] = useState(false);

    const uLower = (username || '').toLowerCase().trim().replace('@', '');

    // 1. Avatar Resolution
    useEffect(() => {
        const fetchAvatar = async () => {
            if (!uLower) return;

            // Direct Prop - check if it looks like a stale Kick URL
            if (url && url.length > 5) {
                const isStaleKick = url.includes('kick.com/api/') || (url.includes('kick.com/storage') && !url.includes('files.kick.com')) || isExpiredSignedUrl(url);
                if (!isStaleKick) {
                    setSrc(url);
                    return;
                }
                // If it's a stale Kick URL, we continue to check cache then database then fetch
            }

            // Memory Cache
            if (avatarCache[uLower] && !isExpiredSignedUrl(avatarCache[uLower])) {
                setSrc(avatarCache[uLower]!);
                return;
            }

            // LocalStorage Cache
            const stored = localStorage.getItem(`av_${uLower}`);
            if (stored && stored.length > 5 && !isExpiredSignedUrl(stored)) {
                setSrc(stored);
                avatarCache[uLower] = stored;
                return;
            }

            // Database
            try {
                const { data: rows } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .ilike('username', uLower)
                    .limit(1);

                const data = rows?.[0];
                if (data?.avatar_url && !isExpiredSignedUrl(data.avatar_url)) {
                    setSrc(data.avatar_url);
                    localStorage.setItem(`av_${uLower}`, data.avatar_url);
                    avatarCache[uLower] = data.avatar_url;
                    return;
                }
            } catch (e) { }

            // Kick Fetch
            const live = await chatService.fetchKickAvatar(uLower);
            if (live) {
                setSrc(live);
                localStorage.setItem(`av_${uLower}`, live);
                avatarCache[uLower] = live;
            }
        };

        fetchAvatar();
    }, [url, uLower, forceRefresh]);

    // 2. Frame Resolution (legacy image + new SVG frame id)
    useEffect(() => {
        if (!uLower) return;

        // A frame id passed explicitly is authoritative (no DB round-trip).
        if (initialFrameId !== undefined) {
            setFrameId(initialFrameId && isFrameId(initialFrameId) ? initialFrameId : undefined);
            return;
        }

        // Seed instantly from caches so the frame does not flash.
        if (frameIdCache[uLower] !== undefined) {
            setFrameId(frameIdCache[uLower] || undefined);
        } else {
            const storedId = localStorage.getItem(`frameid_${uLower}`);
            if (storedId !== null) {
                const val = storedId === 'none' ? null : storedId;
                setFrameId(val || undefined);
                frameIdCache[uLower] = val;
            } else {
                setFrameId(undefined);
            }
        }
        if (initialFrameUrl !== undefined) {
            setFrameUrl(initialFrameUrl);
            if (initialFrameUrl) frameCache[uLower] = initialFrameUrl;
        } else if (frameCache[uLower] !== undefined) {
            setFrameUrl(frameCache[uLower] || undefined);
        } else {
            const stored = localStorage.getItem(`frame_${uLower}`);
            if (stored) {
                const val = stored === 'none' ? undefined : stored;
                setFrameUrl(val);
                frameCache[uLower] = val || null;
            }
        }

        const syncFrame = async () => {
            try {
                const { url: freshUrl, id: freshId } = await loadFrameFor(uLower);

                if (frameIdCache[uLower] !== freshId) {
                    frameIdCache[uLower] = freshId;
                    setFrameId(freshId || undefined);
                    localStorage.setItem(`frameid_${uLower}`, freshId || 'none');
                }
                if (frameCache[uLower] !== freshUrl) {
                    frameCache[uLower] = freshUrl;
                    setFrameUrl(freshUrl || undefined);
                    localStorage.setItem(`frame_${uLower}`, freshUrl || 'none');
                }
            } catch (e) { }
        };

        syncFrame();

        // تحديث فوري عند تغيير الإطار — عبر القناة المشتركة (بلا قناة لكل أفاتار)
        const unsubscribe = addFrameWatcher(uLower, (payload) => {
            const nextUrl = payload.new?.active_frame_url || null;
            const rawId = payload.new?.active_frame_id || null;
            const nextId = rawId && isFrameId(rawId) ? rawId : null;
            if (frameIdCache[uLower] !== nextId) {
                frameIdCache[uLower] = nextId;
                setFrameId(nextId || undefined);
                localStorage.setItem(`frameid_${uLower}`, nextId || 'none');
            }
            if (frameCache[uLower] !== nextUrl) {
                frameCache[uLower] = nextUrl;
                setFrameUrl(nextUrl || undefined);
                localStorage.setItem(`frame_${uLower}`, nextUrl || 'none');
            }
        });

        return unsubscribe;
    }, [initialFrameUrl, initialFrameId, uLower, forceRefresh]);

    const handleAvatarError = async () => {
        if (isRefreshing || !uLower) return;
        setIsRefreshing(true);
        console.warn(`[ProAvatar] Avatar load error for ${uLower}, attempting recovery...`);
        try {
            // First check if we have a cached alternative that isn't the current one
            const stored = localStorage.getItem(`av_${uLower}`);
            if (stored && stored !== src && !isExpiredSignedUrl(stored)) {
                setSrc(stored);
                setIsRefreshing(false);
                return;
            }

            const fresh = await chatService.fetchKickAvatar(uLower);
            if (fresh) {
                console.log(`[ProAvatar] Successfully recovered avatar for ${uLower}: ${fresh}`);
                setSrc(fresh);
                localStorage.setItem(`av_${uLower}`, fresh);
                avatarCache[uLower] = fresh;
                // Try to update DB, but don't fail if permissions are missing
                try {
                    await supabase.from('profiles').update({ avatar_url: fresh }).ilike('username', uLower);
                } catch (dbErr) {
                    console.warn(`[ProAvatar] Could not persist new avatar to DB (probably permissions): ${dbErr}`);
                }
            } else {
                setSrc(undefined); // Clear to show fallback
            }
        } catch (e) {
            console.error(`[ProAvatar] Recovery failed for ${uLower}:`, e);
            setSrc(undefined);
        } finally {
            setIsRefreshing(false);
        }
    };

    const hasNewFrame = !!frameId && isFrameId(frameId);
    const boxPx = (() => {
        const match = /(^|\s)w-(\d+)/.exec(size || '');
        return (match ? Number(match[2]) : 14) * 4;
    })();

    return (
        <div
            className={`relative ${size} flex-shrink-0 flex items-center justify-center ${className}`}
            style={{ overflow: 'visible', zIndex: 10 }}
        >
            {hasNewFrame ? (
                /* الإطار الجديد: الخلفية الزرقاء + صورة العضو + زخارف الإطار */
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <FrameArt
                        frameId={frameId}
                        src={src}
                        initial={uLower.slice(0, 3)}
                        title={username}
                        className="w-[160%] h-[160%] max-w-none"
                        style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.55))' }}
                        onAvatarError={handleAvatarError}
                    />
                </div>
            ) : (
                <>
                    {/* Avatar Base */}
                    <div className="w-[84%] h-[84%] rounded-full overflow-hidden border-2 border-white/10 bg-zinc-950 shadow-inner relative z-0 flex-shrink-0">
                        {src ? (
                            <img
                                src={src}
                                className="w-full h-full object-cover"
                                onError={handleAvatarError}
                                alt=""
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center font-black text-white/10 uppercase select-none bg-white/5">
                                <User size={Math.max(12, Math.round(boxPx * 0.5))} className="opacity-25" />
                            </div>
                        )}
                        {isRefreshing && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                <Loader2 className="animate-spin text-white w-4 h-4" />
                            </div>
                        )}
                    </div>

                    {/* Frame Layer (legacy PNG frames) */}
                    {frameUrl && (
                        <div
                            className="absolute inset-0 pointer-events-none flex items-center justify-center z-[100]"
                        >
                            <img
                                src={getFrameUrl(frameUrl)}
                                className="w-[125%] h-[125%] max-w-none object-contain filter drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]"
                                alt="Frame"
                                onError={() => {
                                    console.warn("Frame failed:", frameUrl);
                                    setFrameUrl(undefined);
                                }}
                                style={{ transform: 'scale(1.15)' }}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
