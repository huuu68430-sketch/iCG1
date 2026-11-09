
import Pusher from 'pusher-js';
import { ChatMessage } from '../types';
import { isExpiredSignedUrl } from '../utils/assets';
import { supabase } from './supabase';

type MessageCallback = (message: ChatMessage) => void;
type StatusCallback = (isConnected: boolean, error?: boolean, details?: string) => void;

/**
 * صورة الحساب الحالي تُحفظ في صفّه وفي نسخته المحلية.
 * روابط صور كيك موقّعة وتنتهي بعد دقائق، فتحديثها عند كل جلب يبقيها ظاهرة
 * في صفحات الموقع وعلى شاشة اللعبة بدون أيقونة مكسورة.
 */
const persistMemberAvatar = async (slug: string, url: string) => {
  if (!url || !/^https:\/\//.test(url) || isExpiredSignedUrl(url)) return;
  let raw: any = null;
  try { raw = JSON.parse(localStorage.getItem('iabs_user') || 'null'); } catch { return; }
  const mine = String(raw?.kick_username || raw?.id || '').toLowerCase().trim().replace(/^@+/, '');
  if (!mine || mine === 'guest' || mine !== slug) return;
  try { localStorage.setItem('iabs_user', JSON.stringify({ ...raw, avatar: url })); } catch { /* التخزين ممتلئ */ }
  try { await supabase.from('users').update({ avatar: url }).eq('kick_username', slug); } catch { /* الصلاحيات تمنع */ }
  try { await supabase.from('profiles').update({ avatar_url: url }).eq('username', slug); } catch { /* الصلاحيات تمنع */ }
};

const getRoleFromIdentity = (identity: any): ChatMessage['role'] => {
  if (!identity || !identity.badges) return 'user';
  const badges = identity.badges;
  if (badges.some((b: any) => b.type === 'broadcaster')) return 'owner';
  if (badges.some((b: any) => b.type === 'moderator')) return 'moderator';
  if (badges.some((b: any) => b.type === 'founder')) return 'founder';
  if (badges.some((b: any) => b.type === 'vip')) return 'vip';
  if (badges.some((b: any) => b.type === 'sub_gifter')) return 'gifter';
  if (badges.some((b: any) => b.type === 'subscriber')) return 'subscriber';
  return 'user';
};

const mapBadges = (identity: any): ChatMessage['badges'] => {
  if (!identity || !Array.isArray(identity.badges)) return [];
  return identity.badges
    .map((b: any) => ({ type: b.type, text: b.text }))
    .filter((b: any) => typeof b.type === 'string' && b.type.length > 0);
};

class ChatService {
  private isConnected: boolean = false;
  private listeners: MessageCallback[] = [];
  private deleteListeners: ((id: string) => void)[] = [];
  private statusListeners: StatusCallback[] = [];
  private pusher: any = null;
  private channel: any = null;
  private avatarCache: Record<string, string> = {};
  private pendingAvatarFetches: Record<string, Promise<string>> = {};
  private currentChatroomId: number | null = null;
  private currentChannelSlug: string | null = null;

  // آخر الرسائل محفوظة مؤقتاً: الصفحة اللي تشتغل بعد لحظة اتصال تفحصها بدل ما
  // تنتظر رسالة جديدة — كود التحقق مثلاً يُرسل أثناء ما المستخدم في تبويب آخر.
  private recent: ChatMessage[] = [];
  private static readonly RECENT_CAP = 120;

  // Kick Bot Tokens
  private KICK_BOT_ACCESS_TOKEN = "MTU4YJK4N2UTMDE1YI0ZYZY2LTHHYJYTNDQ2YJJMMWMZNJZH";
  private KICK_BOT_REFRESH_TOKEN = "MDY0MJQ4MZCTZJE3OS01OTQWLWFMZTATZMU5YJNHMGE4NZC1";

  private KNOWN_CHATROOM_IDS: Record<string, number> = {
    'icg1': 5589246,
  };

  // Kick rotates its Pusher app key. These are the last known values and are
  // refreshed at runtime from Kick's realtime endpoint whenever possible.
  private static readonly PUSHER_FALLBACK = { key: '34bf7a0ff419a2a775b9', cluster: 'us2' };
  private pusherCredentials: { key: string; cluster: string } | null = null;

  // Auto-reconnect state
  private connectionId = 0;
  private isConnecting = false;
  private shouldAutoReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 9999;
  private reconnectBaseDelay = 1500;
  private reconnectTimer: any = null;
  private healthCheckTimer: any = null;
  private connectionTimeoutTimer: any = null;
  private lastMessageTime: number = 0;

  async getChatroomId(channelSlug: string): Promise<number | null> {
    const slug = channelSlug.toLowerCase().trim();

    if (this.KNOWN_CHATROOM_IDS[slug]) {
      return this.KNOWN_CHATROOM_IDS[slug];
    }

    // Primary source: Kick web API directly. It allows cross-origin reads,
    // so this works from the browser without any proxy.
    const directId = await this.fetchChatroomIdFromKick(slug);
    if (directId) {
      try { localStorage.setItem(`kick_chatroom_id_${slug}`, directId.toString()); } catch (e) {}
      return directId;
    }

    const cachedId = localStorage.getItem(`kick_chatroom_id_${slug}`);
    if (cachedId) {
      const parsed = parseInt(cachedId, 10);
      if (!isNaN(parsed) && parsed > 0) {
        console.log(`[ChatService] Using cached ID for ${slug}: ${parsed}`);
        return parsed;
      }
    }

    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://kick.com/api/v2/channels/${slug}`)}`,
      `https://corsproxy.io/?${encodeURIComponent(`https://kick.com/api/v2/channels/${slug}`)}`,
      `https://api.codetabs.com/v1/proxy/quest=${encodeURIComponent(`https://kick.com/api/v2/channels/${slug}`)}`
    ];

    const results = await Promise.allSettled(
      proxies.map(url => this.fetchWithTimeout(url, 5000))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value.ok) {
        try {
          const rawData = await result.value.json();
          const data = this.parseProxyResponse(proxies[i], rawData);
          const foundId = data?.chatroom?.id || data?.id;

          if (foundId) {
            console.log(`[ChatService] ✅ Found ID: ${foundId} via proxy`);
            localStorage.setItem(`kick_chatroom_id_${slug}`, foundId.toString());
            return foundId;
          }
        } catch (e) {
          console.warn(`[ChatService] Parse error for proxy ${i}`);
        }
      }
    }

    return null;
  }

  private async fetchChatroomIdFromKick(slug: string): Promise<number | null> {
    const targets = [
      { url: `https://kick.com/api/v2/channels/${slug}/chatroom`, fromChatroomEndpoint: true },
      { url: `https://kick.com/api/v2/channels/${slug}`, fromChatroomEndpoint: false }
    ];

    for (const target of targets) {
      try {
        const response = await this.fetchWithTimeout(target.url, 6000);
        if (!response.ok) continue;
        const data: any = await response.json();
        const id = data?.chatroom?.id || (target.fromChatroomEndpoint ? data?.id : null);
        if (id && !isNaN(parseInt(String(id), 10))) {
          console.log(`[ChatService] ✅ Chatroom ID for ${slug}: ${id}`);
          return parseInt(String(id), 10);
        }
      } catch (e) {
        console.warn(`[ChatService] Direct Kick lookup failed for ${slug}`);
      }
    }

    return null;
  }

  private async getPusherCredentials(): Promise<{ key: string; cluster: string }> {
    if (this.pusherCredentials) return this.pusherCredentials;

    const cacheKey = 'kick_pusher_credentials';
    const maxAge = 6 * 60 * 60 * 1000;

    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.key && parsed?.cluster && Date.now() - (parsed.ts || 0) < maxAge) {
          this.pusherCredentials = { key: parsed.key, cluster: parsed.cluster };
          return this.pusherCredentials;
        }
      }
    } catch (e) {}

    // Ask Kick for the current realtime credentials (works when the request is
    // same-origin or CORS is reachable, e.g. through a dev proxy).
    try {
      const clientId = this.generateUuid();
      const response = await this.fetchWithTimeout(
        'https://web.kick.com/api/v1/realtime/connection',
        6000,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'x-app-platform': 'web' },
          body: JSON.stringify({
            client: { id: clientId, type: 'web' },
            capabilities: { accepted_providers: [{ provider: 'pusher' }] }
          })
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const creds = data?.data?.connections?.find((c: any) => c.provider === 'pusher')?.credentials;
        if (creds?.app_key && creds?.cluster) {
          this.pusherCredentials = { key: creds.app_key, cluster: creds.cluster };
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ ...this.pusherCredentials, ts: Date.now() }));
          } catch (e) {}
          console.log(`[ChatService] Pusher credentials refreshed from Kick (cluster ${creds.cluster})`);
          return this.pusherCredentials;
        }
      }
    } catch (e) {
      console.warn('[ChatService] Could not refresh Pusher credentials, using cached fallback');
    }

    this.pusherCredentials = { ...ChatService.PUSHER_FALLBACK };
    return this.pusherCredentials;
  }

  private generateUuid(): string {
    try {
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
        return (crypto as any).randomUUID();
      }
    } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private async fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          ...(init?.headers as any || {})
        }
      });
      return response;
    } catch (e) {
      return new Response(null, { status: 0, statusText: 'timeout_or_error' });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseProxyResponse(proxyUrl: string, rawData: any): any {
    if (proxyUrl.includes('allorigins')) {
      try { return JSON.parse(rawData.contents || '{}'); } catch (e) { return rawData; }
    }
    if (proxyUrl.includes('thingproxy')) {
      return rawData;
    }
    return rawData;
  }

  async connect(_channelSlug: string = 'icg1'): Promise<void> {
    // القناة الوحيدة المسموحة هي iCG1 — أي طلب لقناة ثانية يُوجَّه إليها
    const slug = 'icg1';
    
    // If stuck in connecting state for too long, force reset
    if (this.isConnecting) {
      console.log('[ChatService] Connection already in progress, force resetting...');
      this.isConnecting = false;
    }

    if (this.isConnected && this.currentChannelSlug === slug && this.pusher) {
      const state = this.pusher.connection?.state;
      if (state === 'connected') {
        console.log('[ChatService] Already connected to', slug);
        return;
      }
      // Pusher says not connected but we think we are - force reconnect
      console.log('[ChatService] Pusher state mismatch:', state, '- force reconnecting...');
      this.isConnected = false;
    }

    this.isConnecting = true;
    this.currentChannelSlug = slug;
    this.shouldAutoReconnect = true;
    const myConnectionId = ++this.connectionId;

    // Safety timeout: if connection doesn't complete in 15 seconds, reset isConnecting
    if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer);
    this.connectionTimeoutTimer = setTimeout(() => {
      if (this.isConnecting && myConnectionId === this.connectionId) {
        console.warn('[ChatService] Connection timeout - resetting state');
        this.isConnecting = false;
        if (this.shouldAutoReconnect) {
          this.scheduleReconnect(slug);
        }
      }
    }, 15000);

    this.notifyStatus(false, false, `جاري الاتصال بـ ${slug}...`);

    try {
      let chatroomId = await this.getChatroomId(slug);
      if (myConnectionId !== this.connectionId) return;

      if (!chatroomId) {
        throw new Error(`لم يتم العثور على القناة: ${slug}`);
      }

      this.currentChatroomId = chatroomId;
      console.log(`[ChatService] Connecting to Chatroom: ${chatroomId}`);

      this.cleanupPusher();

      const credentials = await this.getPusherCredentials();
      if (myConnectionId !== this.connectionId) return;
      console.log(`[ChatService] Using Pusher key ${credentials.key} (cluster ${credentials.cluster})`);

      const PusherClient = (Pusher as any).default || Pusher;
      this.pusher = new PusherClient(credentials.key, {
        cluster: credentials.cluster,
        forceTLS: true,
        enabledTransports: ['ws', 'wss'],
        statsTimeout: 0,
        pongTimeout: 30000,
        wsTimeout: 30000,
        maxRetries: 9999,
        loopBackTimer: 2000,
        disabledTransports: ['xhr_polling', 'xhr_streaming']
      });

      this.channel = this.pusher.subscribe(`chatrooms.${chatroomId}.v2`);

      this.channel.bind('App\\Events\\ChatMessageEvent', (data: any) => {
        this.lastMessageTime = Date.now();
        const role = getRoleFromIdentity(data.sender?.identity);
        const badges = mapBadges(data.sender?.identity);
        const message: ChatMessage = {
          id: data.id || Math.random().toString(36).substr(2, 9),
          user: {
            id: data.sender?.id || '0',
            username: data.sender?.username || 'Unknown',
            color: data.sender?.identity?.color || '#31d6d6',
            avatar: this.pickAvatarFromKickData(data.sender) || '',
            role,
            badges
          },
          content: data.content || '',
          role,
          badges,
          timestamp: Date.now()
        };

        this.recent.push(message);
        if (this.recent.length > ChatService.RECENT_CAP) this.recent.splice(0, this.recent.length - ChatService.RECENT_CAP);

        this.listeners.forEach(cb => {
          try {
            cb(message);
          } catch (e) {
            console.error("[ChatService] Listener error:", e);
          }
        });
      });

      this.channel.bind('App\\Events\\MessageDeletedEvent', (data: any) => {
        const messageId = data.message?.id;
        if (messageId) {
          this.deleteListeners.forEach(cb => cb(messageId));
        }
      });

      this.pusher.connection.bind('connected', () => {
        if (myConnectionId !== this.connectionId) return;
        console.log("[ChatService] WebSocket Connected!");
        if (this.connectionTimeoutTimer) { clearTimeout(this.connectionTimeoutTimer); this.connectionTimeoutTimer = null; }
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifyStatus(true, false, `متصل (ID: ${chatroomId})`);
        this.startHealthCheck(slug);
      });

      this.pusher.connection.bind('error', (err: any) => {
        if (myConnectionId !== this.connectionId) return;
        console.error("[ChatService] Pusher Error:", err);
        const code = err?.error?.data?.code;
        if (code === 4001 || code === 4000) {
          console.warn('[ChatService] Pusher credentials rejected - clearing cache for refresh');
          this.pusherCredentials = null;
          try { localStorage.removeItem('kick_pusher_credentials'); } catch (e) {}
        }
        if (this.connectionTimeoutTimer) { clearTimeout(this.connectionTimeoutTimer); this.connectionTimeoutTimer = null; }
        this.isConnected = false;
        this.isConnecting = false;
        this.notifyStatus(false, false, "جاري إعادة الاتصال...");
        
        if (this.shouldAutoReconnect) {
          this.scheduleReconnect(slug);
        }
      });

      this.pusher.connection.bind('disconnected', () => {
        if (myConnectionId !== this.connectionId) return;
        console.log("[ChatService] Pusher Disconnected");
        this.isConnected = false;
        this.isConnecting = false;
        this.notifyStatus(false, true, "انقطع الاتصال - جاري إعادة الاتصال...");
        
        if (this.shouldAutoReconnect) {
          this.scheduleReconnect(slug);
        }
      });

      this.pusher.connection.bind('state_change', (states: any) => {
        if (myConnectionId !== this.connectionId) return;
        console.log("[ChatService] Connection State:", states.current);
        
        if (states.current === 'disconnected' || states.current === 'failed') {
          this.isConnected = false;
          this.notifyStatus(false, false, "جاري إعادة الاتصال...");
          if (this.shouldAutoReconnect) {
            this.scheduleReconnect(slug);
          }
        }
      });

    } catch (error: any) {
      if (myConnectionId !== this.connectionId) return;
      console.error("[ChatService] Connection Error:", error);
      if (this.connectionTimeoutTimer) { clearTimeout(this.connectionTimeoutTimer); this.connectionTimeoutTimer = null; }
      this.isConnected = false;
      this.isConnecting = false;
      this.notifyStatus(false, false, "جاري إعادة الاتصال...");
      
      if (this.shouldAutoReconnect) {
        this.scheduleReconnect(slug);
      }
    }
  }

  private scheduleReconnect(slug: string) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectBaseDelay * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 6)), 15000);
    
    console.log(`[ChatService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.notifyStatus(false, false, `إعادة الاتصال... (${Math.ceil(delay / 1000)}ث)`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(slug);
    }, delay);
  }

  private startHealthCheck(slug: string) {
    this.stopHealthCheck();
    this.lastMessageTime = Date.now();
    this.healthCheckTimer = setInterval(() => {
      if (!this.pusher || !this.isConnected) return;
      
      const state = this.pusher.connection?.state;
      if (state !== 'connected') {
        console.warn(`[ChatService] Health check: state is ${state}, reconnecting...`);
        this.isConnected = false;
        this.notifyStatus(false, false, "جاري إعادة الاتصال...");
        this.cleanupPusher();
        this.connect(slug);
      }
    }, 10000);
  }

  private stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private cleanupPusher() {
    this.stopHealthCheck();
    if (this.channel) {
      try { this.channel.unbind_all(); } catch (e) {}
      try { this.channel.unsubscribe(); } catch (e) {}
      this.channel = null;
    }
    if (this.pusher) {
      try { this.pusher.unbind_all(); } catch (e) {}
      try { this.pusher.disconnect(); } catch (e) {}
      this.pusher = null;
    }
  }

  onMessage(callback: MessageCallback) {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter(cb => cb !== callback); };
  }

  /**
   * آخر ما التقطه الاتصال — للاستخدام المقصود فقط (مطابقة كود التحقق).
   * الألعاب ما تقرأ من هنا: تمرير الرسائل القديمة لمستمع جديد كان بيحقن
   * أوامر تصويت قديمة في نص الجولة.
   */
  getRecentMessages(): ChatMessage[] {
    return [...this.recent];
  }

  /** الاتصال حيّ الآن؟ (WebSocket شغّال وما زال يرمّم) */
  isLive(): boolean {
    return this.isConnected && this.pusher?.connection?.state === 'connected';
  }

  /**
   * حالة الاتصال كما تُعرض للواجهة — «down» فقط حين ما في محاولة جارية،
   * عشان إعادة المحاولة ما تفتح سوكِت جديد فوق النصف مفتوح.
   */
  connectionState(): 'connected' | 'connecting' | 'down' {
    const s = this.pusher?.connection?.state;
    if (this.isConnected && s === 'connected') return 'connected';
    if (this.isConnecting || s === 'connecting' || s === 'reconnecting' || s === 'connected') return 'connecting';
    return 'down';
  }

  onDeleteMessage(callback: (id: string) => void) {
    this.deleteListeners.push(callback);
    return () => { this.deleteListeners = this.deleteListeners.filter(cb => cb !== callback); };
  }

  clearListeners() {
    this.listeners = [];
    this.deleteListeners = [];
  }

  onStatusChange(callback: StatusCallback) {
    this.statusListeners.push(callback);
    // Immediately notify the new listener of current state
    if (this.isConnected) {
      callback(true, false, `متصل (ID: ${this.currentChatroomId})`);
    } else if (this.isConnecting) {
      callback(false, false, 'جاري الاتصال...');
    }
    return () => { this.statusListeners = this.statusListeners.filter(cb => cb !== callback); };
  }

  private notifyStatus(connected: boolean, error: boolean, details: string) {
    this.statusListeners.forEach(cb => cb(connected, error, details));
  }

  async sendMessage(content: string) {
    if (!this.currentChatroomId) {
      console.warn('[ChatService] Cannot send message: not connected to any channel.');
      return false;
    }

    // Try Vite dev proxy first (local development)
    try {
      const response = await fetch(`/kick-api/public/v1/chatrooms/${this.currentChatroomId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.KICK_BOT_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ content, type: "message" })
      });

      if (response.ok) {
        return true;
      }
    } catch (e) {
      // dev proxy not available
    }

    const proxyFallbacks = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.kick.com/public/v1/chatrooms/${this.currentChatroomId}/messages`)}`,
      `https://corsproxy.io/?${encodeURIComponent(`https://api.kick.com/public/v1/chatrooms/${this.currentChatroomId}/messages`)}`,
      `https://proxy.cors.sh/https://api.kick.com/public/v1/chatrooms/${this.currentChatroomId}/messages`
    ];

    for (const proxyUrl of proxyFallbacks) {
      try {
        const response = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.KICK_BOT_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ content, type: "message" })
        });

        if (response.ok) {
          console.log('[ChatService] Message sent via fallback proxy');
          return true;
        }
      } catch (e) {
        console.warn(`[ChatService] Fallback proxy ${proxyUrl} failed:`, e);
      }
    }

    console.error('[ChatService] Failed to send message via all methods');
    return false;
  }

  /**
   * Extract a usable avatar URL from any Kick API payload shape.
   * The authoritative endpoint is /api/v1/users/{slug} which returns a flat
   * user object with `profilepic`.
   */
  private pickAvatarFromKickData(data: any): string {
    if (!data || typeof data !== 'object') return '';

    const candidates = [
      data.profilepic,
      data.profile_pic,
      data.profile_pic_url,
      data.profilePic,
      data.avatar?.url,
      data.avatar_url,
      data.user?.profilepic,
      data.user?.profile_pic,
      data.user?.profile_pic_url,
      data.user?.avatar?.url,
      data.user?.avatar_url,
      data.chatroom?.sender?.profile_pic,
      data.chatroom?.sender?.profilepic,
    ];

    const flat = Object.values(data).find(
      (v) => typeof v === 'string' && /^https?:\/\/.+\.(png|jpe?g|webp|gif)/i.test(v)
    ) as string | undefined;

    const found = candidates.find(
      (v) => typeof v === 'string' && v.trim().length > 10
    ) || flat;

    if (!found) return '';

    let url = String(found).trim();
    if (url.startsWith('//')) url = 'https:' + url;
    else if (url.startsWith('/')) url = 'https://kick.com' + url;
    else if (!/^https?:\/\//i.test(url)) url = 'https://kick.com/' + url.replace(/^\/+/, '');

    return url;
  }

  /** قراءة الصورة من استجابة Kick (مباشرة أو عبر وسيط) */
  private async readKickAvatar(url: string, timeoutMs = 4500): Promise<string> {
    try {
      const res = await this.fetchWithTimeout(url, timeoutMs);
      if (!res.ok) return '';
      const rawData: any = await res.json();
      const data = this.parseProxyResponse(url, rawData);
      return this.pickAvatarFromKickData(data);
    } catch {
      return '';
    }
  }

  /**
   * صورة العضو على Kick.
   * المسار السريع (Kick مباشرة) يُعيد النتيجة خلال أجزاء من الثانية، وأي مصدر
   * بديل يعمل بالتوازي — أول مصدر ينجح يفوز بدل انتظار أبطأ وسيط.
   */
  async fetchKickAvatar(username: string): Promise<string> {
    const slug = username.toLowerCase().trim().replace(/^@+/, '');
    if (!slug) return '';
    if (this.avatarCache[slug] && !isExpiredSignedUrl(this.avatarCache[slug])) return this.avatarCache[slug];
    if (this.pendingAvatarFetches[slug]) return this.pendingAvatarFetches[slug];

    // نسخة محفوظة سابقاً ← تُعرض فوراً بدون أي شبكة (روابط كيك تنتهي صلاحيتها)
    try {
      const stored = localStorage.getItem(`kick_av_${slug}`);
      if (stored && /^https?:\/\//.test(stored) && !isExpiredSignedUrl(stored)) {
        this.avatarCache[slug] = stored;
        return stored;
      }
    } catch { /* ignore */ }

    const userApi = `https://kick.com/api/v1/users/${encodeURIComponent(slug)}`;

    // Kick's own API allows cross-origin reads, so try it directly first — it is
    // by far the fastest and most accurate path. Proxies are only a fallback.
    const urls = [
      userApi,
      `/api/kick?endpoint=${encodeURIComponent(userApi)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(userApi)}&disableCache=true`,
      `https://corsproxy.io/?${encodeURIComponent(userApi)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(userApi)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://kick.com/api/v1/channels/${slug}`)}&disableCache=true`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://kick.com/api/v1/channels/${slug}`)}`,
    ];

    const fetchPromise = (async () => {
      const save = (avatar: string) => {
        this.avatarCache[slug] = avatar;
        try {
          localStorage.setItem(`kick_av_${slug}`, avatar);
          localStorage.setItem(`av_${slug}`, avatar);
        } catch { /* ignore */ }
        persistMemberAvatar(slug, avatar);
        return avatar;
      };

      try {
        // 1) المسار السريع أولاً — لا ننتظر الوسطاء إطلاقاً
        const direct = await this.readKickAvatar(userApi, 4000);
        if (direct) return save(direct);

        // 2) أول وسيط ينجح يفوز
        const rest = urls.slice(1);
        const fromProxy = await new Promise<string>((resolve) => {
          let settled = false;
          let remaining = rest.length;
          rest.forEach((url) => {
            this.readKickAvatar(url).then((avatar) => {
              if (settled) return;
              if (avatar) { settled = true; resolve(avatar); return; }
              remaining -= 1;
              if (remaining === 0) resolve('');
            });
          });
        });
        if (fromProxy) return save(fromProxy);
      } catch (e) {
        console.error(`[ChatService] Error for ${username}`, e);
      } finally {
        delete this.pendingAvatarFetches[slug];
      }
      return '';
    })();

    this.pendingAvatarFetches[slug] = fetchPromise;
    return fetchPromise;
  }

  reconnect() {
    if (this.currentChannelSlug) {
      this.shouldAutoReconnect = true;
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.cleanupPusher();
      this.connect(this.currentChannelSlug);
    }
  }

  disconnect() {
    this.shouldAutoReconnect = false;
    this.stopHealthCheck();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
    this.cleanupPusher();
    this.isConnected = false;
    this.isConnecting = false;
    this.currentChatroomId = null;
    this.currentChannelSlug = null;
  }
}

export const chatService = new ChatService();
