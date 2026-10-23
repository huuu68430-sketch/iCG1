import React, { useEffect, useMemo, useState } from 'react';
import { fetchBotrixLeaderboard } from '../utils/botrixApi';
import './ChatLegends.css';

/* ============================================================
   أساطير الشات — الترتيب بنقاط الشات الحية من Botrix
   - المصدر: https://botrix.live//api/public/leaderboard?platform=kick&user=iCG1
   - العرض: كم ساعة والنقاط فقط
   - الترتيب: بالنقاط تنازلياً
   - الصور: صور كيك الحقيقية مع fallback لأيقونة اللاعب الفخمة
   ============================================================ */

interface Legend {
  name: string;
  points: number; // النقاط
  hours: number;  // كم ساعة (watchtime / 60)
  rawWatchtime: number;
}

/* صور كيك — كاش مشترك على مستوى الموديول */
const AVATAR_CACHE = new Map<string, string>();

const KICK_USER_API = (name: string) =>
  '/api/kick?endpoint=' + encodeURIComponent(`https://kick.com/api/v1/users/${name}`);

const KICK_CHANNEL_API = (name: string) =>
  '/api/kick?endpoint=' + encodeURIComponent(`https://kick.com/api/v2/channels/${name}`);

// Format hours cleanly
const formatHours = (h: number): string => {
  if (h >= 10) return `${Math.round(h)} ساعة`;
  if (h >= 1) return `${h.toFixed(1)} ساعة`;
  return `${h.toFixed(1)} ساعة`;
};

// Format points cleanly
const formatPoints = (pts: number): string => {
  return `${pts.toLocaleString('en-US')} نقطة`;
};

// Reusable Circular Avatar with Kick Picture & Fallback User Icon
const Avatar: React.FC<{
  name: string;
  img?: string;
  size?: number;
  isFirst?: boolean;
}> = ({ name, img, size, isFirst }) => {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(img && !failed);

  return (
    <div
      className={`av ${isFirst ? 'av-first' : ''}`}
      style={
        size
          ? {
              width: `${size}px`,
              height: `${size}px`,
              minWidth: `${size}px`,
              minHeight: `${size}px`,
            }
          : undefined
      }
    >
      {showImg ? (
        <img
          src={img}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="av-fallback" title={name}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="av-fallback-svg">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </span>
      )}
    </div>
  );
};

