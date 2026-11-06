 
 
 import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy, Sparkles, Users2, Zap, ArrowUp, ArrowDown, Flag, Keyboard,
  Swords, Gift, Brain, Vote, Bomb, Type, Flame, Smile, Coffee,
  ChevronRight, Play, Star, Heart, Globe, Crown, Medal, Target,
  Gamepad2, MonitorPlay, MessageCircle, Timer, Shuffle, Eye,
Search, TrendingUp, Award, Shield, Crown as CrownIcon, Flame as FlameIcon,
  ChevronDown, RefreshCw, ExternalLink, X, User, Lock, Clock,
  CheckCircle, Loader2, MessageSquare, Copy, ClipboardCheck, AlertTriangle, EyeOff, ArrowRight, Fingerprint,
LogIn
} from 'lucide-react';
import { leaderboardService, supabase } from '../services/supabase';
import { chatService } from '../services/chatService';
import { ProAvatar } from './ProAvatar';
import { getFrameUrl } from '../utils/assets';

interface AboutPageProps {
  onBack: () => void;
}

const GAMES_DATA = [
  {
    name: 'محمح', nameEn: 'MAHMAH', icon: Brain,
    color: 'from-indigo-500 to-purple-600', borderColor: 'border-indigo-500/30',
    glowColor: 'rgba(99,102,241,0.4)',
    category: 'أسئلة',
    description: 'لعبة أسئلة وأجوبة تفاعلية على شكل جيوباردي! يتم تقسيم الأسئلة إلى فئات ونقاط مختلفة. الشات يجاوب والأسرع يفوز!',
    howToPlay: 'اكتب الإجابة في الشات قبل انتهاء الوقت. كل فئة فيها أسئلة بنقاط مختلفة (100، 300, 600).',
  },
  {
    name: 'أعلى أم أقل', nameEn: 'HIGHER OR LOWER', icon: ArrowUp,
    color: 'from-pink-500 to-amber-800', borderColor: 'border-pink-500/30',
    glowColor: 'rgba(236,72,153,0.4)',
    category: 'تخمين',
    description: 'هل تظن أن الرقم أعلى أو أقل؟ لعبة تخمين ممتعة حيث يصوت الشات على إجابتهم والنتيجة تظهر مباشرة!',
    howToPlay: 'اكتب "أعلى" أو "أقل" في الشات خلال وقت التصويت. الأغلبية الصحيحة تفوز بالنقاط!',
  },
  {
    name: 'فوازير', nameEn: 'FAWAZIR', icon: Sparkles,
    color: 'from-amber-500 to-orange-600', borderColor: 'border-amber-500/30',
    glowColor: 'rgba(245,158,11,0.4)',
    category: 'أسئلة',
    description: 'أسئلة ثقافية متنوعة مع خيارات متعددة. سرعتك في الإجابة تحدد ترتيبك!',
    howToPlay: 'اختر رقم الإجابة الصحيحة (1، 2, 3، أو 4) في الشات بأسرع وقت ممكن.',
  },
  {
    name: 'كراسي موسيقية', nameEn: 'MUSICAL CHAIRS', icon: Coffee,
    color: 'from-teal-500 to-cyan-600', borderColor: 'border-teal-500/30',
    glowColor: 'rgba(20,184,166,0.4)',
    category: 'سرعة',
    description: 'لعبة الكراسي الموسيقية الكلاسيكية بنكهة رقمية! الموسيقى تتوقف ولازم تكتب بسرعة عشان ما تطلع.',
    howToPlay: 'عندما تتوقف الموسيقى, اكتب الكلمة المطلوبة بأسرع وقت. آخر شخص يطلع!',
  },
  {
    name: 'حرب المساكيل', nameEn: 'MASAQIL WAR', icon: Swords,
    color: 'from-amber-700 to-amber-900', borderColor: 'border-amber-700/30',
    glowColor: 'rgba(239,68,68,0.4)',
    category: 'منافسة',
    description: 'حرب أسئلة ملحمية بين فريقين! كل فريق يحاول الإجابة بشكل أسرع للفوز بالنقاط.',
    howToPlay: 'انضم لفريقك وأجب على الأسئلة في الشات. الفريق الأسرع بالإجابة الصحيحة يكسب النقاط!',
  },
  {
    name: 'تخمين الصورة', nameEn: 'BLUR GUESS', icon: Eye,
    color: 'from-blue-500 to-blue-700', borderColor: 'border-blue-500/30',
    glowColor: 'rgba(59,130,246,0.4)',
    category: 'تخمين',
    description: 'صورة مموهة تبدأ بالوضوح تدريجياً. كل ما خمنت أبكر, كل ما كسبت نقاط أكثر!',
    howToPlay: 'اكتب تخمينك في الشات. الصورة تتضح مع الوقت وأول شخص يخمن صح يفوز!',
  },
  {
    name: 'الروليت', nameEn: 'ROULETTE', icon: Gift,
    color: 'from-yellow-500 to-amber-600', borderColor: 'border-yellow-500/30',
    glowColor: 'rgba(234,179,8,0.4)',
    category: 'حظ',
    description: 'الروليت تختار شخص، وهذا الشخص يقرر: يقصي خصم من الساحة أو يرجّع ميت للحياة!',
    howToPlay: 'انضم بكلمة الدخول، الروليت تختار واحد، وبعدها يختار بين الإقصاء أو الإحياء من الشات!',
  },
  {
    name: 'مسابقة الأعلام', nameEn: 'FLAG QUIZ', icon: Flag,
    color: 'from-green-500 to-emerald-600', borderColor: 'border-green-500/30',
    glowColor: 'rgba(34,197,94,0.4)',
    category: 'أسئلة',
    description: 'اختبر معرفتك بأعلام العالم! شوف العلم وخمن الدولة بأسرع وقت.',
    howToPlay: 'اكتب اسم الدولة في الشات عندما يظهر العلم. الأسرع يفوز!',
  },
  {
    name: 'سباق الكتابة', nameEn: 'TYPING RACE', icon: Keyboard,
    color: 'from-violet-500 to-purple-600', borderColor: 'border-violet-500/30',
    glowColor: 'rgba(139,92,246,0.4)',
    category: 'سرعة',
    description: 'سباق كتابة حماسي! اكتب الكلمة أو الجملة المطلوبة بأسرع وقت ممكن.',
    howToPlay: 'اكتب النص المعروض في الشات بالضبط. الأسرع والأدق يفوز!',
  },
  {
    name: 'صيد الكنز', nameEn: 'GRID HUNT', icon: Target,
    color: 'from-orange-500 to-amber-800', borderColor: 'border-orange-500/30',
    glowColor: 'rgba(249,115,22,0.4)',
    category: 'حظ',
    description: 'شبكة مليئة بالمفاجآت! اختر المربع الصحيح واكسب النقاط أو واجه الفخاخ.',
    howToPlay: 'اكتب رقم المربع في الشات. بعض المربعات فيها نقاط وبعضها فخاخ!',
  },
  {
    name: 'خلط الأكواب', nameEn: 'CUP SHUFFLE', icon: Shuffle,
    color: 'from-sky-500 to-blue-600', borderColor: 'border-sky-500/30',
    glowColor: 'rgba(14,165,233,0.4)',
    category: 'تخمين',
    description: 'تتبع الكرة تحت الأكواب! الأكواب تتحرك بسرعة وعليك اختيار الكوب الصحيح.',
    howToPlay: 'شاهد الأكواب وهي تتحرك, ثم اكتب رقم الكوب الذي تعتقد أن الكرة تحته.',
  },
  {
    name: 'حرب الأراضي', nameEn: 'TERRITORY WAR', icon: Globe,
    color: 'from-emerald-500 to-teal-600', borderColor: 'border-emerald-500/30',
    glowColor: 'rgba(16,185,129,0.4)',
    category: 'منافسة',
    description: 'احتل الأراضي وسيطر على الخريطة! لعبة استراتيجية جماعية مثيرة.',
    howToPlay: 'اختر المنطقة التي تريد احتلالها وأجب على السؤال للسيطرة عليها.',
  },
  {
    name: 'حقيقة أم كذبة', nameEn: 'TRUTH OR LIE', icon: Brain,
    color: 'from-fuchsia-500 to-pink-600', borderColor: 'border-fuchsia-500/30',
    glowColor: 'rgba(217,70,239,0.4)',
    category: 'أسئلة',
    description: 'هل المعلومة صحيحة أم خاطئة؟ اختبر حدسك ومعرفتك العامة!',
    howToPlay: 'اكتب "صح" أو "غلط" في الشات بعد قراءة المعلومة.',
  },
  {
    name: 'تحدي الرسم', nameEn: 'DRAWING CHALLENGE', icon: Sparkles,
    color: 'from-rose-500 to-pink-600', borderColor: 'border-rose-500/30',
    glowColor: 'rgba(244,63,94,0.4)',
    category: 'إبداع',
    description: 'الستريمر يرسم والشات يخمن! لعبة إبداعية مليئة بالضحك والمرح.',
    howToPlay: 'خمن ما يرسمه الستريمر واكتب إجابتك في الشات. الأسرع يفوز!',
  },
  {
    name: 'حرب الفواكه', nameEn: 'FRUIT WAR', icon: FlameIcon,
    color: 'from-lime-500 to-green-600', borderColor: 'border-lime-500/30',
    glowColor: 'rgba(132,204,22,0.4)',
    category: 'منافسة',
    description: 'معركة فواكه حماسية! اختر فاكهتك وحارب للبقاء في الساحة.',
    howToPlay: 'اكتب اسم الفاكهة التي تختارها وشارك في المعركة!',
  },
  {
    name: 'تخمين الشعار', nameEn: 'LOGO ROUND', icon: Eye,
    color: 'from-cyan-500 to-blue-600', borderColor: 'border-cyan-500/30',
    glowColor: 'rgba(6,182,212,0.4)',
    category: 'تخمين',
    description: 'شعارات شركات ومنتجات مشهورة. هل تقدر تعرفها كلها؟',
    howToPlay: 'اكتب اسم الشركة أو المنتج صاحب الشعار في الشات.',
  },
  {
    name: 'التصويت', nameEn: 'VOTING GAME', icon: Vote,
    color: 'from-indigo-500 to-blue-600', borderColor: 'border-indigo-500/30',
    glowColor: 'rgba(99,102,241,0.4)',
    category: 'تفاعل',
    description: 'صوّت على رأيك! أسئلة ممتعة والشات يقرر الإجابة بالأغلبية.',
    howToPlay: 'اكتب رقم اختيارك في الشات وشوف رأي الأغلبية!',
  },
  {
    name: 'قنبلة الوقت', nameEn: 'TIME BOMB', icon: Bomb,
    color: 'from-amber-800 to-orange-600', borderColor: 'border-amber-800/30',
    glowColor: 'rgba(220,38,38,0.4)',
    category: 'سرعة',
    description: 'القنبلة تدور بين اللاعبين! أجب قبل ما تنفجر عليك.',
    howToPlay: 'أجب على السؤال بسرعة قبل انتهاء الوقت. إذا انفجرت القنبلة عليك، تخرج!',
  },
  {
    name: 'بناء الكلمات', nameEn: 'WORD BUILDER', icon: Type,
    color: 'from-amber-500 to-yellow-600', borderColor: 'border-amber-500/30',
    glowColor: 'rgba(245,158,11,0.4)',
    category: 'إبداع',
    description: 'كوّن كلمات من الأحرف المعطاة! كل ما كانت الكلمة أطول، كل ما كسبت أكثر.',
    howToPlay: 'اكتب أطول كلمة تقدر تكوّنها من الأحرف المعروضة في الشات.',
  },
  {
    name: 'جسر الزجاج', nameEn: 'GLASS BRIDGE', icon: Flame,
    color: 'from-cyan-400 to-blue-600', borderColor: 'border-cyan-400/30',
    glowColor: 'rgba(34,211,238,0.4)',
    category: 'حظ',
    description: 'مستوحاة من لعبة الحبار! اختر الزجاجة الصحيحة أو اسقط.',
    howToPlay: 'اختر يمين أو يسار في كل خطوة. الزجاج الخطأ يكسر وتسقط!',
  },
  {
    name: 'الأرض حمم', nameEn: 'FLOOR IS LAVA', icon: FlameIcon,
    color: 'from-orange-500 to-amber-800', borderColor: 'border-orange-500/30',
    glowColor: 'rgba(249,115,22,0.4)',
    category: 'سرعة',
    description: 'الأرض تتحول لحمم بركانية! اقفز على المنصات الآمنة قبل فوات الأوان.',
    howToPlay: 'اكتب رقم المنصة الآمنة في الشات قبل أن تغمرها الحمم!',
  },
  {
    name: 'شفرة الإيموجي', nameEn: 'EMOJI CODE', icon: Smile,
    color: 'from-yellow-400 to-orange-500', borderColor: 'border-yellow-400/30',
    glowColor: 'rgba(250,204,21,0.4)',
    category: 'تخمين',
    description: 'فك شفرة الإيموجيات! مجموعة إيموجيات تمثل كلمة أو جملة، خمنها!',
    howToPlay: 'شوف الإيموجيات واكتب الكلمة أو الجملة التي تمثلها في الشات.',
  },
  {
    name: 'الكلمات الممنوعة', nameEn: 'FORBIDDEN WORDS', icon: Shield,
    color: 'from-amber-700 to-amber-800', borderColor: 'border-amber-700/30',
    glowColor: 'rgba(239,68,68,0.4)',
    category: 'إبداع',
    description: 'لعبة حماسية! حاول تشرح الكلمة لفريقك بدون ما تقول الكلمات الممنوعة.',
    howToPlay: 'اشرح الكلمة المطلوبة بدون استخدام الكلمات الموجودة في القائمة الممنوعة.',
  },
  {
    name: 'حروف مع منصور', nameEn: 'LETTER GAME', icon: Type,
    color: 'from-yellow-500 to-amber-800', borderColor: 'border-yellow-500/30',
    glowColor: 'rgba(232,190,110,0.4)',
    category: 'إبداع',
    description: 'معركة حروف على ساحة الخلايا! كل جواب صحيح بحرف الخلية يفتح لفريقك خلايا ويبني ربطه نحو النصر.',
    howToPlay: 'في صفحة الانتظار اكتب «دخول الذهبي» أو «دخول النحاسي» للانضمام لفريق. أثناء الجولة اكتب «جرس» في الشات لرنّ الخلية المفتوحة، ثم جاوب بكلمة تبدأ بحرفها. الفريق الذهبي يربط من الأعلى للأسفل، والنحاسي من اليمين للشمال.',
  },
  {
    name: 'تحدي الفرق', nameEn: 'TEAM BATTLE', icon: Swords,
    color: 'from-orange-500 to-amber-700', borderColor: 'border-orange-500/30',
    glowColor: 'rgba(249,115,22,0.4)',
    category: 'منافسة',
    description: 'معركة حامية بين الفرق! اجمع النقاط لفريقك واهزم الفريق الخصم.',
    howToPlay: 'انضم لفريق وجاوب بسرعة لتكسب نقاط وتتفوق على الفريق الثاني.',
  },
  {
    name: 'السحب', nameEn: 'RAFFLE', icon: Gift,
    color: 'from-emerald-400 to-green-500', borderColor: 'border-emerald-400/30',
    glowColor: 'rgba(52,211,153,0.4)',
    category: 'حظ',
    description: 'نظام سحوبات متقدم لاختيار الفائزين من الشات بكل عدل وشفافية.',
    howToPlay: 'اكتب كلمة السحب في الشات لتدخل في السحب العشوائي.',
  },
];

