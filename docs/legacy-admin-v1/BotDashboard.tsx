import React, { useState, useEffect, useRef } from 'react';
import { Bot, ShieldCheck, Settings2, Tv, Hash, Key, Zap, Loader2, TerminalSquare, Trash2, UserCheck, Info } from 'lucide-react';

interface BotConfig {
  channel?: string;
  chatroomId?: string;
}

interface BotStatus {
  connected: boolean;
  chatroomId?: string;
}

interface KickStatus {
  connected: boolean;
  username?: string;
  email?: string;
}

export const BotDashboard: React.FC = () => {
  const [channel, setChannel] = useState('');
  const [chatroomId, setChatroomId] = useState('');
  const [tokenMsg, setTokenMsg] = useState('يتم قراءة التوكن من النظام (ملف .env). اضغط مصادقة لتجديده.');
  const [logs, setLogs] = useState<{ text: string; type: 'ok' | 'err' | 'info' | 'msg' }[]>([
    { text: '>> النظام جاهز للعمل. بانتظار أمر الاتصال...', type: 'info' }
  ]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<BotStatus>({ connected: false });
  const [kickStatus, setKickStatus] = useState<KickStatus>({ connected: false });
  const logEndRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_BOT_API_URL || 'http://localhost:3001';

  const addLog = (text: string, type: 'ok' | 'err' | 'info' | 'msg' = 'info') => {
    setLogs((prev) => [...prev, { text, type }]);
  };

  const clearLogs = () => {
    setLogs([{ text: '>> تم مسح السجل.', type: 'info' }]);
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    fetch(`${API_URL}/api/bot/config`)
      .then((r) => r.json())
      .then((cfg: BotConfig) => {
        if (!channel) setChannel(cfg.channel || '');
        if (!chatroomId) setChatroomId(cfg.chatroomId || '');
        
        const params = new URLSearchParams(window.location.search);
        if (params.get('autoConnect') === '1') {
          setTokenMsg('✅ تم تخزين التوكن بنجاح في الخادم وحمايته (OAuth 2.1)');
          addLog('تم الرجوع من صفحة المصادقة بنجاح.', 'ok');
          setTimeout(() => handleConnect(cfg.channel || '', cfg.chatroomId || ''), 800);
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(() => addLog('تنبيه: فشل جلب الإعدادات المسبقة. هل البوت يعمل؟', 'err'));

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/bot/status`);
        const data = await res.json();
        if (data.connected) setStatus(data);
      } catch (e) {}
    };

    const fetchKickStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/bot/kick-status`);
        const data = await res.json();
        setKickStatus(data);
      } catch (e) {}
    };

    const intervalStatus = setInterval(fetchStatus, 3000);
    const intervalKick = setInterval(fetchKickStatus, 5000);
    fetchStatus();
    fetchKickStatus();

    return () => {
      clearInterval(intervalStatus);
      clearInterval(intervalKick);
    };
  }, []);

  const handleConnect = async (customChannel?: string, customRoom?: string) => {
    const ch = customChannel ?? channel;
    const room = customRoom ?? chatroomId;
    
    if (!ch && !room) {
      addLog('تنبيه: يجب إدخال اسم القناة أو رقم الغرفة!', 'err');
      return;
    }

    setIsConnecting(true);
    addLog(`جاري تجهيز الخادم لربط القناة: ${ch || room}...`, 'info');

    try {
      const res = await fetch(`${API_URL}/api/bot/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ch, chatroomId: room }),
      });
      const data = await res.json();
      
      if (data.success) {
        setStatus({ connected: true, chatroomId: data.chatroomId });
        addLog(`تم ربط الشات بنجاح! (الغرفة: ${data.chatroomId || 'غير معروف'})`, 'ok');
        addLog(`جرب البوت الآن بكلمة: "مرحبا" أو "سلام" في الشات.`, 'msg');
      } else {
        throw new Error(data.error || 'استجابة الخادم غير صالحة');
      }
    } catch (e: any) {
      addLog(`خطأ تقني: ${e.message}`, 'err');
      setStatus({ connected: false });
    } finally {
      setIsConnecting(false);
    }
  };

  const getLogStyle = (type: string) => {
    switch (type) {
      case 'ok': return { color: 'text-green-400', icon: '✓ ' };
      case 'err': return { color: 'text-red-400', icon: '❌ ' };
      case 'msg': return { color: 'text-white font-bold', icon: '💬 ' };
      case 'info':
      default: return { color: 'text-blue-400', icon: 'ℹ️ ' };
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-fadeIn" dir="rtl">
      <div className="bg-black/60 backdrop-blur-xl border border-red-500/20 rounded-[2rem] shadow-2xl overflow-hidden p-6 md:p-8 flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/10 pb-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-900 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)] relative overflow-hidden group">
              <Bot className="w-8 h-8 text-white relative z-10 group-hover:scale-110 transition-transform" />
              <div className="absolute inset-0 bg-red-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] mb-1">
                مركز تحكم البوت
              </h1>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${status.connected ? 'bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                  <span className={`w-2 h-2 rounded-full bg-current ${!status.connected ? 'animate-pulse' : ''}`}></span>
                  {status.connected ? 'متصل نشط' : 'غير متصل'}
                </span>
                {kickStatus.email && (
                  <span className="text-xs text-gray-400 font-bold">✉️ {kickStatus.email}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            {kickStatus.connected && kickStatus.username ? (
              <div className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gray-800 text-gray-300 border border-gray-700 font-bold text-sm shadow-md">
                <UserCheck className="w-4 h-4" />
                <span>حساب: {kickStatus.username}</span>
              </div>
            ) : (
              <a href={`${API_URL}/auth/kick?redirect=${encodeURIComponent(window.location.href)}`} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 hover:scale-105 transition-all font-bold text-sm shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                <ShieldCheck className="w-4 h-4" />
                <span>مصادقة Kick (OAuth)</span>
              </a>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Settings */}
          <div className="flex flex-col gap-6">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] rounded-full pointer-events-none"></div>
              
              <h2 className="text-sm font-black text-red-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                إعدادات الاتصال
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 ml-1">اسم القناة (مثل: iabs)</label>
                  <div className="relative">
                    <Tv className="w-4 h-4 text-gray-500 absolute right-4 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                      className="w-full rounded-xl py-3 pr-11 pl-4 text-sm font-bold bg-black/40 border border-red-500/30 text-white focus:outline-none focus:border-red-500 focus:bg-black/60 transition-all" 
                      placeholder="أدخل اسم القناة هنا..." 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 ml-1">رقم الغرفة (اختياري / للبحث التلقائي)</label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-gray-500 absolute right-4 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={chatroomId}
                      onChange={(e) => setChatroomId(e.target.value)}
                      className="w-full rounded-xl py-3 pr-11 pl-4 text-sm font-bold bg-black/40 border border-red-500/30 text-white focus:outline-none focus:border-red-500 focus:bg-black/60 transition-all" 
                      placeholder="أدخل رقم الغرفة (Chatroom ID)..." 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 ml-1">رمز الدخول (Token)</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-gray-500 absolute right-4 top-4" />
                    <textarea 
                      value={tokenMsg}
                      readOnly
                      className="w-full rounded-xl py-3 pr-11 pl-4 text-sm font-bold h-24 resize-none bg-black/40 border border-red-500/30 text-gray-400 focus:outline-none" 
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2 font-bold flex items-center gap-1">
                    <Info className="w-3 h-3" /> لا تحتاج لتعديل هذا الحقل إذا قمت بالمصادقة الرسمية.
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => handleConnect()}
                disabled={isConnecting}
                className="w-full mt-6 py-4 rounded-xl font-black text-white text-base flex items-center justify-center gap-2 bg-gradient-to-br from-red-500 to-red-900 shadow-[0_4px_15px_rgba(239,68,68,0.4)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.6)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:grayscale"
              >
                {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 group-hover:animate-pulse" />}
                <span>{isConnecting ? 'جاري الاتصال...' : 'تشغيل وربط البوت'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col justify-center items-center text-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">حالة الخادم</span>
                <span className={`text-xl font-black ${status.connected ? 'text-green-400' : 'text-white'}`}>
                  {status.connected ? 'أونلاين 🟢' : 'غير متصل'}
                </span>
              </div>
              <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col justify-center items-center text-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">رقم الغرفة</span>
                <span className="text-xl font-black text-red-400">{status.chatroomId || '---'}</span>
              </div>
            </div>

          </div>

          {/* Right Column: Logs & Test */}
          <div className="flex flex-col h-full">
            <div className="bg-[#090909] rounded-2xl p-6 border border-white/5 flex-1 flex flex-col relative shadow-inner">
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-red-500/50 to-transparent"></div>
              
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-black text-gray-300 uppercase tracking-widest flex items-center gap-2">
                  <TerminalSquare className="w-4 h-4 text-red-500" />
                  سجل النظام
                </h2>
                <button onClick={clearLogs} className="text-gray-500 hover:text-red-400 transition-colors p-1" title="مسح السجل">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-black/50 border border-white/5 flex-1 rounded-xl p-4 overflow-y-auto text-sm space-y-2 flex flex-col gap-1 min-h-[300px] max-h-[400px] font-mono">
                {logs.map((log, i) => {
                  const style = getLogStyle(log.type);
                  return (
                    <div key={i} className={`${style.color} break-words`}>
                      <span>{style.icon}</span>{log.text}
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500 font-bold text-center flex flex-col gap-1">
                <span>🔹 خطوة 1: اضغط على مصادقة Kick لإعطاء الصلاحية.</span>
                <span>🔹 خطوة 2: سيتم ملء البيانات آلياً وربط البوت.</span>
                <span>🔹 خطوة 3: اكتب "مرحبا" في شات قناتك لتجربة البوت.</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};