export const ChatLegends: React.FC = () => {
  const [data, setData] = useState<Legend[] | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  /* ---------- جلب البيانات الحية من Botrix بالكامل ---------- */
  useEffect(() => {
    let dead = false;

    const loadData = async () => {
      try {
        const endpoint =
          '/api/kick?endpoint=' +
          encodeURIComponent('https://botrix.live//api/public/leaderboard?platform=kick&user=iCG1');

        let rawList: any[] = [];
        try {
          const res = await fetch(endpoint);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json) && json.length > 0) {
              rawList = json;
            }
          }
        } catch {}

        // Fallback to fetchBotrixLeaderboard if direct proxy didn't return
        if (rawList.length === 0) {
          const rows = await fetchBotrixLeaderboard(true);
          if (Array.isArray(rows) && rows.length > 0) {
            rawList = rows;
          }
        }

        if (dead) return;

        // Map and sort strictly by Points (النقاط) descending
        const mapped: Legend[] = rawList
          .filter((e) => e && (e.name || e.username))
          .map((e) => {
            const name = String(e.name || e.username).trim();
            const points = Number(e.points) || 0;
            const rawWatchtime = Number(e.watchtime) || 0;
            const hours = rawWatchtime > 0 ? rawWatchtime / 60 : 0;
            return {
              name,
              points,
              hours,
              rawWatchtime,
            };
          });

        mapped.sort((a, b) => b.points - a.points || b.rawWatchtime - a.rawWatchtime);

        setData(mapped);
      } catch {
        if (!dead) setData([]);
      }
    };

    loadData();

    return () => {
      dead = true;
    };
  }, []);

  const top = useMemo(() => (data && data.length > 0 ? data : null), [data]);

  // Max points for the percentage bar calculation
  const maxPoints = useMemo(() => {
    if (!top || top.length === 0) return 1;
    return Math.max(1, top[0].points);
  }, [top]);

  const imgOf = (name: string) =>
    avatars[name.toLowerCase()] || AVATAR_CACHE.get(name.toLowerCase()) || '';

  /* ---------- جلب صور كيك الحقيقية لجميع المستخدمين ---------- */
  useEffect(() => {
    if (!top || top.length === 0) return;
    let dead = false;

    const namesToFetch = top
      .map((e) => e.name)
      .filter((n) => !AVATAR_CACHE.has(n.toLowerCase()));

    if (namesToFetch.length === 0) {
      setAvatars(Object.fromEntries([...AVATAR_CACHE.entries()]));
      return;
    }

    (async () => {
      const out: Record<string, string> = {};

      for (let i = 0; i < namesToFetch.length; i += 5) {
        const batch = namesToFetch.slice(i, i + 5);
        const results = await Promise.all(
          batch.map(async (n) => {
            try {
              // 1. Kick v1 users API (gives profilepic for all users)
              const res = await fetch(KICK_USER_API(n));
              if (res.ok) {
                const d = await res.json();
                const pic: string = d?.profilepic || d?.profile_pic || '';
                if (pic) return { n, pic };
              }
            } catch {}

            try {
              // 2. Kick v2 channels API fallback
              const cRes = await fetch(KICK_CHANNEL_API(n));
              if (cRes.ok) {
                const cData = await cRes.json();
                const cPic: string = cData?.user?.profile_pic || '';
                if (cPic) return { n, pic: cPic };
              }
            } catch {}

            return { n, pic: '' };
          })
        );

        if (dead) return;

        results.forEach((r) => {
          if (r) {
            AVATAR_CACHE.set(r.n.toLowerCase(), r.pic);
            out[r.n.toLowerCase()] = r.pic;
          }
        });

        setAvatars((prev) => ({ ...prev, ...out }));
      }
    })();

    return () => {
      dead = true;
    };
  }, [top]);

  // Podium order: 2nd on left, 1st in center, 3rd on right
  const podiumOrder = [1, 0, 2];

  return (
    <section className="cl">
      <div className="lg">
        {/* Header */}
        <div className="hd">
          <div className="star">★</div>
          <div>
            <h2>أساطير الشات</h2>
            <div className="sub">مرتبين حسب إجمالي النقاط في الشات</div>
          </div>
          <div className="pill">
            <span className="lv">الترتيب بالنقاط</span>
            <span>{top ? `${top.length} أسطورة` : '…'}</span>
          </div>
        </div>

        {/* Podium for Top 3 */}
        {top && top.length >= 3 && (
          <div className="pod">
            {podiumOrder
              .filter((idx) => top[idx])
              .map((idx) => {
                const p = top[idx];
                const rankNum = idx + 1;
                return (
                  <div key={p.name} className={`pi p${rankNum}`}>
                    {idx === 0 && <div className="crown">👑</div>}
                    <Avatar
                      name={p.name}
                      img={imgOf(p.name)}
                      size={idx === 0 ? 88 : 68}
                      isFirst={idx === 0}
                    />
                    <b>{p.name}</b>
                    <div className="pi-points">{formatPoints(p.points)}</div>
                    <div className="pi-hours">{formatHours(p.hours)}</div>
                    <div className="base">{rankNum}</div>
                  </div>
                );
              })}
          </div>
        )}

        {/* List for Rank 4 and below */}
        {top && top.length > 3 && (
          <div className="list">
            {top.slice(3).map((p, i) => {
              const rankNum = i + 4;
              const pointsPct = maxPoints > 0 ? (p.points / maxPoints) * 100 : 0;
              return (
                <div
                  key={`${p.name}-${rankNum}`}
                  className="row"
                  style={
                    {
                      '--i': Math.min(i, 20),
                      '--w': `${Math.max(4, Number(pointsPct.toFixed(1)))}%`,
                    } as React.CSSProperties
                  }
                >
                  <span className="rk">{String(rankNum).padStart(2, '0')}</span>
                  <Avatar name={p.name} img={imgOf(p.name)} />
                  <div className="nm">
                    <b>{p.name}</b>
                    <small>
                      {formatHours(p.hours)} · {formatPoints(p.points)}
                    </small>
                  </div>
                  <div className="st">
                    <span className="h">{formatPoints(p.points)}</span>
                    <span>{formatHours(p.hours)}</span>
                  </div>
                  <div className="bar">
                    <i />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default ChatLegends;