const CATEGORIES = ['الكل', 'أسئلة', 'تخمين', 'سرعة', 'منافسة', 'حظ', 'إبداع', 'تفاعل'];

const STATS = [
  { label: 'لعبة تفاعلية', value: '25+', icon: Gamepad2, color: 'from-amber-700 to-amber-800' },
  { label: 'بث مباشر', value: '24/7', icon: MonitorPlay, color: 'from-green-500 to-emerald-600' },
  { label: 'تفاعل مباشر', value: '100%', icon: MessageCircle, color: 'from-blue-500 to-indigo-600' },
  { label: 'لاعب نشط', value: '∞', icon: Users2, color: 'from-amber-500 to-orange-600' },
];

export const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  const [activeGame, setActiveGame] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const [showAllGames, setShowAllGames] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Auth State
  const [authStep, setAuthStep] = useState<'REGISTER' | 'KICK_VERIFY' | 'VERIFYING' | 'VERIFIED'>('REGISTER');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authKickUsername, setAuthKickUsername] = useState('');
  const [authDiscord, setAuthDiscord] = useState('');
  const [authPassword, setAuthPassword] = useState<string[]>(['', '', '', '', '', '']);
  const [authConfirmPassword, setAuthConfirmPassword] = useState<string[]>(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authAvatar, setAuthAvatar] = useState('');
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeExpiry, setCodeExpiry] = useState(120);
  const [chatConnected, setChatConnected] = useState(false);
  const [formError, setFormError] = useState('');
  const [shake, setShake] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const passRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verificationCodeRef = useRef('');
  const kickUsernameRef = useRef('');
  const codeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate verification code
  const generateVerificationCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  // Hash password
  const hashPassword = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'iABS_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Fetch Kick avatar
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (authKickUsername.trim().length >= 2) {
        setIsLoadingAvatar(true);
        setAvatarError(false);
        try {
          const avatar = await chatService.fetchKickAvatar(authKickUsername.trim());
          if (avatar) {
            setAuthAvatar(avatar);
          } else {
            setAuthAvatar('');
            setAvatarError(true);
          }
        } catch {
          setAuthAvatar('');
          setAvatarError(true);
        }
        setIsLoadingAvatar(false);
      } else {
        setAuthAvatar('');
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [authKickUsername]);

  // Countdown timer
  useEffect(() => {
    if (authStep === 'KICK_VERIFY' && codeExpiry > 0) {
      codeTimerRef.current = setInterval(() => {
        setCodeExpiry(prev => {
          if (prev <= 1) {
            clearInterval(codeTimerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (codeTimerRef.current) clearInterval(codeTimerRef.current);
      };
    }
  }, [authStep, codeExpiry]);

  // Keep refs in sync
  useEffect(() => { verificationCodeRef.current = verificationCode; }, [verificationCode]);
  useEffect(() => { kickUsernameRef.current = authKickUsername; }, [authKickUsername]);

  // Connect to Kick chat for verification
  useEffect(() => {
    if (authStep !== 'KICK_VERIFY') return;
    setChatConnected(false);

    const kickChannel = 'icg1';
    chatService.connect(kickChannel);

    const statusUnsub = chatService.onStatusChange((connected) => {
      if (connected) setChatConnected(true);
    });

    const msgUnsub = chatService.onMessage((msg) => {
      const content = msg.content.trim().toUpperCase().replace(/\s+/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
      const expectedCode = `iCG1-${verificationCodeRef.current}`;

      if (content === expectedCode || content.includes(expectedCode)) {
        if (msg.user.username.toLowerCase() === kickUsernameRef.current.toLowerCase()) {
          handleVerificationSuccess(msg.user.avatar);
        } else {
          setFormError(`عذراً، الحساب الذي أرسل الكود (${msg.user.username}) لا يطابق الحساب المسجل (${kickUsernameRef.current}).`);
          setAuthStep('REGISTER');
        }
      }
    });

    return () => { msgUnsub(); statusUnsub(); };
  }, [authStep]);

  const handleVerificationSuccess = async (avatar?: string) => {
    setAuthStep('VERIFYING');
    try {
      const hashedPass = await hashPassword(authPassword.join(''));
      const finalAvatar = authAvatar || avatar || '';

      const { error } = await supabase.from('users').insert({
        kick_username: authKickUsername.trim().toLowerCase(),
        display_name: authName.trim(),
        discord: authDiscord.trim() || '',
        password_hash: hashedPass,
        avatar: finalAvatar,
        is_verified: true
      });

      if (error && !error.message.includes('duplicate')) {
        setFormError('حدث خطأ في حفظ الحساب');
        setAuthStep('REGISTER');
        return;
      }

      try {
        await supabase.from('profiles').upsert({
          username: authKickUsername.trim().toLowerCase(),
          avatar_url: finalAvatar || '',
          role: 'user',
          created_at: new Date().toISOString()
        });
      } catch (err) { console.error('[About] Profile init error:', err); }

      try {
        await supabase.from('leaderboard').insert([{
          username: authKickUsername.trim().toLowerCase(),
          score: 0,
          wins: 0
        }]);
      } catch (err) { console.error('[About] Leaderboard init error:', err); }

      const userData = {
        id: (await supabase.from('users').select('id').eq('kick_username', authKickUsername.trim().toLowerCase()).single()).data?.id || '',
        display_name: authName.trim(),
        kick_username: authKickUsername.trim(),
        discord: authDiscord.trim() || undefined,
        avatar: finalAvatar || undefined,
        points: 0
      };
      localStorage.setItem('iabs_user', JSON.stringify(userData));
      localStorage.setItem('iabs_device_registered', 'true');

      setAuthStep('VERIFIED');
      setTimeout(() => {
        setAuthStep('REGISTER');
        setAuthName('');
        setAuthKickUsername('');
        setAuthDiscord('');
        setAuthPassword(['', '', '', '', '', '']);
        setAuthConfirmPassword(['', '', '', '', '', '']);
        setAuthAvatar('');
      }, 3000);
    } catch (err) {
      console.error('[About] Error:', err);
      setFormError('حدث خطأ غير متوقع');
      setAuthStep('REGISTER');
    }
  };

  const handlePassInput = (index: number, value: string, isConfirm: boolean) => {
    const char = value.slice(-1);
    if (char && !/^[a-zA-Z0-9]$/.test(char)) return;
    const arr = isConfirm ? [...authConfirmPassword] : [...authPassword];
    arr[index] = char;
    isConfirm ? setAuthConfirmPassword(arr) : setAuthPassword(arr);
    const refs = isConfirm ? confirmRefs : passRefs;
    if (char && index < 5) refs.current[index + 1]?.focus();
  };

  const handlePassKeyDown = (index: number, e: React.KeyboardEvent, isConfirm: boolean) => {
    const arr = isConfirm ? authConfirmPassword : authPassword;
    const refs = isConfirm ? confirmRefs : passRefs;
    if (e.key === 'Backspace' && !arr[index] && index > 0) refs.current[index - 1]?.focus();
  };

  const handleContinue = async () => {
    if (isLoginMode) {
      await handleLogin();
    } else {
      await handleRegister();
    }
  };

  const handleLogin = async () => {
    setFormError('');
    if (!authKickUsername.trim()) { setFormError('يرجى إدخال اسم مستخدم Kick'); triggerShake(); return; }
    if (authPassword.some(d => d === '')) { setFormError('يرجى إدخال كلمة السر (6 أحرف أو أرقام)'); triggerShake(); return; }

    try {
      const hashedPass = await hashPassword(authPassword.join(''));
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('kick_username', authKickUsername.trim().toLowerCase())
        .eq('password_hash', hashedPass)
        .maybeSingle();

      if (error) {
        setFormError('حدث خطأ في تسجيل الدخول');
        triggerShake();
        return;
      }

      if (!user) {
        setFormError('اسم المستخدم أو كلمة السر غير صحيحة');
        triggerShake();
        return;
      }

      const userData = {
        id: user.id,
        display_name: user.display_name || authKickUsername.trim(),
        kick_username: user.kick_username,
        discord: user.discord || undefined,
        avatar: user.avatar || undefined,
        points: user.points || 0
      };
      localStorage.setItem('iabs_user', JSON.stringify(userData));
      localStorage.setItem('site_access_granted', JSON.stringify({ valid: true, role: 'user' }));

      setAuthStep('VERIFIED');
      setTimeout(() => {
        setAuthStep('REGISTER');
        setAuthName('');
        setAuthKickUsername('');
        setAuthDiscord('');
        setAuthPassword(['', '', '', '', '', '']);
        setAuthConfirmPassword(['', '', '', '', '', '']);
        setAuthAvatar('');
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('[About] Login error:', err);
      setFormError('حدث خطأ غير متوقع');
      triggerShake();
    }
  };

  const handleRegister = async () => {
    setFormError('');
    if (!authName.trim()) { setFormError('يرجى إدخال الاسم'); triggerShake(); return; }
    if (!authKickUsername.trim()) { setFormError('يرجى إدخال اسم مستخدم Kick'); triggerShake(); return; }
    if (authPassword.some(d => d === '')) { setFormError('يرجى إدخال كلمة السر (6 أحرف أو أرقام)'); triggerShake(); return; }
    if (authConfirmPassword.some(d => d === '')) { setFormError('يرجى تأكيد كلمة السر'); triggerShake(); return; }
    if (authPassword.join('') !== authConfirmPassword.join('')) {
      setFormError('كلمة المرور غير متطابقة'); triggerShake();
      setAuthConfirmPassword(['', '', '', '', '', '']); confirmRefs.current[0]?.focus(); return;
    }

    const deviceCheck = localStorage.getItem('iabs_device_registered');
    if (deviceCheck) {
      setFormError('عذراً، لا يمكنك إنشاء أكثر من حساب واحد من هذا الجهاز.');
      triggerShake();
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('kick_username', authKickUsername.trim().toLowerCase())
        .maybeSingle();
      if (existing) {
        setFormError('هذا الحساب مسجل مسبقاً');
        triggerShake();
        return;
      }
    } catch (e) { console.error('[About] Check user error:', e); }

    const code = generateVerificationCode();
    setVerificationCode(code);
    setCodeExpiry(120);
    setAuthStep('KICK_VERIFY');
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const regenerateCode = () => {
    const code = generateVerificationCode();
    setVerificationCode(code);
    setCodeExpiry(120);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(`iCG1-${verificationCode}`);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    setIsLoadingLeaderboard(true);
    leaderboardService.getAllRankedPlayers().then(data => {
      setLeaderboardData(data);
      setIsLoadingLeaderboard(false);
    }).catch(() => setIsLoadingLeaderboard(false));
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('[data-animate-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const filteredGames = useMemo(() => {
    return GAMES_DATA.filter(game => {
      const matchesSearch = !searchQuery || game.name.includes(searchQuery) || game.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) || game.description.includes(searchQuery);
      const matchesCategory = selectedCategory === 'الكل' || game.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const filteredLeaderboard = useMemo(() => {
    if (!leaderboardSearch) return leaderboardData.slice(0, 20);
    return leaderboardData.filter(p => p.username?.toLowerCase().includes(leaderboardSearch.toLowerCase())).slice(0, 20);
  }, [leaderboardData, leaderboardSearch]);

  const topPlayers = leaderboardData.slice(0, 3);

  return (
    <div className="min-h-screen bg-transparent text-white w-full overflow-x-hidden relative" dir="rtl">
      {/* Floating Particles Background - Enhanced */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${i % 3 === 0 ? 'animate-pulse' : i % 3 === 1 ? 'animate-float' : 'animate-ping'}`}
            style={{
              width: `${1 + Math.random() * 4}px`,
              height: `${1 + Math.random() * 4}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: i % 4 === 0 
                ? `rgba(255, 0, 0, ${0.2 + Math.random() * 0.4})` 
                : i % 4 === 1 
                ? `rgba(255, 255, 255, ${0.1 + Math.random() * 0.2})`
                : i % 4 === 2
                ? `rgba(255, 200, 0, ${0.1 + Math.random() * 0.2})`
                : `rgba(147, 51, 234, ${0.1 + Math.random() * 0.2})`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${3 + Math.random() * 5}s`,
              boxShadow: i % 5 === 0 ? `0 0 ${Math.random() * 10 + 5}px rgba(255,0,0,${0.2 + Math.random() * 0.3})` : 'none',
            }}
          />
        ))}
        {/* Floating emojis/glow orbs */}
        {['🔥', '⚡', '💀', '👑', '🎮', '🏆'].map((emoji, i) => (
          <div
            key={`emoji-${i}`}
            className="absolute animate-float opacity-[0.04]"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              fontSize: `${20 + Math.random() * 30}px`,
              animationDelay: `${i * 1.5}s`,
              animationDuration: `${6 + Math.random() * 4}s`,
            }}
          >
            {emoji}
          </div>
        ))}
      </div>

      {/* ============ HERO SECTION ============ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-red-950/20 to-black" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-800/8 blur-[200px] rounded-full" />
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-amber-700/40 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-amber-700/30 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-amber-700/25 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 bg-amber-700/20 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-amber-700/15 rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(255,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,0,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="relative inline-block mb-10">
            <div className="absolute -inset-8 bg-amber-800/15 blur-[80px] rounded-full" />
            <div className="animate-float">
              <img src="/logo2.png" className="h-32 md:h-44 relative drop-shadow-[0_0_50px_rgba(255,0,0,0.6)]" alt="ABS ARENA" style={{ filter: 'brightness(1.15)' }} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 md:gap-5 mb-4 relative">
            {/* ARENA - Red Fire Effect */}
            <span className="text-5xl md:text-[5rem] font-black tracking-tighter leading-none relative"
                  style={{
                    color: '#ff0000',
                    textShadow: '0 0 20px rgba(255,0,0,0.8), 0 0 40px rgba(255,0,0,0.6), 0 0 80px rgba(255,0,0,0.4), 0 0 120px rgba(255,0,0,0.2), 0 0 200px rgba(255,0,0,0.1)',
                  }}>
              ARENA
              {/* Fire flicker overlay */}
              <span className="absolute inset-0 text-transparent bg-gradient-to-t from-amber-800 via-amber-700 to-amber-600 bg-clip-text animate-pulse" 
                    style={{animationDuration: '0.5s', opacity: 0.3}}>
                ARENA
              </span>
            </span>
            
            {/* Red Dot Divider */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-[2px] h-5 md:h-8 bg-gradient-to-b from-transparent via-amber-700 to-transparent" />
              <div className="w-3 h-3 bg-amber-700 rounded-full shadow-[0_0_30px_rgba(239,68,68,1),0_0_60px_rgba(239,68,68,0.6),0_0_100px_rgba(139,69,19,0.4)] animate-pulse" />
              <div className="w-[2px] h-5 md:h-8 bg-gradient-to-t from-transparent via-amber-700 to-transparent" />
            </div>
            
            {/* ABS - Pure White */}
            <span className="text-white text-5xl md:text-[5rem] font-black tracking-tighter leading-none drop-shadow-[0_0_40px_rgba(255,255,255,0.5)]" 
                  style={{textShadow: '0 0 30px rgba(255,255,255,0.6), 0 0 60px rgba(255,255,255,0.3), 0 0 100px rgba(255,255,255,0.1)'}}>
              ABS
            </span>
          </div>
          
          {/* Animated underline */}
          <div className="h-[3px] w-32 mx-auto bg-gradient-to-r from-transparent via-amber-700 to-transparent mb-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
          </div>

          <p className="text-xl md:text-3xl text-white/70 font-black max-w-2xl mx-auto leading-relaxed mb-3">
            أكبر منصة ألعاب تفاعلية للبثوث المباشرة في العالم العربي
          </p>
          <p className="text-base md:text-xl text-white/30 font-bold max-w-xl mx-auto leading-relaxed mb-10">
            العب مع الشات مباشرة في بثوث{' '}
            <span className="text-amber-700 font-black">iABS</span> على منصة{' '}
            <span className="text-green-500 font-black">Kick.com</span>
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-5 mb-16">
            <button onClick={onBack} className="group relative w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-amber-800 via-amber-900 to-amber-900 rounded-2xl font-black text-base sm:text-lg text-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(239,68,68,0.4)] overflow-hidden flex items-center justify-center gap-3 border border-amber-600/30">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]" />
              <Gamepad2 size={24} className="relative z-10" />
              <span className="relative z-10">دخول الساحة الرئيسية</span>
            </button>
            <a href="https://kick.com/iabs" target="_blank" rel="noopener noreferrer" className="group relative w-full sm:w-auto px-6 sm:px-8 py-4 sm:py-5 bg-black/40 backdrop-blur-xl border border-green-500/30 hover:border-green-400/60 rounded-2xl font-black text-base sm:text-lg text-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(34,197,94,0.15)] overflow-hidden flex items-center justify-center gap-3">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 via-green-400/10 to-green-400/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]" />
              <Play size={20} className="relative z-10 text-green-400" />
              <span className="relative z-10 text-green-400">شاهد البث على Kick</span>
            </a>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {STATS.map((stat, i) => (
              <div key={i} className="bg-black/40 backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-5 text-center hover:bg-black/60 hover:border-amber-700/20 transition-all group">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg`}>
                  <stat.icon size={22} className="text-white" />
                </div>
                <div className="text-3xl font-black text-white mb-1 font-mono tracking-tight">{stat.value}</div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">اكتشف المزيد</span>
          <ArrowDown size={16} className="text-white/30" />
        </div>
      </section>

      {/* ============ ABOUT SECTION ============ */}
      <section id="about-iabs" data-animate-section className={`relative py-14 md:py-28 px-4 transition-all duration-1000 ${visibleSections.has('about-iabs') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-amber-800/6 blur-[150px] rounded-full" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-16">
            <span className="text-amber-700 font-black uppercase tracking-[0.3em] text-xs">من نحن</span>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 mb-4">
            <span className="text-amber-700">ABS </span><span className="text-white">ARENA</span>
            </h2>
            <div className="h-1 w-16 mx-auto bg-gradient-to-r from-transparent via-amber-700 to-transparent mt-4" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <p className="text-white/70 font-bold text-lg leading-relaxed">
                <span className="text-amber-700 font-black">ABS </span><span className="text-white">ARENA</span> هي أكبر منصة ألعاب تفاعلية حصرية مصممة خصيصاً لبثوث{' '}
                <span className="text-white font-black">iABS</span> على منصة{' '}
                <span className="text-green-500 font-black">Kick.com</span>.
              </p>
              <p className="text-white/50 font-bold text-base leading-relaxed">
                المنصة تحتوي على أكثر من <span className="text-white font-black">25 لعبة تفاعلية</span> مختلفة، كل لعبة مصممة ليتفاعل معها المشاهدون مباشرة من خلال الشات أثناء البث المباشر.
              </p>
              <p className="text-white/50 font-bold text-base leading-relaxed">
                تأسيس المنصة جاء من شغف الألعاب والبثوث المباشرة، ونسعى لنكون الخيار الأول للبثوث التفاعلية في العالم العربي. كل الفعاليات والألعاب تصير حصرياً في بثوث <span className="text-amber-700 font-black">iABS</span> على كيك.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: MonitorPlay, title: 'بث مباشر', desc: 'كل الألعاب تصير لايف أثناء البث', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
                { icon: MessageCircle, title: 'تفاعل بالشات', desc: 'العب بكتابة إجابتك في شات كيك', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                { icon: Trophy, title: 'لوحة الصدارة', desc: 'تنافس على المركز الأول بالنقاط', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
                { icon: Crown, title: 'حصري لـ iABS', desc: 'ألعاب مصممة خصيصاً لقناة iABS', color: 'text-amber-700', bg: 'bg-amber-700/10', border: 'border-amber-700/20' },
              ].map((f, i) => (
                <div key={i} className={`${f.bg} ${f.border} border rounded-2xl p-5 hover:scale-[1.02] transition-all duration-500 group backdrop-blur-sm`}>
                  <f.icon size={28} className={`${f.color} mb-3 group-hover:scale-110 transition-transform`} />
                  <h3 className="text-white font-black text-base mb-1">{f.title}</h3>
                  <p className="text-white/40 font-bold text-xs">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ JOIN THE ARENA SECTION ============ */}
      <section id="join-arena" data-animate-section className={`relative py-14 md:py-32 px-4 transition-all duration-1000 ${visibleSections.has('join-arena') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-950/10 to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-8 md:mb-16">
            <span className="text-amber-700 font-black uppercase tracking-[0.3em] text-xs">انضم الآن</span>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 mb-4">
              <span className="text-white">سجّل في </span>
              <span className="text-amber-700">الساحة</span>
            </h2>
            <p className="text-white/40 font-bold max-w-2xl mx-auto">أنشئ حسابك مجاناً وابدأ رحلتك في عالم الألعاب التفاعلية</p>
            <div className="h-1 w-20 mx-auto bg-gradient-to-r from-transparent via-amber-700 to-transparent mt-4" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left - Features */}
            <div className="space-y-6">
              {[
                { icon: Trophy, title: 'نقاط ومكافآت', desc: 'اكسب النقاط من كل لعبة تفوز بها واستبدلها بجوائز حقيقية', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
                { icon: Crown, title: 'إطارات حصرية', desc: 'اشترِ إطارات مميزة لصورتك الشخصية من متجر الإطارات', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
                { icon: Medal, title: 'لوحة الشرف', desc: 'تنافس مع أفضل اللاعبين وكن في قمة لوحة الصدارة', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                { icon: Star, title: 'مميزات VIP', desc: 'احصل على شارات ومميزات حصرية كلما زادت نقاطك', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
              ].map((item, i) => (
                <div key={i} className={`${item.bg} ${item.border} border rounded-2xl p-5 hover:scale-[1.02] transition-all duration-500 group backdrop-blur-sm`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <item.icon size={24} className={item.color} />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-base">{item.title}</h3>
                      <p className="text-white/40 font-bold text-sm">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right - Registration Form (Full Auth Flow) */}
            <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 md:p-10 relative overflow-hidden group hover:border-amber-700/30 transition-all duration-500">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-800/10 blur-[60px] rounded-full group-hover:bg-amber-700/20 transition-all duration-700" />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-600/10 blur-[60px] rounded-full group-hover:bg-purple-500/20 transition-all duration-700" />
              
              <div className="relative z-10">
{/* ===== REGISTER / LOGIN STEP ===== */}
                {authStep === 'REGISTER' && (
                  <>
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-700 to-amber-800 flex items-center justify-center">
                        {isLoginMode ? <Lock size={20} className="text-white" /> : <User size={20} className="text-white" />}
                      </div>
                      <div>
                        <h3 className="text-white font-black text-xl">{isLoginMode ? 'تسجيل دخول' : 'إنشاء حساب جديد'}</h3>
                        <p className="text-white/30 font-bold text-xs">{isLoginMode ? 'مرحباً بعودتك إلى الساحة' : 'انضم إلى أكثر من 1000+ لاعب'}</p>
                      </div>
                    </div>

                    {/* Avatar Preview - Only for Registration */}
                    {!isLoginMode && (authAvatar || isLoadingAvatar) && (
                      <div className="flex justify-center mb-4">
                        <div className="relative">
                          {isLoadingAvatar ? (
                            <div className="w-16 h-16 rounded-2xl border-2 border-white/10 flex items-center justify-center bg-black/60">
                              <Loader2 size={20} className="animate-spin text-amber-700" />
                            </div>
                          ) : authAvatar ? (
                            <ProAvatar url={authAvatar} username={authKickUsername} size="w-18 h-18 md:w-24 md:h-24" className="overflow-visible" />
                          ) : null}
                          {authAvatar && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-amber-700 rounded-full flex items-center justify-center border-2 border-black z-20">
                              <CheckCircle size={10} className="text-black" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Name - Only for Registration */}
                      {!isLoginMode && (
                        <div>
                          <label className="text-white/50 font-bold text-xs uppercase tracking-widest mb-2 block flex items-center gap-2">
                            <User size={10} /> الاسم
                          </label>
                          <input
                            type="text"
                            value={authName}
                            onChange={e => setAuthName(e.target.value)}
                            placeholder="اسمك المعروض"
                            className="w-full bg-black/60 border border-white/10 focus:border-amber-700/50 rounded-xl px-4 py-3.5 text-white font-bold text-sm outline-none transition-all placeholder:text-white/20"
                          />
                        </div>
                      )}

                      {/* Kick Username */}
                      <div>
                        <label className="text-white/50 font-bold text-xs uppercase tracking-widest mb-2 block flex items-center gap-2">
                          <span className="text-amber-600">K</span> حساب Kick <span className="text-amber-600">*مطلوب</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={authKickUsername}
                            onChange={e => setAuthKickUsername(e.target.value)}
                            placeholder="اسم المستخدم في Kick"
                            className="w-full bg-black/60 border border-white/10 focus:border-amber-700/50 rounded-xl px-4 py-3.5 text-white font-bold text-sm outline-none transition-all placeholder:text-white/20 pl-12"
                            dir="ltr"
                          />
                          <div className="absolute left-3 top-1/2 -translate-y-1/2">
                            <span className="text-amber-700 font-black text-xs bg-amber-700/10 px-2 py-1 rounded-lg border border-amber-700/20">K</span>
                          </div>
                        </div>
                        {avatarError && authKickUsername.length >= 2 && (
                          <p className="text-yellow-500 text-[10px] mt-1.5 font-bold flex items-center gap-1">
                            <AlertTriangle size={10} /> لم يتم العثور على الحساب
                          </p>
                        )}
                      </div>

                      {/* Discord (Optional) - Only for Registration */}
                      {!isLoginMode && (
                        <div>
                          <label className="text-white/50 font-bold text-xs uppercase tracking-widest mb-2 block flex items-center gap-2">
                            💬 ديسكورد <span className="text-white/30">(اختياري)</span>
                          </label>
                          <input
                            type="text"
                            value={authDiscord}
                            onChange={e => setAuthDiscord(e.target.value)}
                            placeholder="username#0000"
                            className="w-full bg-black/60 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3.5 text-white font-bold text-sm outline-none transition-all placeholder:text-white/20"
                            dir="ltr"
                          />
                        </div>
                      )}

                      {/* Password */}
                      <div>
                        <label className="text-white/50 font-bold text-xs uppercase tracking-widest mb-2 block flex items-center gap-2">
                          <Lock size={10} /> كلمة السر <span className="text-white/30">(6 أحرف أو أرقام)</span>
                        </label>
                        <div className="flex items-center gap-1.5 md:gap-2" dir="ltr">
                          <div className="flex gap-1.5 md:gap-2 flex-1 justify-center">
                            {authPassword.map((digit, i) => (
                              <input
                                key={`p-${i}`}
                                ref={el => { passRefs.current[i] = el; }}
                                type={showPassword ? 'text' : 'password'}
                                inputMode="text"
                                maxLength={1}
                                value={digit}
                                onChange={e => handlePassInput(i, e.target.value, false)}
                                onKeyDown={e => handlePassKeyDown(i, e, false)}
                                onFocus={e => e.target.select()}
                                className={`w-10 h-12 md:w-11 md:h-14 bg-black/60 border-2 rounded-xl text-center text-lg md:text-xl font-black text-white focus:outline-none focus:border-amber-700 focus:shadow-[0_0_15px_rgba(139,69,19,0.4)] transition-all duration-200 ${digit ? 'border-amber-700/40' : 'border-white/10'}`}
                              />
                            ))}
                          </div>
                          <button onClick={() => setShowPassword(!showPassword)} className="p-2 text-white/30 hover:text-white transition-colors flex-shrink-0">
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password - Only for Registration */}
                      {!isLoginMode && (
                        <div>
                          <label className="text-white/50 font-bold text-xs uppercase tracking-widest mb-2 block flex items-center gap-2">
                            <Shield size={10} /> تأكيد كلمة السر
                          </label>
                          <div className="flex items-center gap-1.5 md:gap-2" dir="ltr">
                            <div className="flex gap-1.5 md:gap-2 flex-1 justify-center">
                              {authConfirmPassword.map((digit, i) => (
                                <input
                                  key={`c-${i}`}
                                  ref={el => { confirmRefs.current[i] = el; }}
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  inputMode="text"
                                  maxLength={1}
                                  value={digit}
                                  onChange={e => handlePassInput(i, e.target.value, true)}
                                  onKeyDown={e => handlePassKeyDown(i, e, true)}
                                  onFocus={e => e.target.select()}
                                  className={`w-10 h-12 md:w-11 md:h-14 bg-black/60 border-2 rounded-xl text-center text-lg md:text-xl font-black text-white focus:outline-none focus:border-amber-700 focus:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all duration-200 ${digit ? 'border-amber-700/40' : 'border-white/10'}`}
                                />
                              ))}
                            </div>
                            <button onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="p-2 text-white/30 hover:text-white transition-colors flex-shrink-0">
                              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {formError && (
                        <div className="bg-amber-700/10 border border-amber-700/30 rounded-xl px-4 py-2.5 flex items-center gap-3">
                          <AlertTriangle size={16} className="text-amber-700 shrink-0" />
                          <span className="text-amber-600 font-bold text-sm">{formError}</span>
                        </div>
                      )}

                      {/* Continue / Login Button */}
                      <button
                        onClick={handleContinue}
                        className="w-full py-4 bg-gradient-to-r from-amber-800 to-amber-900 rounded-xl font-black text-lg text-white hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_30px_rgba(139,69,19,0.4)] relative overflow-hidden group/btn"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]" />
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {isLoginMode ? <LogIn size={18} /> : <ArrowRight size={18} />} {isLoginMode ? 'تسجيل دخول' : 'متابعة'}
                        </span>
                      </button>
                      {!isLoginMode && (
                        <p className="text-white/20 font-bold text-xs text-center">
                          بالتسجيل أنت توافق على{' '}
                          <span 
                            onClick={() => setShowTerms(true)}
                            className="text-amber-700/60 hover:text-amber-700 cursor-pointer"
                          >شروط الاستخدام</span>
                        </p>
                      )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/5 text-center">
                      <p className="text-white/30 font-bold text-sm">
                        {isLoginMode ? 'ما عندك حساب؟' : 'لديك حساب بالفعل؟'}{' '}
                        <span 
                          onClick={() => setIsLoginMode(!isLoginMode)}
                          className="text-amber-700 font-black cursor-pointer hover:text-amber-600 transition-colors"
                        >{isLoginMode ? 'إنشاء حساب' : 'تسجيل دخول'}</span>
                      </p>
                    </div>
                  </>
                )}

                {/* ===== KICK VERIFY STEP ===== */}
                {authStep === 'KICK_VERIFY' && (
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-800/20 to-red-900/20 border border-amber-700/20 mb-5">
                      <MessageSquare size={32} className="text-amber-700" />
                    </div>
                    <h3 className="text-white font-black text-xl mb-2">مصادقة Kick</h3>
                    <p className="text-amber-700 font-bold tracking-[0.3em] text-[10px] uppercase mb-6">KICK CHAT VERIFICATION</p>

                    {/* User Info */}
                    <div className="flex items-center gap-4 bg-black/40 rounded-2xl p-4 border border-white/5 mb-6">
                      <ProAvatar url={authAvatar} username={authKickUsername} size="w-14 h-14" className="overflow-visible" />
                      <div className="text-right">
                        <div className="text-white font-black text-lg">{authKickUsername}</div>
                        <div className="text-white/30 text-xs font-bold">Kick.com</div>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-gradient-to-br from-red-900/20 to-red-950/20 border border-amber-700/20 rounded-2xl p-5 mb-6 text-right">
                      <h4 className="text-amber-600 font-black text-xs flex items-center gap-2 uppercase tracking-widest mb-4">
                        <Shield size={14} /> خطوات التحقق
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-amber-700 text-black rounded-lg flex items-center justify-center font-black text-xs shrink-0">1</span>
                          <span className="text-white/60 font-bold">افتح شات القناة في Kick</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-amber-700 text-black rounded-lg flex items-center justify-center font-black text-xs shrink-0">2</span>
                          <span className="text-white/60 font-bold">أرسل الكود التالي بالضبط:</span>
                        </div>
                      </div>
                    </div>

                    {/* Verification Code */}
                    <div className="bg-black/60 border-2 border-amber-700/30 rounded-2xl p-6 text-center relative overflow-hidden mb-6">
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-700/5 to-transparent"></div>
                      <p className="text-amber-700/60 text-[10px] font-bold uppercase tracking-[0.5em] mb-3 relative z-10">كـود الـتـحـقـق</p>
                      <div className="relative z-10 flex items-center justify-center gap-1" dir="ltr">
                        <span className="text-amber-700 font-black text-2xl tracking-widest">iCG1-</span>
                        <span className="text-white font-black text-2xl tracking-[0.3em] font-mono">{verificationCode}</span>
                      </div>
                      <button onClick={handleCopyCode} className={`mt-4 relative z-10 inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${codeCopied ? 'bg-amber-700/20 border border-amber-700/40 text-amber-600' : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white'}`}>
                        {codeCopied ? <><ClipboardCheck size={14} /> تم النسخ!</> : <><Copy size={14} /> نسخ الكود</>}
                      </button>
                      <div className="mt-3 flex items-center justify-center gap-2 relative z-10">
                        <div className={`w-2 h-2 rounded-full ${codeExpiry > 30 ? 'bg-amber-700' : codeExpiry > 0 ? 'bg-yellow-500 animate-ping' : 'bg-amber-700'}`}></div>
                        <span className={`font-mono font-bold text-sm ${codeExpiry <= 30 ? 'text-yellow-400' : 'text-white/30'}`}>
                          {Math.floor(codeExpiry / 60)}:{(codeExpiry % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>

                    {/* Connection Status */}
                    <div className="flex items-center justify-center gap-3 py-2">
                      {chatConnected ? (
                        <>
                          <Loader2 size={18} className="animate-spin text-amber-700" />
                          <span className="text-white/40 font-bold text-sm">متصل - بانتظار الرسالة في الشات...</span>
                        </>
                      ) : (
                        <>
                          <Loader2 size={18} className="animate-spin text-yellow-500" />
                          <span className="text-yellow-400 font-bold text-sm">جاري الاتصال بالشات...</span>
                        </>
                      )}
                    </div>

                    {codeExpiry === 0 && (
                      <button onClick={regenerateCode} className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl text-sm transition-all border border-white/10 flex items-center justify-center gap-2 mt-4">
                        إعادة توليد الكود
                      </button>
                    )}
                  </div>
                )}

                {/* ===== VERIFYING STEP ===== */}
                {authStep === 'VERIFYING' && (
                  <div className="text-center py-8">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-amber-700/20 blur-[60px] rounded-full animate-pulse"></div>
                      <div className="relative w-24 h-24 rounded-full border-4 border-amber-700/50 flex items-center justify-center bg-black/60 backdrop-blur-xl mx-auto">
                        <Fingerprint size={48} className="text-amber-700 animate-pulse" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">جاري التحقق...</h3>
                    <p className="text-amber-700 font-bold tracking-[0.4em] text-xs uppercase">VERIFYING IDENTITY</p>
                  </div>
                )}

                {/* ===== VERIFIED STEP ===== */}
                {authStep === 'VERIFIED' && (
                  <div className="text-center py-8">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-amber-700/30 blur-[80px] rounded-full"></div>
                      <div className="relative w-28 h-28 rounded-full border-4 border-amber-700 flex items-center justify-center bg-amber-700/10 backdrop-blur-xl mx-auto shadow-[0_0_60px_rgba(34,197,94,0.4)]">
                        <CheckCircle size={56} className="text-amber-700 drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-black text-white mb-2">تم التحقق!</h3>
                    <p className="text-amber-700 font-bold tracking-[0.5em] text-lg uppercase drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">VERIFIED ✓</p>
                    <div className="mt-4 flex items-center justify-center gap-3 bg-amber-700/10 border border-amber-700/20 px-6 py-4 rounded-2xl">
                      <ProAvatar url={authAvatar} username={authKickUsername} size="w-14 h-14" className="overflow-visible" />
                      <span className="text-white font-black">{authKickUsername}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" data-animate-section className={`relative py-14 md:py-32 px-4 transition-all duration-1000 ${visibleSections.has('how-it-works') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-950/5 to-transparent" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-8 md:mb-16">
            <span className="text-amber-700 font-black uppercase tracking-[0.3em] text-xs">كيف تلعب؟</span>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 mb-4">
              <span className="text-white">ثلاث خطوات </span>
              <span className="text-amber-700">فقط</span>
            </h2>
            <div className="h-1 w-20 mx-auto bg-gradient-to-r from-transparent via-amber-700 to-transparent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'ادخل البث', desc: 'افتح بث iABS على Kick.com وانضم للشات. ما تحتاج تسجل بأي مكان ثاني!', icon: MonitorPlay, color: 'from-green-500 to-emerald-600' },
              { step: '02', title: 'شارك بالألعاب', desc: 'لما يبدأ الستريمر لعبة، اكتب إجابتك أو اختيارك في الشات مباشرة.', icon: MessageCircle, color: 'from-blue-500 to-indigo-600' },
              { step: '03', title: 'اكسب النقاط', desc: 'كل إجابة صحيحة تكسبك نقاط! تنافس على قمة لوحة الصدارة وكن الأسطورة.', icon: Trophy, color: 'from-yellow-500 to-amber-600' },
            ].map((item, i) => (
              <div key={i} className="relative bg-white/[0.02] border border-white/5 rounded-3xl p-8 text-center hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500 group animate-tilt-3d">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center font-black text-sm text-white shadow-lg`}>{item.step}</div>
                </div>
                <item.icon size={48} className="text-white/20 mx-auto mb-6 mt-4 group-hover:text-white/40 transition-colors" />
                <h3 className="text-xl font-black text-white mb-3">{item.title}</h3>
                <p className="text-white/40 font-bold text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ADVANCED STATS SECTION ============ */}
      <section id="advanced-stats" data-animate-section className={`relative py-14 md:py-32 px-4 transition-all duration-1000 ${visibleSections.has('advanced-stats') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-8 md:mb-16">
            <span className="text-blue-500 font-black uppercase tracking-[0.3em] text-xs">الأرقام</span>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 mb-4">
              <span className="text-white">الساحة </span>
              <span className="text-blue-500">بالأرقام</span>
            </h2>
            <p className="text-white/40 font-bold max-w-xl mx-auto">إحصائيات حية عن أداء المنصة والمجتمع</p>
            <div className="h-1 w-20 mx-auto bg-gradient-to-r from-transparent via-blue-500 to-transparent mt-4" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Users2, value: '1,500+', label: 'إجمالي اللاعبين', suffix: 'مسجل', color: 'from-blue-500 to-cyan-600', glow: 'rgba(59,130,246,0.4)' },
              { icon: Gamepad2, value: '10,000+', label: 'جولة لعبت', suffix: 'جولة', color: 'from-green-500 to-emerald-600', glow: 'rgba(34,197,94,0.4)' },
              { icon: Trophy, value: '500+', label: 'جوائز مقدمة', suffix: 'جائزة', color: 'from-yellow-500 to-amber-600', glow: 'rgba(234,179,8,0.4)' },
              { icon: Clock, value: '2,000+', label: 'ساعة بث', suffix: 'ساعة', color: 'from-purple-500 to-violet-600', glow: 'rgba(147,51,234,0.4)' },
            ].map((stat, i) => (
              <div key={i} className="group relative bg-black/40 backdrop-blur-xl border border-white/5 hover:border-blue-500/30 rounded-2xl p-6 text-center transition-all duration-500 hover:scale-105 hover:-translate-y-2 overflow-hidden"
                style={{ boxShadow: `0 10px 40px -10px ${stat.glow}` }}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/[0.03] to-transparent rounded-full blur-2xl" />
                <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg`}>
                  <stat.icon size={26} className="text-white" />
                </div>
                <div className="text-4xl md:text-5xl font-black text-white mb-1 font-mono tracking-tight animate-count-up">{stat.value}</div>
                <div className="text-white/50 font-bold text-xs uppercase tracking-widest mb-1">{stat.label}</div>
                <div className="text-white/20 font-bold text-[10px]">+{stat.suffix}</div>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="mt-16 bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: 'نسبة التفاعل', value: 87, color: 'from-amber-700 to-amber-800', icon: Heart },
                { label: 'رضا المستخدمين', value: 94, color: 'from-green-500 to-emerald-600', icon: Star },
                { label: 'نمو المجتمع', value: 156, color: 'from-blue-500 to-indigo-600', icon: TrendingUp },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <item.icon size={20} className={`${item.color.replace('from-', 'text-').split(' ')[0]}`} />
                    <span className="text-white/70 font-bold text-sm">{item.label}</span>
                  </div>
                  <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.value}%` }} />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  </div>
                  <span className="text-white font-black text-lg mt-1 block">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ LEADERBOARD SECTION ============ */}
      <section id="leaderboard" data-animate-section className={`relative py-14 md:py-32 px-4 transition-all duration-1000 ${visibleSections.has('leaderboard') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-yellow-950/5 to-transparent" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-6 md:mb-12">
            <span className="text-yellow-500 font-black uppercase tracking-[0.3em] text-xs">لوحة الصدارة</span>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 mb-4">
              <span className="text-white">أساطير </span>
              <span className="text-yellow-500">الساحة</span>
            </h2>
            <p className="text-white/40 font-bold max-w-xl mx-auto">أفضل اللاعبين نقاطاً في المنصة — تتابع البيانات بشكل مباشر</p>
            <div className="h-1 w-20 mx-auto bg-gradient-to-r from-transparent via-yellow-500 to-transparent mt-4" />
          </div>

          {/* Search */}
          <div className="max-w-md mx-auto mb-10">
            <div className="relative">
              <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="ابحث عن لاعب..."
                value={leaderboardSearch}
                onChange={(e) => setLeaderboardSearch(e.target.value)}
                className="w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl pr-12 pl-4 py-4 text-white font-bold placeholder:text-white/30 focus:outline-none focus:border-yellow-500/50 focus:shadow-[0_0_20px_rgba(234,179,8,0.1)] transition-all"
              />
              {leaderboardSearch && (
                <button onClick={() => setLeaderboardSearch('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {isLoadingLeaderboard ? (
            <div className="text-center py-20">
              <RefreshCw size={40} className="text-white/20 mx-auto mb-4 animate-spin" />
              <p className="text-white/30 font-bold">جاري تحميل البيانات...</p>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="text-center py-20">
              <Trophy size={48} className="text-white/10 mx-auto mb-4" />
              <p className="text-white/30 font-black text-xl">الساحة فاضية</p>
              <p className="text-white/20 font-bold text-sm mt-2">شارك في الألعاب وكن أول لاعب!</p>
            </div>
          ) : (
            <>
              {/* Top 3 Podium */}
              {topPlayers.length >= 3 && !leaderboardSearch && (
                <div className="flex items-end justify-center gap-4 md:gap-6 mb-12">
                  {/* 2nd Place */}
                  <div className="text-center flex-1 max-w-[160px]">
                    <div className="relative inline-block mb-3">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 p-1 shadow-[0_0_30px_rgba(192,192,192,0.3)]">
                        <div className="w-full h-full rounded-full bg-black/80 flex items-center justify-center overflow-hidden">
                          <ProAvatar url={topPlayers[1]?.avatar_url} username={topPlayers[1]?.username || ''} frameUrl={topPlayers[1]?.active_frame_url} size="w-full h-full" className="!overflow-visible" />
                        </div>
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center">
                        <span className="text-black font-black text-xs">2</span>
                      </div>
                    </div>
                    <p className="text-white font-black text-sm truncate">{topPlayers[1]?.username}</p>
                    <p className="text-gray-400 font-bold text-xs">{topPlayers[1]?.score?.toLocaleString()} نقطة</p>
                    <div className="mt-2 h-24 bg-gradient-to-t from-gray-400/20 to-transparent rounded-t-xl border-t-2 border-gray-400/40 flex items-center justify-center">
                      <Medal size={24} className="text-gray-400/60" />
                    </div>
                  </div>

                  {/* 1st Place */}
                  <div className="text-center flex-1 max-w-[180px]">
                    <div className="relative inline-block mb-3">
                      <div className="absolute -inset-4 bg-yellow-500/20 blur-xl rounded-full animate-pulse" />
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 p-1 shadow-[0_0_40px_rgba(234,179,8,0.5)] relative">
                        <div className="w-full h-full rounded-full bg-black/80 flex items-center justify-center overflow-hidden">
                          <ProAvatar url={topPlayers[0]?.avatar_url} username={topPlayers[0]?.username || ''} frameUrl={topPlayers[0]?.active_frame_url} size="w-full h-full" className="!overflow-visible" />
                        </div>
                      </div>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Crown size={28} className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg">
                        <span className="text-black font-black text-sm">1</span>
                      </div>
                    </div>
                    <p className="text-yellow-400 font-black text-base truncate">{topPlayers[0]?.username}</p>
                    <p className="text-yellow-400/60 font-bold text-xs">{topPlayers[0]?.score?.toLocaleString()} نقطة</p>
                    <div className="mt-2 h-32 bg-gradient-to-t from-yellow-500/20 to-transparent rounded-t-xl border-t-2 border-yellow-500/40 flex items-center justify-center">
                      <Trophy size={32} className="text-yellow-500/60" />
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="text-center flex-1 max-w-[160px]">
                    <div className="relative inline-block mb-3">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 p-1 shadow-[0_0_20px_rgba(180,83,9,0.3)]">
                        <div className="w-full h-full rounded-full bg-black/80 flex items-center justify-center overflow-hidden">
                          <ProAvatar url={topPlayers[2]?.avatar_url} username={topPlayers[2]?.username || ''} frameUrl={topPlayers[2]?.active_frame_url} size="w-full h-full" className="!overflow-visible" />
                        </div>
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center">
                        <span className="text-black font-black text-xs">3</span>
                      </div>
                    </div>
                    <p className="text-white font-black text-sm truncate">{topPlayers[2]?.username}</p>
                    <p className="text-amber-600 font-bold text-xs">{topPlayers[2]?.score?.toLocaleString()} نقطة</p>
                    <div className="mt-2 h-16 bg-gradient-to-t from-amber-700/20 to-transparent rounded-t-xl border-t-2 border-amber-700/40 flex items-center justify-center">
                      <Award size={20} className="text-amber-700/60" />
                    </div>
                  </div>
                </div>
              )}

              {/* Full Table */}
              <div className="bg-black/30 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
                <div className="grid grid-cols-[60px_1fr_100px_80px] md:grid-cols-[80px_1fr_120px_100px_80px] gap-4 px-6 py-4 border-b border-white/5 text-white/30 font-bold text-xs uppercase tracking-widest">
                  <span className="text-center">المركز</span>
                  <span>اللاعب</span>
                  <span className="text-center">النقاط</span>
                  <span className="text-center hidden md:block">الفوزات</span>
                  <span className="text-center">المركز</span>
                </div>
                {filteredLeaderboard.map((player, i) => {
                  const rank = leaderboardSearch ? leaderboardData.findIndex(p => p.username === player.username) + 1 : i + 1;
                  const medals = ['text-yellow-500', 'text-gray-300', 'text-amber-600'];
                  return (
                    <div key={player.username} className={`grid grid-cols-[60px_1fr_100px_80px] md:grid-cols-[80px_1fr_120px_100px_80px] gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-center ${rank <= 3 ? 'bg-white/[0.01]' : ''}`}>
                      <span className={`text-center font-black text-lg ${rank <= 3 ? medals[rank - 1] : 'text-white/20'}`}>
                        {rank <= 3 ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉') : rank}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 shrink-0">
                          <ProAvatar url={player.avatar_url} username={player.username || ''} frameUrl={player.active_frame_url} size="w-9 h-9" />
                        </div>
                        <span className="font-black text-white truncate">{player.username}</span>
                      </div>
                      <span className={`text-center font-black ${rank <= 3 ? 'text-yellow-400' : 'text-white/60'}`}>{player.score?.toLocaleString()}</span>
                      <span className="text-center font-bold text-white/40 hidden md:block">{player.wins || 0}</span>
                      <span className={`text-center font-black text-sm ${rank <= 3 ? medals[rank - 1] : 'text-white/10'}`}>
                        #{rank}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ============ ALL GAMES SECTION ============ */}
      <section id="all-games" data-animate-section className={`relative py-14 md:py-32 px-4 transition-all duration-1000 ${visibleSections.has('all-games') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 md:mb-12">
            <span className="text-amber-700 font-black uppercase tracking-[0.3em] text-xs">الألعاب</span>
            <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter mt-4 mb-4">
              <span className="text-white">كل الألعاب في </span>
              <span className="text-amber-700">الساحة</span>
            </h2>
            <p className="text-white/40 font-bold max-w-2xl mx-auto">اختر من أكثر من 25 لعبة تفاعلية — اضغط على أي لعبة لمعرفة المزيد</p>
            <div className="h-1 w-20 mx-auto bg-gradient-to-r from-transparent via-amber-700 to-transparent mt-4" />
          </div>

          {/* Search + Filter */}
          <div className="max-w-3xl mx-auto mb-10 space-y-4">
            <div className="relative">
              <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="ابحث عن لعبة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl pr-12 pl-4 py-4 text-white font-bold placeholder:text-white/30 focus:outline-none focus:border-amber-700/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2 rounded-full font-black text-sm transition-all ${
                    selectedCategory === cat
                      ? 'bg-amber-800 text-white shadow-[0_0_20px_rgba(139,69,19,0.4)]'
                      : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/70'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredGames.map((game, i) => (
              <button
                key={i}
                onClick={() => setActiveGame(activeGame === i ? null : i)}
                className={`relative text-right rounded-3xl p-6 transition-all duration-500 group overflow-hidden ${
                  activeGame === i ? 'shadow-[0_0_50px_rgba(139,69,19,0.4)] border-amber-700/80 bg-red-950/80 scale-[1.02]' : 'bg-[#0a0000]/90 hover:bg-[#120000]/90 border-red-900/40 hover:border-amber-700/80 hover:shadow-[0_0_40px_rgba(239,68,68,0.2)] hover:-translate-y-2'
                } border backdrop-blur-2xl`}
                style={{ boxShadow: activeGame === i ? `0 20px 50px -10px ${game.glowColor}` : '0 10px 40px -10px rgba(0,0,0,0.8)' }}
              >
                <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-white/[0.05] via-white/[0.01] to-transparent pointer-events-none rounded-t-3xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-4 bg-black/60 border border-amber-700/20 rounded-full p-2 pr-2 group-hover:bg-black/80 group-hover:border-amber-700/60 transition-all duration-500 shadow-inner">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${game.color} flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500 border border-white/20`}>
                      <game.icon size={22} className="text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-black text-xl leading-none tracking-wider truncate">{game.name}</h3>
                      <span className="text-white/20 font-bold text-[10px] uppercase tracking-widest">{game.nameEn}</span>
                    </div>
                    <span className="text-white/20 text-[10px] font-black px-2 py-1 rounded-full bg-white/5 border border-white/5 shrink-0">{game.category}</span>
                  </div>
                  <div className="mt-5 px-2 text-right">
                    <p className="text-red-100/60 font-bold text-sm leading-loose line-clamp-3">{game.description}</p>
                  </div>
                  <div className={`overflow-hidden transition-all duration-500 ${activeGame === i ? 'max-h-[300px] opacity-100 mt-5' : 'max-h-0 opacity-0'}`}>
                    <div className="border-t border-amber-700/20 pt-5 px-1">
                      <div className="bg-[#050000]/90 rounded-2xl p-4 border border-amber-700/20 relative overflow-hidden shadow-inner">
                        <div className="absolute inset-0 bg-amber-700/10 blur-2xl pointer-events-none" />
                        <div className="relative z-10">
                          <span className="text-amber-700 font-black text-xs uppercase tracking-[0.2em] drop-shadow-md">طريقة اللعب</span>
                          <p className="text-white/80 font-bold text-xs leading-relaxed mt-3">{game.howToPlay}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {filteredGames.length === 0 && (
            <div className="text-center py-16">
              <Search size={48} className="text-white/10 mx-auto mb-4" />
              <p className="text-white/30 font-black text-xl">لا توجد نتائج</p>
              <p className="text-white/20 font-bold text-sm mt-2">جرّب كلمة بحث مختلفة أو اختر فئة أخرى</p>
            </div>
          )}
        </div>
      </section>

      {/* ============ TECH & DEVELOPERS SECTION ============ */}
      <section id="tech-stack" data-animate-section className={`relative py-14 md:py-32 px-4 transition-all duration-1000 ${visibleSections.has('tech-stack') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/5 to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-8 md:mb-16">
            <span className="text-cyan-500 font-black uppercase tracking-[0.3em] text-xs">التقنيات</span>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 mb-4">
              <span className="text-white">نبني </span>
              <span className="text-cyan-500">بأحدث التقنيات</span>
            </h2>
            <p className="text-white/40 font-bold max-w-xl mx-auto">منصة مبنية على أحدث التقنيات لتجربة تفاعلية سلسة</p>
            <div className="h-1 w-20 mx-auto bg-gradient-to-r from-transparent via-cyan-500 to-transparent mt-4" />
          </div>

          {/* Tech Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {[
              { name: 'React', desc: 'الإطار الرئيسي', icon: '⚛️', color: 'from-cyan-400 to-blue-500' },
              { name: 'TypeScript', desc: 'أمان الكود', icon: '📘', color: 'from-blue-500 to-indigo-600' },
              { name: 'Supabase', desc: 'قاعدة بيانات', icon: '🗄️', color: 'from-green-500 to-emerald-600' },
              { name: 'Tailwind', desc: 'تصميم سريع', icon: '🎨', color: 'from-cyan-500 to-teal-500' },
              { name: 'Kick API', desc: 'بث مباشر', icon: '📡', color: 'from-green-600 to-green-800' },
              { name: 'Vite', desc: 'بناء سريع', icon: '⚡', color: 'from-yellow-500 to-amber-600' },
              { name: 'Node.js', desc: 'سيرفر خلفي', icon: '🟢', color: 'from-green-600 to-emerald-700' },
              { name: 'WebSocket', desc: 'اتصال مباشر', icon: '🔗', color: 'from-purple-500 to-violet-600' },
            ].map((tech, i) => (
              <div key={i} className="group relative bg-black/40 backdrop-blur-xl border border-white/5 hover:border-cyan-500/30 rounded-2xl p-5 text-center transition-all duration-500 hover:scale-105 hover:-translate-y-2">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{tech.icon}</div>
                <h3 className="text-white font-black text-sm mb-1">{tech.name}</h3>
                <p className="text-white/30 font-bold text-[10px] uppercase tracking-widest">{tech.desc}</p>
                <div className={`absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r ${tech.color} scale-x-0 group-hover:scale-x-100 transition-transform duration-500`} />
              </div>
            ))}
          </div>

          {/* Developer Section */}
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/10 rounded-[2rem] p-8 md:p-10 text-center relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-60 h-60 bg-cyan-500/5 blur-[80px] rounded-full" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-blue-500/5 blur-[80px] rounded-full" />
            <div className="relative z-10">
              <span className="text-cyan-500 font-black uppercase tracking-[0.3em] text-xs">المطورون</span>
              <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter mt-4 mb-6">
                <span className="text-white">فريق </span>
                <span className="text-cyan-500">ABS</span>
              </h2>
              <p className="text-white/50 font-bold max-w-2xl mx-auto mb-8 leading-relaxed">
                منصة ABS ARENA تم تطويرها بشغف وحب من فريق iABS لتقديم أفضل تجربة ألعاب تفاعلية للمجتمع العربي.
                نحن نعمل باستمرار على تطوير المنصة وإضافة ألعاب وميزات جديدة.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <div className="flex items-center gap-3 bg-black/60 border border-white/5 rounded-xl px-5 py-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-700 to-amber-800 flex items-center justify-center">
                    <span className="text-white font-black text-lg">i</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-black text-sm">iABS Team</p>
                    <p className="text-white/30 font-bold text-[10px] uppercase tracking-widest">مطور المنصة</p>
                  </div>
                </div>
                <a href="https://kick.com/iabs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 bg-black/60 border border-green-500/20 rounded-xl text-green-400 font-black text-sm hover:border-green-500/50 transition-all hover:scale-105">
                  <Play size={16} />
                  @iABS on Kick
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ SECTION ============ */}
      <section id="faq" data-animate-section className={`relative py-14 md:py-32 px-4 transition-all duration-1000 ${visibleSections.has('faq') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-8 md:mb-16">
            <span className="text-orange-500 font-black uppercase tracking-[0.3em] text-xs">استفسارات</span>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mt-4 mb-4">
              <span className="text-white">الأسئلة </span>
              <span className="text-orange-500">الشائعة</span>
            </h2>
            <p className="text-white/40 font-bold max-w-xl mx-auto">أجوبة على أكثر الأسئلة تردداً عن المنصة</p>
            <div className="h-1 w-20 mx-auto bg-gradient-to-r from-transparent via-orange-500 to-transparent mt-4" />
          </div>

          <div className="space-y-4" dir="rtl">
            {[
              { q: 'هل أحتاج حساب للمشاركة في الألعاب؟', a: 'لا، كل اللي تحتاجه هو متابعة البث المباشر لـ iABS على Kick.com والكتابة في الشات. الألعاب مفتوحة للجميع.' },
              { q: 'كيف أربح النقاط في الألعاب؟', a: 'كل إجابة صحيحة في أي لعبة تمنحك نقاط. كل ما كانت الإجابة أسرع، كل ما كسبت نقاط أكثر. النقاط تظهر فوراً في لوحة الصدارة.' },
              { q: 'هل يمكنني شراء الإطارات بدون حساب؟', a: 'تحتاج إلى حساب لشراء الإطارات. يمكنك تسجيل حساب جديد في قسم "انضم إلى الساحة" وتجميع النقاط للمشاركة في المتجر.' },
              { q: 'وين أقدر أتابع البث المباشر؟', a: 'جميع البثوث تكون على قناة iABS في منصة Kick.com. تقدر تتابعنا على الرابط kick.com/iabs.' },
              { q: 'هل الألعاب متاحة على الجوال؟', a: 'نعم، المنصة مصممة خصيصاً لتكون متجاوبة مع جميع الأجهزة بما فيها الجوالات والأجهزة اللوحية.' },
              { q: 'كيف أقدر أتواصل مع الإدارة؟', a: 'تقدر تتواصل معنا عبر شات البث المباشر أو من خلال حساب iABS على منصة Kick.' },
            ].map((faq, i) => (
              <div key={i} className="bg-black/40 backdrop-blur-xl border border-white/5 hover:border-orange-500/20 rounded-2xl overflow-hidden transition-all duration-500">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-right"
                >
                  <span className="text-white font-black text-base flex-1">{faq.q}</span>
                  <ChevronDown size={20} className={`text-white/30 transition-all duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-500 ${openFaq === i ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="px-6 pb-5">
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent mb-4" />
                    <p className="text-white/60 font-bold text-sm leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ KICK EXCLUSIVE ============ */}
      <section id="kick-exclusive" data-animate-section className={`relative py-14 md:py-32 px-4 transition-all duration-1000 ${visibleSections.has('kick-exclusive') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-950/5 to-transparent" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="bg-gradient-to-br from-green-900/20 to-black/50 border border-green-500/20 rounded-[3rem] p-10 md:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-[100px] rounded-full" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-green-500/5 blur-[80px] rounded-full" />
            <div className="relative z-10 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full mb-8">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-500 font-black text-xs uppercase tracking-widest">حصرياً على Kick</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-6">
                <span className="text-white">كل شي يصير في </span>
                <span className="text-green-500">بث iABS</span>
              </h2>
              <p className="text-white/50 font-bold text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
                جميع الألعاب والفعاليات والمسابقات تصير حصرياً أثناء البث المباشر لقناة{' '}
                <span className="text-green-500 font-black">iABS</span> على منصة Kick.com. تابع البث، شارك بالألعاب، واكسب النقاط!
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {[
                  { icon: Zap, label: 'نقاط حقيقية', desc: 'اكسب نقاط من كل لعبة تفوز فيها' },
                  { icon: Sparkles, label: 'إطارات حصرية', desc: 'اشترٍ إطارات مميزة من المتجر' },
                  { icon: Users2, label: 'مجتمع نشط', desc: 'انضم لأقوى مجتمع بث عربي' },
                ].map((item, i) => (
                  <div key={i} className="bg-black/30 border border-green-500/10 rounded-2xl p-6 hover:border-green-500/30 transition-all text-center">
                    <item.icon size={28} className="text-green-500 mb-3 mx-auto" />
                    <h3 className="text-white font-black mb-1">{item.label}</h3>
                    <p className="text-white/30 font-bold text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>
              <a href="https://kick.com/iabs" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-3 px-12 py-5 bg-gradient-to-r from-green-600 to-green-700 rounded-2xl font-black text-xl text-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(22,163,74,0.4)] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[-20deg]" />
                <Play size={24} className="relative z-10" />
                <span className="relative z-10">kick.com/iabs</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TERMS OF SERVICE MODAL ============ */}
      {showTerms && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setShowTerms(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <div 
            className="relative z-10 max-w-2xl w-full bg-gradient-to-b from-[#1a0000] to-black border border-amber-700/30 rounded-[2rem] p-8 md:p-10 max-h-[85vh] overflow-y-auto shadow-[0_0_80px_rgba(239,68,68,0.2)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-700 to-amber-800 flex items-center justify-center">
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-black text-xl">شروط الاستخدام</h3>
                  <p className="text-white/30 font-bold text-xs">TERMS OF SERVICE</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTerms(false)}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-amber-700/20 hover:border-amber-700/30 transition-all"
              >
                <X size={18} className="text-white/60" />
              </button>
            </div>

            <div className="space-y-6 text-right" dir="rtl">
              {[
                {
                  title: '١. قبول الشروط',
                  content: 'باستخدامك لمنصة ABS ARENA، فإنك توافق على هذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يجب عليك التوقف عن استخدام المنصة فوراً.'
                },
                {
                  title: '٢. التسجيل والحسابات',
                  content: 'عند إنشاء حساب في المنصة، يجب عليك تقديم معلومات دقيقة وكاملة. أنت مسؤول عن الحفاظ على سرية كلمة المرور الخاصة بك وعن جميع الأنشطة التي تحدث تحت حسابك. يحق لنا تعليق أو إلغاء أي حساب يخالف هذه الشروط.'
                },
                {
                  title: '٣. استخدام الشات',
                  content: 'باستخدامك لشات القناة، فإنك توافق على الالتزام بقواعد السلوك العامة. يمنع إرسال أي محتوى مسيء أو مخالف للقوانين. إدارة القناة تحتفظ بالحق في حظر أي مستخدم يخالف القواعد دون سابق إنذار.'
                },
                {
                  title: '٤. النقاط والمكافآت',
                  content: 'النقاط التي تكسبها من الألعاب هي افتراضية وليس لها قيمة نقدية. النقاط غير قابلة للتحويل أو الاسترداد نقداً. نحتفظ بالحق في تعديل أو إلغاء أي نقاط في حال ثبوت أي تلاعب أو احتيال.'
                },
                {
                  title: '٥. المشتريات داخل المنصة',
                  content: 'جميع المشتريات داخل المنصة (مثل الإطارات والشارات) تتم باستخدام النقاط التي كسبتها من الألعاب. المبيعات نهائية وغير قابلة للاسترداد. نحتفظ بالحق في تعديل الأسعار في أي وقت.'
                },
                {
                  title: '٦. حقوق الملكية الفكرية',
                  content: 'جميع المحتويات المعروضة في المنصة بما في ذلك الألعاب والتصميمات والشعارات هي ملك حصري لـ iABS. يمنع نسخ أو توزيع أو استخدام أي من هذه المحتويات دون إذن كتابي مسبق.'
                },
                {
                  title: '٧. تعديل الشروط',
                  content: 'نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سنقوم بإشعار المستخدمين بأي تغييرات جوهرية. استمرار استخدام المنصة بعد التعديلات يعني موافقتك على الشروط المعدلة.'
                },
              ].map((section, i) => (
                <div key={i} className="bg-black/40 border border-white/5 hover:border-amber-700/20 rounded-xl p-5 transition-all duration-300">
                  <h4 className="text-amber-700 font-black text-base mb-2">{section.title}</h4>
                  <p className="text-white/50 font-bold text-sm leading-relaxed">{section.content}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-white/30 font-bold text-xs mb-4">
                آخر تحديث: {new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <button
                onClick={() => setShowTerms(false)}
                className="px-8 py-3 bg-gradient-to-r from-amber-800 to-amber-900 rounded-xl font-black text-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(139,69,19,0.4)]"
              >
                أوافق على الشروط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ FOOTER ============ */}
      <footer className="relative py-20 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-6">
            <img src="/logo2.png" className="h-20 mx-auto opacity-30" alt="ABS ARENA" />
          </div>
          <p className="text-white/20 font-black text-base mb-2"><span className="text-amber-700">ABS </span>ARENA — أكبر منصة ألعاب تفاعلية للبثوث المباشرة</p>
          <p className="text-white/10 font-bold text-xs">
            جميع الحقوق محفوظة © {new Date().getFullYear()} iABS ARENA
          </p>
        </div>
      </footer>
    </div>
  );
};
