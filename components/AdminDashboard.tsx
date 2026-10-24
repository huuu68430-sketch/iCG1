
import React, { useState, useEffect } from 'react';
import {
  Shield, Trash2, Key, Database, Save, AlertTriangle,
  UserPlus, UserMinus, Search, Star, Ban, Unlock,
  Megaphone, Activity, History, Settings, Users,
  Zap, Palette, Eye, EyeOff, RotateCw, Trophy,
  Music, Sparkles, Wind, Flame, Ticket, Fingerprint,
  Users2, Gavel, Radio, LayoutDashboard, Terminal, X, Clock, LogOut, ShoppingBag, Edit, Edit3, Plus, Upload, Brain, Bot
} from 'lucide-react';
import { uploadToCloudinary } from '../services/cloudinaryService';
import { leaderboardService, adminService, supabase, supabaseQuery } from '../services/supabase';
import { chatService } from '../services/chatService';
import { ProAvatar } from './ProAvatar';
import { BotDashboard } from './BotDashboard';

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'bans' | 'announcements' | 'arena' | 'promo' | 'logs' | 'system' | 'store' | 'mahmah' | 'higher_lower' | 'bot_control'>('overview');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [arenaStatus, setArenaStatus] = useState<any>({});
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Mahmah States
  const [mahmahCategories, setMahmahCategories] = useState<any[]>([]);
  const [mahmahQuestions, setMahmahQuestions] = useState<any[]>([]);
  const [selectedMahmahCategory, setSelectedMahmahCategory] = useState<any>(null);
  const [selectedMahmahStage, setSelectedMahmahStage] = useState<number>(0);
  const [isAddingMahmahCategory, setIsAddingMahmahCategory] = useState(false);
  const [isAddingMahmahQuestion, setIsAddingMahmahQuestion] = useState(false);
  const [editingMahmahQuestion, setEditingMahmahQuestion] = useState<any>(null);
  const [newMahmahCategory, setNewMahmahCategory] = useState({ name: '', image_url: '', num_stages: 1 });
  const [newMahmahQuestion, setNewMahmahQuestion] = useState({ points: 100, order_number: 1, text: '', answer: '', media_url: '', media_type: '' as string, answer_media_url: '', answer_media_type: '' as string });
  const [uploadingQuestionMedia, setUploadingQuestionMedia] = useState(false);
  const [uploadingAnswerImage, setUploadingAnswerImage] = useState(false);
  
  // Higher/Lower States
  const [hlQuestions, setHlQuestions] = useState<any[]>([]);
  const [selectedHlStage, setSelectedHlStage] = useState<number | null>(null);
  const [isAddingHlQuestion, setIsAddingHlQuestion] = useState(false);
  const [newHlQuestion, setNewHlQuestion] = useState({ text: '', is_higher: true, fact: '' });
  
  const [showInactive, setShowInactive] = useState(false);

  const [targetUser, setTargetUser] = useState('');
  const [pointDelta, setPointDelta] = useState(100);
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statType, setStatType] = useState<'points' | 'credits' | 'wins'>('points');

  const [banReason, setBanReason] = useState('مخالفة قوانين الدردشة');
  const [searchQuery, setSearchQuery] = useState('');

  const [newPromo, setNewPromo] = useState({ code: '', amount: 1000, maxUses: 10 });
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [chatMonitorActive, setChatMonitorActive] = useState(false);
  const [chatStatus, setChatStatus] = useState<{ connected: boolean; error: boolean; details?: string }>({ connected: false, error: false });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    const validateSession = async () => {
      let raw = localStorage.getItem('admin_access_granted');
      if (!raw) {
        const siteAuth = localStorage.getItem('site_access_granted');
        if (siteAuth) {
          const parsedSite = JSON.parse(siteAuth);
          if (parsedSite.role === 'admin') {
            localStorage.setItem('admin_access_granted', siteAuth);
            raw = siteAuth;
          }
        }
      }
      let token: string | null = null;
      if (raw) {
        try { const parsed = JSON.parse(raw); token = parsed?.token || null; } catch { }
      }
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'admin_password')
        .maybeSingle();
      if (error) { console.warn("[AdminAuth] Supabase check failed, skipping validation."); return; }
      if (data && token) {
        const dbPass = String(data.value).trim();
        const sessionPass = String(token).trim();
        if (sessionPass !== dbPass) {
          console.error("[AdminAuth] Password mismatch. Revoking access.");
          localStorage.removeItem('admin_access_granted');
          onLogout();
        }
      }
    };
    validateSession();
    const channel = supabase
      .channel('admin_password_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, validateSession)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const channel = 'iabs';
    chatService.connect(channel);
    setChatMonitorActive(true);
    const unbindStatus = chatService.onStatusChange((connected, error, details) => {
      setChatStatus({ connected, error, details });
    });
    return () => {
      unbindStatus();
      setChatMonitorActive(false);
    };
  }, []);

  useEffect(() => {
    const unbindMsg = chatService.onMessage(async (msg) => {
      const raw = msg.content.trim().toUpperCase();
      const matched = promoCodes.find(p => p.is_active && (raw === p.code.toUpperCase() || raw === `!${p.code.toUpperCase()}`));
      if (matched) {
        const res = await leaderboardService.claimPromoCode(msg.user.username, matched.code);
        if ((res as any).success) {
          showStatus(`✅ تم تفعيل الكود ${matched.code} للمستخدم ${msg.user.username}`);
          fetchData();
        }
      }
    });
    return () => unbindMsg();
  }, [promoCodes]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: promos } = await adminService.getPromoCodes();
      setPromoCodes(promos || []);
      if (activeTab === 'users' || activeTab === 'overview' || activeTab === 'bans') {
        const { data: allProfiles } = await adminService.getAllProfiles();
        const rankedData = await leaderboardService.getAllRankedPlayers();
        const statsMap = new Map();
        rankedData.forEach((p: any) => { statsMap.set(p.username?.toLowerCase(), { score: p.score, wins: p.wins }); });
        const merged = allProfiles.map((p: any) => {
          const stats = statsMap.get(p.username?.toLowerCase()) || { score: 0, wins: 0 };
          return { ...p, ...stats };
        });
        merged.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
        setProfiles(merged);
        const { data: recentLogs } = await adminService.getAuditLogs(200);
        setLogs(recentLogs);
      }
      if (activeTab === 'announcements') { const { data } = await adminService.getAnnouncements(); setAnnouncements(data); }
      if (activeTab === 'logs') { const { data } = await adminService.getAuditLogs(); setLogs(data); }
      if (activeTab === 'arena') { const { status } = await adminService.getArenaStatus(); setArenaStatus(status); }
      if (activeTab === 'store') { const result = await supabaseQuery(() => supabase.from('store_items').select('*').order('type', { ascending: true }).order('price', { ascending: true })); setStoreItems(result.data || []); }
      if (activeTab === 'mahmah') {
        const [cResult, qResult] = await Promise.all([
          supabaseQuery(() => supabase.from('mahmah_categories').select('*').order('created_at', { ascending: false })),
          supabaseQuery(() => supabase.from('mahmah_questions').select('*').order('created_at', { ascending: true })),
        ]);
        if (cResult.data) setMahmahCategories(cResult.data);
        if (qResult.data) setMahmahQuestions(qResult.data);
      }
      if (activeTab === 'higher_lower') { const result = await supabaseQuery(() => supabase.from('higher_lower_questions').select('*').order('stage_number', { ascending: true }).order('id', { ascending: true })); if (result.data) setHlQuestions(result.data); }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  const showStatus = (msg: string, err = false) => {
    setStatusMsg(msg);
    setIsError(err);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleAdjustStats = async (isAdding: boolean, customAmount?: number) => {
    if (!targetUser) return showStatus('يرجى إدخال اسم المستخدم', true);
    const amount = customAmount !== undefined ? (isAdding ? customAmount : -customAmount) : (isAdding ? pointDelta : -pointDelta);
    let error;
    if (statType === 'points') { const res = await leaderboardService.adjustPlayerStats(targetUser, amount, 0); error = res.error; }
    else if (statType === 'wins') { const res = await leaderboardService.adjustPlayerStats(targetUser, 0, amount); error = res.error; }
    else { const res = await adminService.adjustCredits(targetUser, amount); error = res.error; }
    if (error) { showStatus('حدث خطأ: ' + (typeof error === 'string' ? error : (error.message || 'فشلت العملية')), true); }
    else { showStatus(`تم تحديث بيانات ${targetUser}`); await fetchData(); }
  };

  const handleResetUser = async (username: string) => {
    if (!confirm(`هل أنت متأكد من تصفير جميع بيانات ${username}؟`)) return;
    await leaderboardService.adjustPlayerStats(username, -999999, -999999);
    const { data: p } = await adminService.getAllProfiles();
    const userProf = p.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
    if (userProf && userProf.credits > 0) { await adminService.adjustCredits(username, -userProf.credits); }
    await adminService.logAction('CORE_ADMIN', 'RESET_USER_STATS', { username });
    showStatus(`تم تصفير بيانات ${username}`);
    fetchData();
  };

  const handleToggleBan = async (username: string, currentBan: boolean) => {
    if (!currentBan) {
      if (!confirm(`تحذير خطير: هل أنت متأكد من حظر وحذف وتصفير جميع بيانات ${username} نهائياً؟`)) return;
      // Delete completely from leaderboard
      await supabase.from('leaderboard').delete().ilike('username', username);
      // Zero out credits
      await supabase.from('profiles').update({ credits: 0 }).ilike('username', username);
    }
    const { error } = await adminService.toggleUserBan(username, !currentBan, banReason);
    if (error) showStatus('خطأ في العملية', true);
    else { showStatus(currentBan ? `تم فك حظر ${username}` : `تم حظر ${username} وتدمير سجلاته بالكامل`); fetchData(); }
  };

  const updateArena = async (key: string, value: any) => {
    const { error } = await adminService.updateArenaStatus(key, value);
    if (error) showStatus('فشل التحديث', true);
    else { showStatus('تم تحديث إعدادات الساحة'); fetchData(); }
  };

  const handleSaveStoreItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsLoading(true);
    
    if (editingItem.id) {
      const { error } = await supabase.from('store_items').update({
        name: editingItem.name,
        description: editingItem.description,
        price: editingItem.price,
        image_url: editingItem.image_url,
        type: editingItem.type,
        is_active: editingItem.is_active,
        config: typeof editingItem.config === 'string' ? editingItem.config : JSON.stringify(editingItem.config || {})
      }).eq('id', editingItem.id);
      
      if (error) showStatus('خطأ في التحديث', true);
      else { showStatus('تم التحديث بنجاح'); setEditingItem(null); fetchData(); }
    } else {
      const insertData: any = {
        name: editingItem.name,
        description: editingItem.description || '',
        price: editingItem.price,
        image_url: editingItem.image_url,
        type: editingItem.type,
        is_active: editingItem.is_active !== undefined ? editingItem.is_active : true,
        config: typeof editingItem.config === 'string' ? editingItem.config : JSON.stringify(editingItem.config || {})
      };
      
      const { error } = await supabase.from('store_items').insert([insertData]);
      
      if (error) {
        console.error('Insert error:', JSON.stringify(error));
        showStatus(`خطأ في الإضافة: ${error.message || error.details || 'unknown'}`, true);
      } else { 
        showStatus('تمت الإضافة بنجاح'); setEditingItem(null); fetchData(); 
      }
    }
    setIsLoading(false);
  };

  const handleSaveMahmahCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMahmahCategory.name || !newMahmahCategory.image_url) return showStatus('يرجى إدخال اسم الفئة وصورتها', true);
    setIsLoading(true);
    const { error } = await supabase.from('mahmah_categories').insert([{ name: newMahmahCategory.name, image_url: newMahmahCategory.image_url, num_stages: newMahmahCategory.num_stages }]);
    if (error) showStatus('خطأ في الإضافة: ' + error.message, true);
    else { showStatus('تمت الإضافة بنجاح'); setIsAddingMahmahCategory(false); setNewMahmahCategory({ name: '', image_url: '', num_stages: 1 }); fetchData(); }
    setIsLoading(false);
  };

  const handleSaveMahmahQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMahmahCategory || !newMahmahQuestion.text || !newMahmahQuestion.answer) return showStatus('يرجى ملء جميع الحقول', true);
    setIsLoading(true);
    const insertData: any = { category_id: selectedMahmahCategory.id, points: newMahmahQuestion.points, order_number: newMahmahQuestion.order_number, text: newMahmahQuestion.text, answer: newMahmahQuestion.answer };
    if (newMahmahQuestion.media_url) { insertData.media_url = newMahmahQuestion.media_url; insertData.media_type = newMahmahQuestion.media_type || 'image'; }
    if (newMahmahQuestion.answer_media_url) { insertData.answer_media_url = newMahmahQuestion.answer_media_url; insertData.answer_media_type = newMahmahQuestion.answer_media_type || 'image'; }
    const { error } = await supabase.from('mahmah_questions').insert([insertData]);
    if (error) showStatus('خطأ في الإضافة: ' + error.message, true);
    else { showStatus('تمت الإضافة بنجاح'); setIsAddingMahmahQuestion(false); const nextLocal = (mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id).filter(q => { const stageStart = selectedMahmahStage * 6; const ord = q.order_number || 1; return ord >= stageStart + 1 && ord <= stageStart + 6; }).length + 1); setNewMahmahQuestion({ points: 100, order_number: nextLocal <= 6 ? selectedMahmahStage * 6 + nextLocal : selectedMahmahStage * 6 + 1, text: '', answer: '', media_url: '', media_type: '', answer_media_url: '', answer_media_type: '' }); fetchData(); }
    setIsLoading(false);
  };

  const handleDeleteMahmahCategory = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف الفئة؟ (سيتم حذف جميع أسئلتها أيضاً)')) return;
    setIsLoading(true);
    const { error } = await supabase.from('mahmah_categories').delete().eq('id', id);
    if (error) showStatus('خطأ في الحذف: ' + error.message, true);
    else { showStatus('تم الحذف بنجاح'); if(selectedMahmahCategory?.id === id) setSelectedMahmahCategory(null); fetchData(); }
    setIsLoading(false);
  };

  const handleUpdateNumStages = async (catId: string, numStages: number) => {
    setIsLoading(true);
    const { error } = await supabase.from('mahmah_categories').update({ num_stages: numStages }).eq('id', catId);
    if (error) showStatus('خطأ في التعديل: ' + error.message, true);
    else { showStatus('تم تحديث المراحل'); fetchData(); }
    setIsLoading(false);
  };

  const handleDeleteMahmahQuestion = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف السؤال؟')) return;
    setIsLoading(true);
    const { error } = await supabase.from('mahmah_questions').delete().eq('id', id);
    if (error) showStatus('خطأ في الحذف: ' + error.message, true);
    else { showStatus('تم الحذف بنجاح'); fetchData(); }
    setIsLoading(false);
  };

  const handleUpdateMahmahOrder = async (id: string, newOrder: number) => {
    setIsLoading(true);
    const { error } = await supabase.from('mahmah_questions').update({ order_number: newOrder }).eq('id', id);
    if (error) showStatus('خطأ في التعديل: ' + error.message, true);
    else { showStatus('تم التعديل بنجاح'); fetchData(); }
    setIsLoading(false);
  };

  const handleAutoAssignOrder = async () => {
    if (!selectedMahmahCategory) return;
    setIsLoading(true);
    const catQs = mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id).sort((a,b) => (a.points || 0) - (b.points || 0) || new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    const updates = catQs.map((q, i) => supabase.from('mahmah_questions').update({ order_number: i + 1 }).eq('id', q.id));
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);
    if (hasError) showStatus('خطأ في التحديث', true);
    else { showStatus('تم ترتيب الأسئلة تلقائياً'); fetchData(); }
    setIsLoading(false);
  };

  const handleAddMahmahStage = async () => {
    if (!selectedMahmahCategory) return;
    const newCount = (selectedMahmahCategory.num_stages || 1) + 1;
    setIsLoading(true);
    const { error } = await supabase.from('mahmah_categories').update({ num_stages: newCount }).eq('id', selectedMahmahCategory.id);
    if (error) showStatus('خطأ: ' + error.message, true);
    else { showStatus(`تمت إضافة المرحلة ${newCount}`); setSelectedMahmahCategory({ ...selectedMahmahCategory, num_stages: newCount }); fetchData(); }
    setIsLoading(false);
  };

  const handleSetActiveStage = async (stageIdx: number) => {
    if (!selectedMahmahCategory) return;
    const key = `mahmah_active_stage_${selectedMahmahCategory.id}`;
    const val = String(stageIdx + 1);
    localStorage.setItem(key, val);
    console.log(`[Admin] Saved active_stage: key="${key}" value="${val}" readback="${localStorage.getItem(key)}"`);
    setIsLoading(true);
    try {
      const { error } = await supabase.from('mahmah_categories').update({ active_stage: stageIdx + 1 }).eq('id', selectedMahmahCategory.id);
      if (error) console.warn('[Mahmah] active_stage column may not exist, using localStorage');
    } catch { console.warn('[Mahmah] active_stage column not in DB, using localStorage'); }
    setSelectedMahmahCategory({ ...selectedMahmahCategory, active_stage: stageIdx + 1 });
    showStatus(`تم تحديد المرحلة ${stageIdx + 1} كمرحلة نشطة ▶`);
    setIsLoading(false);
  };

  const handleRemoveMahmahStage = async () => {
    if (!selectedMahmahCategory) return;
    const totalStages = selectedMahmahCategory.num_stages || 1;
    if (totalStages <= 1) return showStatus('لا يمكن حذف المرحلة الأخيرة', true);
    if (!confirm(`هل أنت متأكد من حذف المرحلة ${selectedMahmahStage + 1} وجميع أسئلتها؟`)) return;
    setIsLoading(true);
    const stageStart = selectedMahmahStage * 6 + 1;
    const stageEnd = stageStart + 5;
    const stageQs = mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id && (q.order_number || 1) >= stageStart && (q.order_number || 1) <= stageEnd);
    if (stageQs.length > 0) {
      const deletes = stageQs.map(q => supabase.from('mahmah_questions').delete().eq('id', q.id));
      await Promise.all(deletes);
    }
    const newNumStages = totalStages - 1;
    await supabase.from('mahmah_categories').update({ num_stages: newNumStages }).eq('id', selectedMahmahCategory.id);
    const allCatQs = mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id && !stageQs.find(sq => sq.id === q.id));
    const reorders = allCatQs.sort((a,b) => (a.order_number || 1) - (b.order_number || 1)).map((q, i) => supabase.from('mahmah_questions').update({ order_number: i + 1 }).eq('id', q.id));
    await Promise.all(reorders);
    setSelectedMahmahStage(Math.min(selectedMahmahStage, newNumStages - 1));
    setSelectedMahmahCategory({ ...selectedMahmahCategory, num_stages: newNumStages });
    showStatus('تم حذف المرحلة وترتيب الأسئلة');
    fetchData();
    setIsLoading(false);
  };

  const handleUpdateMahmahQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMahmahQuestion || !editingMahmahQuestion.text || !editingMahmahQuestion.answer) return showStatus('يرجى ملء جميع الحقول', true);
    setIsLoading(true);
    const updateData: any = { points: editingMahmahQuestion.points, order_number: editingMahmahQuestion.order_number, text: editingMahmahQuestion.text, answer: editingMahmahQuestion.answer };
    if (editingMahmahQuestion.media_url) { updateData.media_url = editingMahmahQuestion.media_url; updateData.media_type = editingMahmahQuestion.media_type || 'image'; }
    else { updateData.media_url = null; updateData.media_type = null; }
    if (editingMahmahQuestion.answer_media_url) { updateData.answer_media_url = editingMahmahQuestion.answer_media_url; updateData.answer_media_type = editingMahmahQuestion.answer_media_type || 'image'; }
    else { updateData.answer_media_url = null; updateData.answer_media_type = null; }
    const { error } = await supabase.from('mahmah_questions').update(updateData).eq('id', editingMahmahQuestion.id);
    if (error) showStatus('خطأ في التعديل: ' + error.message, true);
    else { showStatus('تم التعديل بنجاح'); setEditingMahmahQuestion(null); fetchData(); }
    setIsLoading(false);
  };

  const handleMoveMahmahQuestion = async (qId: string, newOrder: number) => {
    setIsLoading(true);
    const { error } = await supabase.from('mahmah_questions').update({ order_number: newOrder }).eq('id', qId);
    if (error) showStatus('خطأ في النقل: ' + error.message, true);
    else { showStatus('تم نقل السؤال'); fetchData(); }
    setIsLoading(false);
  };

  const handleSaveHlQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHlStage || !newHlQuestion.text) return showStatus('يرجى ملء جميع الحقول', true);
    setIsLoading(true);
    const insertData = { 
      stage_number: selectedHlStage, 
      question_text: newHlQuestion.text, 
      is_higher: newHlQuestion.is_higher, 
      fact: newHlQuestion.fact || null
    };
    
    const { error } = await supabase.from('higher_lower_questions').insert([insertData]);
    if (error) {
        console.error(error);
        showStatus('خطأ في الإضافة: ' + error.message, true);
    } else { 
        showStatus('تمت الإضافة بنجاح'); 
        setIsAddingHlQuestion(false); 
        setNewHlQuestion({ text: '', is_higher: true, fact: '' }); 
        fetchData(); 
    }
    setIsLoading(false);
  };

  const handleDeleteHlQuestion = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    setIsLoading(true);
    const { error } = await supabase.from('higher_lower_questions').delete().eq('id', id);
    if (error) showStatus('خطأ في الحذف: ' + error.message, true);
    else { showStatus('تم الحذف بنجاح'); fetchData(); }
    setIsLoading(false);
  };

  const handleDeleteStoreItem = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    setIsLoading(true);
    const { error } = await supabase.from('store_items').delete().eq('id', id);
    if (error) showStatus('حدث خطأ أثناء الحذف', true);
    else { fetchData(); showStatus('تم حذف العنصر بنجاح'); }
    setIsLoading(false);
  };

  const filteredProfiles = profiles.filter(p => p.username.toLowerCase().includes(searchQuery.toLowerCase()));

  const TABS = [
    { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, color: 'text-white' },
    { id: 'users', label: 'المتسابقين', icon: Users, color: 'text-blue-500' },
    { id: 'bans', label: 'المحظورين', icon: Gavel, color: 'text-red-500' },
    { id: 'announcements', label: 'البث', icon: Radio, color: 'text-orange-500' },
    { id: 'promo', label: 'الأكواد', icon: Ticket, color: 'text-yellow-500' },
    { id: 'store', label: 'المتجر', icon: ShoppingBag, color: 'text-emerald-500' },
    { id: 'mahmah', label: 'إدارة محمح', icon: Brain, color: 'text-indigo-500' },
    { id: 'higher_lower', label: 'إدارة أعلى/أقل', icon: Activity, color: 'text-pink-500' },
    { id: 'arena', label: 'الساحة', icon: Palette, color: 'text-purple-500' },
    { id: 'logs', label: 'السجل', icon: Terminal, color: 'text-zinc-400' },
    { id: 'system', label: 'الصيانة', icon: Settings, color: 'text-red-600' },
    { id: 'bot_control', label: 'تحكم البوت', icon: Bot, color: 'text-red-500' },
  ];

  return (
    <div className="icg1-admin w-full h-full bg-[#030303] text-white flex animate-in fade-in duration-700 font-sans overflow-hidden" dir="rtl">

      {/* SIDEBAR */}
      <div className="w-[240px] shrink-0 bg-gradient-to-b from-[#0a0a0a] via-zinc-950 to-[#0a0a0a] border-l border-white/5 flex flex-col p-4 relative z-50 shadow-2xl">
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-red-600 via-red-900/20 to-transparent opacity-20"></div>

        <div className="flex items-center gap-3 mb-8 px-2 mt-2">
          <div className="relative">
            <div className="absolute inset-0 bg-red-600 blur-lg opacity-40 animate-pulse"></div>
            <div className="relative z-10 w-10 h-10 bg-gradient-to-br from-red-600 to-red-900 rounded-xl flex items-center justify-center shadow-lg border border-red-500/20">
              <Shield size={20} className="text-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter text-white leading-none">iCG1 <span className="text-red-500">ADM</span></h1>
            <p className="text-[9px] text-zinc-500 font-bold tracking-[0.2em] uppercase mt-0.5">إدارة الساحة</p>
          </div>
        </div>

        <div className="space-y-1 flex-1 overflow-y-auto no-scrollbar">
          {TABS.map(tab => {
            const isAct = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative group text-right overflow-hidden ${isAct ? 'bg-white/[0.04] text-white border border-red-500/10 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] border border-transparent'}`}>
                
                {isAct && <div className="absolute right-0 top-0 w-1 h-full bg-gradient-to-b from-red-500 to-red-700 shadow-[0_0_10px_rgba(255,0,0,0.5)]"></div>}
                
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 relative z-10 ${isAct ? 'bg-gradient-to-br from-red-600 to-red-700 text-white shadow-md' : 'bg-transparent text-zinc-500 group-hover:text-zinc-400'}`}>
                  <tab.icon size={16} />
                </div>
                
                <div className="flex flex-col items-start relative z-10">
                  <span className={`font-black italic text-sm transition-colors ${isAct ? 'text-white' : ''}`}>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={onLogout} className="mt-4 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-500 hover:bg-red-950/30 hover:text-red-500 border border-transparent hover:border-red-900/30 transition-all active:scale-95 flex items-center justify-center gap-2 group">
          <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" /> Logout
        </button>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <div className="h-20 shrink-0 border-b border-white/5 flex items-center justify-between px-8 bg-gradient-to-r from-black via-zinc-900/50 to-black relative z-40">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-600 font-black uppercase tracking-wider">Global Operations</span>
              <span className="text-xl font-black italic uppercase tracking-tight text-white">{activeTab.replace('_', ' ')}</span>
            </div>
            <div className="h-8 w-px bg-white/10"></div>
            <div className="flex items-center gap-2.5 bg-green-500/5 px-3 py-1.5 rounded-xl border border-green-500/10">
              <div className="relative w-2.5 h-2.5">
                <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
                <div className="absolute inset-0 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
              </div>
              <span className="text-xs font-black text-green-400 italic tracking-wider">SYSTEM LIVE</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="p-2.5 bg-white/5 rounded-lg hover:bg-white/10 transition-all border border-white/5 hover:border-white/20">
              <RotateCw size={18} className={isLoading ? 'animate-spin text-red-500' : 'text-zinc-400'} />
            </button>
            <div className="bg-white/[0.03] px-4 py-2.5 rounded-xl border border-white/5">
              <span className="text-xs font-mono font-black text-zinc-500">SESSION: iABS-{Math.floor(Math.random() * 99999)}</span>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 md:p-10 custom-scrollbar bg-[radial-gradient(ellipse_at_top,rgba(255,0,0,0.03),transparent_70%)]">
          {statusMsg && (
            <div className={`fixed top-10 left-1/2 -translate-x-1/2 px-10 py-5 rounded-[2rem] font-black shadow-2xl z-[1000] animate-in slide-in-from-top-10 backdrop-blur-2xl border text-lg ${isError ? 'bg-red-600/90 border-red-400 text-white' : 'bg-green-600/90 border-green-400 text-white'}`}>
              <div className="flex items-center gap-3">{isError ? <AlertTriangle size={24} /> : <Shield size={24} />}{statusMsg}</div>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'إجمالي المسجلين', value: profiles.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                  { label: 'المحظورين حالياً', value: profiles.filter(p => p.is_banned).length, icon: Ban, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                  { label: 'الأرصدة المتداولة', value: profiles.reduce((acc, p) => acc + (p.credits || 0), 0), icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
                  { label: 'نقاط المتصدرين', value: profiles.reduce((acc, p) => acc + (p.score || 0), 0), icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
                ].map((stat, i) => (
                  <div key={i} className={`relative overflow-hidden rounded-2xl border ${stat.border} ${stat.bg} p-5 transition-all duration-500 hover:scale-[1.02] group bg-gradient-to-br from-black/80 to-black/40`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-500 shadow-lg shrink-0`}>
                        <stat.icon size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-0.5">{stat.label}</p>
                        <p className="text-2xl font-black italic text-white leading-none">{stat.value.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/[0.02] blur-xl"></div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent p-6">
                  <h3 className="text-xl font-black italic mb-4 flex items-center gap-2 text-white">آخر النشاطات <Activity size={20} className="text-blue-500" /></h3>
                  <div className="space-y-2">
                    {profiles.slice(0, 5).map(p => (
                      <div key={p.id} className="bg-black/60 p-3 rounded-xl flex items-center justify-between border border-white/[0.03] hover:border-white/10 transition-all">
                        <div className="flex items-center gap-3">
                          <ProAvatar url={p.avatar_url} username={p.username} size="w-10 h-10" className="overflow-visible" />
                          <span className="font-black italic text-sm text-white">{p.username}</span>
                        </div>
                        <span className="text-xs font-mono text-zinc-600">{new Date(p.created_at).toLocaleDateString('ar-EG')}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent p-8 flex flex-col justify-center items-center text-center">
                  <Terminal size={60} className="text-zinc-800 mb-4" />
                  <h4 className="text-2xl font-black italic mb-2 text-white">النظام قيد التشغيل الكامل</h4>
                  <p className="text-zinc-500 font-bold text-sm max-w-sm leading-relaxed">جميع الوحدات البرمجية تعمل بكفاءة عالية. السيرفر متصل بقاعدة بيانات SQL السحابية.</p>
                </div>
              </div>
            </div>
          )}

          {/* BOT CONTROL TAB */}
          {activeTab === 'bot_control' && (
            <div className="animate-in fade-in duration-500">
               <BotDashboard />
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
                <div className="flex-1 w-full max-w-lg">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-wider mb-1 block italic">Search</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ابحث بالاسم..." className="w-full bg-black/60 border border-white/10 rounded-xl p-3 pr-10 text-sm text-white font-black focus:border-blue-600 outline-none transition-all shadow-lg" />
                  </div>
                </div>
                <div className="bg-zinc-900/80 px-6 py-3 rounded-xl border border-white/10 text-center">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block mb-0.5">Total</span>
                  <span className="text-xl font-black italic text-white">{filteredProfiles.length}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 overflow-hidden shadow-xl bg-black/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="bg-white/[0.03] text-[10px] font-black uppercase text-zinc-500 tracking-[0.1em] border-b border-white/5">
                        <th className="p-4">اللاعب</th>
                        <th className="p-4">فوز</th>
                        <th className="p-4">نقاط</th>
                        <th className="p-4">الحالة</th>
                        <th className="p-4 text-center">تحكم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {filteredProfiles.map(p => (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-all group">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <ProAvatar url={p.avatar_url} username={p.username} size="w-10 h-10" className="overflow-visible" />
                              <div>
                                <div className={`text-base font-black italic leading-tight ${p.is_banned ? 'text-zinc-700 line-through' : 'text-white'}`}>{p.username}</div>
                                <div className="text-[10px] font-mono text-zinc-600">{p.id?.slice(0, 8).toUpperCase()}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3"><div className="font-black text-lg text-blue-500 italic">{p.wins || 0}</div></td>
                          <td className="p-3 text-lg font-black italic text-white/80">{p.score || 0}</td>
                          <td className="p-3">
                            {p.is_banned
                              ? <span className="inline-flex items-center gap-1.5 bg-red-600/10 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase">Restricted</span>
                              : <span className="inline-flex items-center gap-1.5 bg-green-600/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase">Authorized</span>
                            }
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 justify-center">
                              <button onClick={() => { setTargetUser(p.username); setStatType('points'); showStatus(`تم تحديد ${p.username}`); }} className="p-2 bg-blue-600/10 text-blue-500 rounded-lg hover:bg-blue-600 hover:text-white transition-all border border-blue-500/10 hover:border-blue-500/30" title="نقاط"><Trophy size={14} /></button>
                              <button onClick={() => { setTargetUser(p.username); setStatType('wins'); showStatus(`تم تحديد ${p.username}`); }} className="p-2 bg-yellow-600/10 text-yellow-500 rounded-lg hover:bg-yellow-600 hover:text-white transition-all border border-yellow-500/10 hover:border-yellow-500/30" title="فوز"><Star size={14} /></button>
                              <button onClick={() => { setTargetUser(p.username); setStatType('credits'); showStatus(`تم تحديد ${p.username}`); }} className="p-2 bg-green-600/10 text-green-500 rounded-lg hover:bg-green-600 hover:text-black transition-all border border-green-500/10 hover:border-green-500/30" title="رصيد"><Zap size={14} /></button>
                              <button onClick={() => handleToggleBan(p.username, p.is_banned)} className={`p-2 rounded-lg border transition-all ${p.is_banned ? 'bg-green-600 text-black border-green-500/30' : 'bg-red-600/10 text-red-500 border-red-500/10 hover:bg-red-600 hover:text-white hover:border-red-500/30'}`}>{p.is_banned ? <Unlock size={14} /> : <Ban size={14} />}</button>
                              <button onClick={() => handleResetUser(p.username)} className="p-2 bg-white/5 text-white/40 rounded-lg border border-white/5 hover:bg-white/10 hover:text-white transition-all"><RotateCw size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {targetUser && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={() => setTargetUser('')}></div>
                  <div className="relative w-full max-w-xl bg-gradient-to-b from-[#0a0a0a] to-black rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className={`h-1.5 w-full transition-all duration-500 ${statType === 'points' ? 'bg-blue-600' : statType === 'wins' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                    <div className="p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <ProAvatar url={profiles.find(p => p.username === targetUser)?.avatar_url} username={targetUser} size="w-12 h-12" className="border-2 border-white/10 overflow-visible" />
                          <div>
                            <h2 className="text-xl font-black italic text-white tracking-tighter leading-none">{targetUser}</h2>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-1">Admin Control</p>
                          </div>
                        </div>
                        <button onClick={() => setTargetUser('')} className="w-8 h-8 bg-white/5 hover:bg-red-600 hover:text-white rounded-lg flex items-center justify-center transition-all border border-white/10"><X size={16} /></button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-1.5 bg-white/[0.02] border border-white/5 rounded-xl">
                        {[{ id: 'points', label: 'النقاط', icon: Trophy, activeColor: 'bg-blue-600' }, { id: 'wins', label: 'الفوز', icon: Star, activeColor: 'bg-yellow-500' }, { id: 'credits', label: 'الرصيد', icon: Zap, activeColor: 'bg-green-500' }].map(tab => (
                          <button key={tab.id} onClick={() => setStatType(tab.id as any)}
                            className={`flex flex-col items-center gap-2 py-3 rounded-lg transition-all duration-300 ${statType === tab.id ? `${tab.activeColor} text-white shadow-md scale-[1.02] border border-white/20` : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                            <tab.icon size={20} />
                            <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          {[{ label: 'الرصيد', value: profiles.find(p => p.username === targetUser)?.credits || 0, color: 'text-green-500' }, { label: 'النقاط', value: profiles.find(p => p.username === targetUser)?.score || 0, color: 'text-blue-500' }, { label: 'الفوز', value: profiles.find(p => p.username === targetUser)?.wins || 0, color: 'text-yellow-500' }].map((stat, i) => (
                            <div key={i} className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl p-3 text-center">
                              <p className="text-[10px] font-black text-zinc-600 uppercase mb-0.5 tracking-wider">{stat.label}</p>
                              <p className={`text-lg font-black italic ${stat.color}`}>{stat.value.toLocaleString()}</p>
                            </div>
                          ))}
                        </div>

                        <div className="bg-black/80 border border-white/5 rounded-2xl p-6 flex flex-col items-center gap-4">
                          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Adjusting Value</span>
                          <div className="flex items-center gap-4">
                            <button onClick={() => setPointDelta(Math.max(1, (Number(pointDelta) || 0) - 10))} className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-xl font-black text-white">-</button>
                            <input type="number" value={pointDelta} onChange={(e) => setPointDelta(Number(e.target.value))}
                              className={`w-24 bg-transparent text-center text-3xl font-black outline-none tracking-tighter [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors duration-500 ${statType === 'points' ? 'text-blue-500' : statType === 'wins' ? 'text-yellow-500' : 'text-green-500'}`} />
                            <button onClick={() => setPointDelta((Number(pointDelta) || 0) + 10)} className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-xl font-black text-white">+</button>
                          </div>
                          <div className="flex flex-wrap justify-center gap-2">
                            {[1, 5, 20, 50, 100, 500, 1000].map(val => (
                              <button key={val} onClick={() => handleAdjustStats(true, val)} className="px-3 py-1.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs font-black hover:bg-white/10 transition-all text-zinc-400 hover:text-white">+{val}</button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button onClick={() => handleAdjustStats(true)}
                            className={`flex-[3] py-3 rounded-xl font-black text-sm italic uppercase tracking-wider transition-all active:scale-95 border border-white/10 ${statType === 'points' ? 'bg-blue-600 text-white shadow-lg' : statType === 'wins' ? 'bg-yellow-500 text-black shadow-lg' : 'bg-green-500 text-black shadow-lg'}`}>
                            تأكيد الإضافة
                          </button>
                          <button onClick={() => handleAdjustStats(false)}
                            className="flex-1 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 text-sm">
                            <UserMinus size={16} />
                            <span className="italic font-black">خصم</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BANS TAB */}
          {activeTab === 'bans' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-12 duration-700">
              <div>
                <h2 className="text-4xl font-black text-red-600 italic tracking-tighter drop-shadow-[0_0_20px_rgba(255,0,0,0.3)]">IRON SHIELD</h2>
                <p className="text-zinc-500 font-bold mt-2 text-sm italic uppercase">Centralized Punishment & Restriction Hub</p>
              </div>

              <div className="rounded-3xl border border-red-600/20 bg-red-600/[0.01] p-8 shadow-2xl relative overflow-hidden group">
                <Gavel size={80} className="absolute right-[-10px] top-[-10px] text-red-600/5 group-hover:rotate-12 transition-transform duration-1000" />
                <h3 className="text-2xl font-black text-white italic mb-6 flex items-center gap-3 border-b border-white/5 pb-4">
                  <Ban className="text-red-600" size={24} /> حظر لاعب جديد
                </h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-wider pl-2">Target Identity</label>
                      <input type="text" value={targetUser} onChange={(e) => setTargetUser(e.target.value)}
                        placeholder="اسم المستخدم..."
                        className="w-full bg-black border border-white/10 rounded-2xl p-4 text-base text-white font-black focus:border-red-600 outline-none transition-all shadow-inner" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-wider pl-2">Violation Type</label>
                      <select value={banReason} onChange={(e) => setBanReason(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-2xl p-4 text-sm text-white font-black focus:border-red-600 outline-none appearance-none">
                        <option>مخالفة قوانين الدردشة</option>
                        <option>استخدام برامج مساعدة (Cheating)</option>
                        <option>إزعاج المتسابقين (Harassment)</option>
                        <option>إساءة استخدام النظام</option>
                        <option>قرار إداري مباشر</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => { if (!targetUser) return showStatus('يرجى كتابة اسم اللاعب', true); if (confirm(`تأكيد حظر ${targetUser} نهائياً؟`)) handleToggleBan(targetUser, false); }}
                    className="w-full py-4 bg-black border border-red-600/50 text-red-500 font-black text-lg rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-[0_15px_40px_rgba(220,38,38,0.2)] flex items-center justify-center gap-3 italic uppercase">
                    <Gavel size={20} /> Execute Judgement
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] pl-2 italic">Banned List Database</h4>
                {profiles.filter(p => p.is_banned).map(p => (
                  <div key={p.id} className="rounded-2xl border border-red-900/40 bg-red-950/5 p-4 flex items-center justify-between group hover:border-red-500/40 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="relative group-hover:scale-105 transition-transform">
                        <ProAvatar url={p.avatar_url} username={p.username} size="w-12 h-12" className="opacity-40 grayscale overflow-visible" />
                        <Ban size={20} className="absolute inset-0 m-auto text-red-600 drop-shadow-md z-20" />
                      </div>
                      <div>
                        <div className="text-lg font-black text-white italic leading-tight">{p.username}</div>
                        <div className="text-[10px] font-bold text-red-600/60 uppercase tracking-widest mt-0.5">Status: Restricted Permanently</div>
                      </div>
                    </div>
                    <button onClick={() => handleToggleBan(p.username, true)} className="px-4 py-2 bg-green-600/10 text-green-500 border border-green-500/20 rounded-xl font-black text-[10px] hover:bg-green-600 hover:text-black transition-all active:scale-95 italic uppercase tracking-widest">Unban Player</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ANNOUNCEMENTS TAB */}
          {activeTab === 'announcements' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-right-12">
              <div>
                <h2 className="text-4xl font-black text-white italic tracking-tighter">BROADCAST CORE</h2>
                <p className="text-zinc-500 font-bold mt-2 text-sm italic uppercase">Global Frequency Distribution System</p>
              </div>

              <div className="rounded-3xl border border-orange-500/20 bg-orange-500/[0.01] p-8 shadow-2xl relative">
                <Radio size={100} className="absolute left-[-20px] top-[-20px] text-orange-600/5" />
                <div className="flex flex-col gap-6 relative z-10">
                  <textarea value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)}
                    placeholder="اكتب رسالة البث العام هنا... ستظهر للجميع فوراً!"
                    className="w-full bg-black/40 border-2 border-white/[0.05] rounded-2xl p-6 text-xl text-white font-black focus:border-red-600 outline-none transition-all min-h-[150px] shadow-inner text-center leading-relaxed italic placeholder:text-zinc-800" />
                  <button onClick={async () => { if (!newAnnouncement) return; setIsLoading(true); const { error } = await adminService.addAnnouncement(newAnnouncement); setIsLoading(false); if (!error) { setNewAnnouncement(''); showStatus('تم إطلاق البث المباشر بنجاح!'); fetchData(); } else { showStatus('فشل إرسال البث', true); } }}
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black text-lg rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_40px_rgba(255,0,0,0.3)] flex items-center justify-center gap-3 italic uppercase disabled:opacity-50">
                    <Radio size={24} className={isLoading ? 'animate-spin' : 'animate-pulse'} />
                    {isLoading ? 'Processing...' : 'TRANSMIT REAL-TIME PULSE'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PROMO TAB */}
          {activeTab === 'promo' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black text-yellow-500 italic tracking-tighter">GOLDEN FORGE</h2>
                  <p className="text-zinc-500 font-bold mt-2 text-sm">صناعة الأكواد والهدايا الترويجية</p>
                </div>
                <Ticket size={60} className="text-yellow-600/20" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/[0.01] p-8 shadow-2xl">
                  <h3 className="text-xl font-black text-white italic mb-3 flex items-center gap-3"><Sparkles className="text-yellow-500" size={20} /> كود ترويجي جديد</h3>
                  <div className="mb-4 text-xs text-zinc-500 font-bold">
                    حالة مراقبة الشات: {chatStatus.connected ? <span className="text-green-500">متصل</span> : <span className="text-red-500">غير متصل</span>}
                    {chatStatus.details ? <span className="mr-2 opacity-60">({chatStatus.details})</span> : null}
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-wider pl-2">Secret Sequence</label>
                      <input type="text" value={newPromo.code} onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                        placeholder="مثال: GOLDEN_KICK"
                        className="w-full bg-black border-2 border-white/10 rounded-2xl p-4 text-2xl text-white font-black focus:border-yellow-500 outline-none transition-all shadow-xl text-center tracking-widest placeholder:text-zinc-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-wider">Amount (§)</label>
                        <input type="number" value={newPromo.amount} onChange={(e) => setNewPromo({ ...newPromo, amount: Number(e.target.value) })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xl font-black text-yellow-500 text-center" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-wider">Global Limit</label>
                        <input type="number" value={newPromo.maxUses} onChange={(e) => setNewPromo({ ...newPromo, maxUses: Number(e.target.value) })}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xl font-black text-white text-center" />
                      </div>
                    </div>
                    <button onClick={async () => { if (!newPromo.code) return; await adminService.addPromoCode(newPromo.code, newPromo.amount, newPromo.maxUses); showStatus('تم توليد الكود بنجاح'); setNewPromo({ code: '', amount: 1000, maxUses: 10 }); fetchData(); }}
                      className="w-full py-4 bg-yellow-500 text-black font-black text-lg rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_30px_rgba(234,179,8,0.2)] flex items-center justify-center gap-3 italic uppercase">
                      <Save size={24} /> Commit Golden Forge
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] pl-2 italic">Active Coupon Clusters</h3>
                  {promoCodes.map(promo => (
                    <div key={promo.id} className="bg-gradient-to-r from-zinc-900 to-black border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-yellow-500/30 transition-all shadow-xl overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-16 h-full bg-yellow-500/5 skew-x-[-20deg] translate-x-8"></div>
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center text-black font-black text-2xl shadow-lg shrink-0 group-hover:rotate-12 transition-transform">
                          <Ticket size={24} />
                        </div>
                        <div>
                          <div className="text-xl font-black text-white italic tracking-widest uppercase leading-none">{promo.code}</div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-yellow-500 font-black text-sm italic">§ {promo.reward_amount}</span>
                            <div className="h-3 w-px bg-zinc-700"></div>
                            <span className="text-zinc-500 text-[10px] font-bold uppercase">{promo.current_uses} / {promo.max_uses} USES</span>
                            <div className="h-3 w-px bg-zinc-700"></div>
                            <span className={`text-[10px] font-black uppercase ${promo.is_active ? 'text-green-500' : 'text-red-500'}`}>{promo.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="relative z-10 opacity-0 group-hover:opacity-100 flex items-center gap-2">
                        <button onClick={() => adminService.togglePromoActive(promo.id, !promo.is_active).then(fetchData)} className={`p-2.5 rounded-xl transition-all ${promo.is_active ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white' : 'bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-black'}`}>{promo.is_active ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                        <button onClick={() => adminService.deletePromoCode(promo.id).then(fetchData)} className="p-2.5 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ARENA TAB */}
          {activeTab === 'arena' && (
            <div className="space-y-8 animate-in fade-in duration-1000">
              <div>
                <h2 className="text-4xl font-black text-white italic tracking-tighter">ARENA CORE</h2>
                <p className="text-zinc-500 font-bold mt-2 text-sm italic uppercase">Quantum Environment Manipulation Control</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-6 hover:border-red-600/30 transition-all shadow-2xl flex flex-col">
                  <h3 className="text-xl font-black text-white italic mb-6 border-b border-white/5 pb-3 flex items-center justify-between">Thematic Matrix <Palette size={20} className="text-red-600" /></h3>
                  <div className="grid grid-cols-1 gap-3 flex-1">
                    {['default', 'neon_blue', 'golden_arena', 'stealth_dark'].map(m => (
                      <button key={m} onClick={() => updateArena('global_mood', { ...arenaStatus.global_mood, theme: m })}
                        className={`p-4 rounded-xl flex items-center justify-center border-2 transition-all font-black text-xs uppercase tracking-widest ${arenaStatus.global_mood?.theme === m ? 'border-red-600 bg-white/5 text-white shadow-md scale-[1.02]' : 'border-transparent bg-black/40 text-zinc-600 hover:border-white/10'}`}>
                        {m.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-6 hover:border-green-500/30 transition-all shadow-2xl flex flex-col">
                  <h3 className="text-xl font-black text-white italic mb-6 border-b border-white/5 pb-3 flex items-center justify-between">Visual FX <Sparkles size={20} className="text-green-500" /></h3>
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    {[
                      { id: 'none', label: 'VOID', icon: EyeOff, color: 'text-zinc-600' },
                      { id: 'snow', label: 'SNOW', icon: Wind, color: 'text-blue-400' },
                      { id: 'fire', label: 'EMBER', icon: Flame, color: 'text-orange-500' },
                      { id: 'confetti', label: 'CELEB', icon: Sparkles, color: 'text-green-500' }
                    ].map(fx => (
                      <button key={fx.id} onClick={() => updateArena('global_mood', { ...arenaStatus.global_mood, particles: fx.id })}
                        className={`p-4 rounded-2xl flex flex-col items-center gap-3 transition-all border-2 ${arenaStatus.global_mood?.particles === fx.id ? 'bg-green-500 text-black border-green-500 shadow-md scale-[1.02]' : 'bg-black/40 text-zinc-600 border-transparent hover:border-white/10'}`}>
                        <fx.icon size={24} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{fx.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-6 hover:border-blue-500/30 transition-all shadow-2xl flex flex-col">
                  <h3 className="text-xl font-black text-white italic mb-6 border-b border-white/5 pb-3 flex items-center justify-between">Audio Stream <Music size={20} className="text-blue-500" /></h3>
                  <div className="space-y-4 flex-1">
                    <div className="bg-black/60 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">Streaming Status</span>
                      <button onClick={() => updateArena('audio_overlay', { ...arenaStatus.audio_overlay, enabled: !arenaStatus.audio_overlay?.enabled })}
                        className={`w-12 h-6 rounded-full p-1 relative transition-all ${arenaStatus.audio_overlay?.enabled ? 'bg-blue-600' : 'bg-zinc-800'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${arenaStatus.audio_overlay?.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                    <div className="bg-black/60 p-4 rounded-2xl border border-white/5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic block mb-3">Volume Control</label>
                      <input type="range" min="0" max="1" step="0.1" value={arenaStatus.audio_overlay?.volume || 0.5}
                        onChange={(e) => updateArena('audio_overlay', { ...arenaStatus.audio_overlay, volume: parseFloat(e.target.value) })}
                        className="w-full accent-blue-600" />
                    </div>
                    <div className="bg-black/60 p-4 rounded-2xl border border-white/5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic block mb-2">Source URL</label>
                      <input type="text" value={arenaStatus.audio_overlay?.url || ''}
                        onChange={(e) => updateArena('audio_overlay', { ...arenaStatus.audio_overlay, url: e.target.value })}
                        placeholder="https://..."
                        className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white font-black focus:border-blue-600 outline-none transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-10 duration-700">
              <div>
                <h2 className="text-4xl font-black text-zinc-400 italic tracking-tighter">AUDIT TRAIL</h2>
                <p className="text-zinc-600 font-bold mt-2 text-sm italic uppercase">Chronological Security Event Log</p>
              </div>

              <div className="rounded-2xl border border-white/5 overflow-hidden shadow-xl bg-black/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="bg-white/[0.02] text-[10px] font-black uppercase text-zinc-500 tracking-[0.1em] border-b border-white/5">
                        <th className="p-4">الوقت</th>
                        <th className="p-4">المشرف</th>
                        <th className="p-4">الإجراء</th>
                        <th className="p-4">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-white/[0.02] transition-all">
                          <td className="p-3 text-xs text-zinc-500 font-mono whitespace-nowrap">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                          <td className="p-3 text-sm font-black italic text-white">{log.admin_username || 'SYSTEM'}</td>
                          <td className="p-3">
                            <span className="inline-block px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-wider text-zinc-400">{log.action}</span>
                          </td>
                          <td className="p-3 text-xs text-zinc-500 font-bold">{log.details ? JSON.stringify(log.details).slice(0, 80) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SYSTEM TAB */}
          {activeTab === 'system' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
              <div>
                <h2 className="text-4xl font-black text-red-600 italic tracking-tighter drop-shadow-[0_0_20px_rgba(255,0,0,0.3)]">SYSTEM CORE</h2>
                <p className="text-zinc-500 font-bold mt-2 text-sm italic uppercase">Deep Maintenance & Recovery Controls</p>
              </div>

              <div className="rounded-3xl border border-red-600/20 bg-red-600/[0.01] p-8 shadow-2xl space-y-8 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-600/5 blur-[80px] rounded-full"></div>

                <div className="relative z-10">
                  <h3 className="text-xl font-black text-white italic mb-4 flex items-center gap-3"><Database className="text-red-600" size={24} /> Database Administration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/60 rounded-2xl p-6 border border-white/5">
                      <h4 className="text-sm font-black text-zinc-400 italic mb-2">Leaderboard Reset</h4>
                      <p className="text-xs text-zinc-600 font-bold mb-4">مسح جميع إحصائيات المتصدرين وإعادة تعيين اللوحة.</p>
                      <button onClick={async () => { if (confirm('هل أنت متأكد من تصفير لوحة المتصدرين بالكامل؟')) { await leaderboardService.resetLeaderboard(); showStatus('تم تصفير لوحة المتصدرين'); fetchData(); } }}
                        className="w-full py-3 bg-red-600/10 border border-red-500/20 rounded-xl text-red-500 font-black text-sm hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2">
                        <RotateCw size={16} /> Reset Leaderboard
                      </button>
                    </div>
                    <div className="bg-black/60 rounded-2xl p-6 border border-white/5">
                      <h4 className="text-sm font-black text-zinc-400 italic mb-2">Bulk Operations</h4>
                      <p className="text-xs text-zinc-600 font-bold mb-4">أدوات تحكم جماعية للمستخدمين والبيانات.</p>
                      <div className="flex flex-col gap-2">
                        <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black text-sm hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2">
                          <Fingerprint size={16} /> Validate All Sessions
                        </button>
                        <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black text-sm hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2">
                          <Clock size={16} /> Sync Timestamps
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 border-t border-white/5 pt-8">
                  <h3 className="text-xl font-black text-white italic mb-4 flex items-center gap-3"><Shield className="text-red-600" size={24} /> Security Reset</h3>
                  <button onClick={async () => { if (confirm('إعادة تعيين كلمة سر الأدمن؟')) { await supabase.from('app_config').upsert({ key: 'admin_password', value: '123456' }); showStatus('تم إعادة تعيين كلمة السر إلى 123456'); } }}
                    className="w-full py-4 bg-black border border-red-600/50 text-red-500 font-black text-lg rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-[0_15px_40px_rgba(220,38,38,0.15)] flex items-center justify-center gap-3 italic uppercase">
                    <Key size={20} /> Reset Admin Password to Default
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MAHMAH TAB */}
          {activeTab === 'mahmah' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black text-indigo-500 italic tracking-tighter">MAHMAH MANAGER</h2>
                  <p className="text-zinc-500 font-bold mt-2 text-sm italic uppercase">Categories: {mahmahCategories.length} • Questions: {mahmahQuestions.length}</p>
                </div>
                <div className="flex gap-2">
                  {selectedMahmahCategory && (
                    <button onClick={() => setSelectedMahmahCategory(null)} className="px-6 py-3 bg-zinc-800 text-white rounded-xl font-black text-sm hover:bg-zinc-700 transition-all flex items-center gap-2">
                      العودة للفئات
                    </button>
                  )}
                  {!selectedMahmahCategory && (
                    <button onClick={() => setIsAddingMahmahCategory(true)} className="px-6 py-3 bg-indigo-600/10 text-indigo-500 border border-indigo-500/20 rounded-xl font-black text-sm hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                      <Plus size={18} /> فئة جديدة
                    </button>
                  )}
                  {selectedMahmahCategory && (
                    <button onClick={() => {
                      const catQs = mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id);
                      const stageStart = selectedMahmahStage * 6;
                      const stageQs = catQs.filter(q => (q.order_number || 1) >= stageStart + 1 && (q.order_number || 1) <= stageStart + 6);
                      const nextLocal = stageQs.length + 1;
                      setNewMahmahQuestion({ ...newMahmahQuestion, order_number: nextLocal <= 6 ? stageStart + nextLocal : stageStart + 1 });
                      setIsAddingMahmahQuestion(true);
                    }} className="px-6 py-3 bg-indigo-600/10 text-indigo-500 border border-indigo-500/20 rounded-xl font-black text-sm hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                      <Plus size={18} /> سؤال جديد
                    </button>
                  )}
                </div>
              </div>

              {!selectedMahmahCategory && isAddingMahmahCategory && (
                <form onSubmit={handleSaveMahmahCategory} className="bg-indigo-900/10 border border-indigo-500/20 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4"><Plus size={20} className="text-indigo-500" /> إضافة فئة جديدة</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">اسم الفئة</label>
                      <input type="text" value={newMahmahCategory.name} onChange={e => setNewMahmahCategory({ ...newMahmahCategory, name: e.target.value })}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        placeholder="الرياضة والكرة..." required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">صورة الفئة</label>
                      <div className="flex gap-2">
                        <input type="text" value={newMahmahCategory.image_url} onChange={e => setNewMahmahCategory({ ...newMahmahCategory, image_url: e.target.value })}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                          placeholder="رابط الصورة أو ارفع صورة..." required />
                        <label className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border border-dashed border-indigo-500/50 cursor-pointer hover:bg-indigo-500/10 transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                          <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              setUploadingImage(true);
                              try { const url = await uploadToCloudinary(e.target.files[0]); setNewMahmahCategory({ ...newMahmahCategory, image_url: url }); }
                              catch (err) { showStatus('فشل رفع الصورة', true); }
                              setUploadingImage(false);
                            }
                          }} />
                          {uploadingImage ? <RotateCw className="animate-spin text-indigo-500" size={20} /> : <Upload className="text-indigo-500" size={20} />}
                        </label>
                      </div>
                      {newMahmahCategory.image_url && <img src={newMahmahCategory.image_url} alt="Preview" className="h-16 w-16 object-cover rounded-xl mt-2 border border-white/10" />}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">عدد المراحل</label>
                    <input type="number" min={1} max={20} value={newMahmahCategory.num_stages} onChange={e => setNewMahmahCategory({ ...newMahmahCategory, num_stages: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      placeholder="1" />
                  </div>
                  <div className="flex gap-3 justify-end mt-6">
                    <button type="button" onClick={() => setIsAddingMahmahCategory(false)} className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-black text-sm hover:bg-white/10 transition-all">إلغاء</button>
                    <button type="submit" disabled={uploadingImage} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]">حفظ الفئة</button>
                  </div>
                </form>
              )}

              {!selectedMahmahCategory ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mahmahCategories.map(cat => {
                    const count = mahmahQuestions.filter(q => q.category_id === cat.id).length;
                    return (
                      <div key={cat.id} className="bg-[#0a0a0a] border border-white/5 hover:border-indigo-500/30 rounded-2xl overflow-hidden shadow-lg transition-all group relative">
                        <div className="aspect-video w-full bg-black relative">
                          {cat.image_url ? (
                            <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900"><Brain size={32} className="text-zinc-700" /></div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                            <div>
                              <h3 className="text-white font-black text-lg truncate">{cat.name}</h3>
                              <p className="text-indigo-400 font-bold text-xs">{count} أسئلة · {cat.num_stages || 1} مراحل</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 bg-black border-t border-white/5 flex gap-2">
                          <button onClick={() => setSelectedMahmahCategory(cat)} className="flex-1 py-2 bg-indigo-600/10 text-indigo-400 rounded-lg font-bold text-sm hover:bg-indigo-600 hover:text-white transition-colors">عرض الأسئلة</button>
                          <button onClick={() => handleDeleteMahmahCategory(cat.id)} className="w-10 flex items-center justify-center bg-red-600/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    )
                  })}
                  {mahmahCategories.length === 0 && (
                    <div className="col-span-full py-20 text-center text-zinc-600 font-black italic">لا توجد فئات حالياً.</div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-indigo-900/20 to-black border border-indigo-500/20 rounded-3xl">
                    <img src={selectedMahmahCategory.image_url} alt="cat" className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(79,70,229,0.3)]" />
                    <div>
                      <h2 className="text-3xl font-black text-white">{selectedMahmahCategory.name}</h2>
                      <p className="text-indigo-400 font-bold">{(() => {
                        const catQs = mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id);
                        const stageCount = Math.max(1, Math.ceil(catQs.length / 6));
                        return `${catQs.length} أسئلة · ${stageCount} ${stageCount === 1 ? 'مرحلة' : 'مراحل'}`;
                      })()}</p>
                    </div>
                    <button onClick={() => { setSelectedMahmahCategory(null); setSelectedMahmahStage(0); }} className="mr-auto px-4 py-2 bg-white/5 border border-white/10 text-white/60 rounded-xl font-bold text-sm hover:bg-white/10 transition-all">← العودة</button>
                    <button onClick={handleAutoAssignOrder} className="px-4 py-2 bg-amber-600/10 border border-amber-500/20 text-amber-400 rounded-xl font-bold text-xs hover:bg-amber-600 hover:text-white transition-all">ترتيب تلقائي</button>
                  </div>

                  {(() => {
                    const catQs = mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id);
                    const totalStages = selectedMahmahCategory.num_stages || Math.max(1, Math.ceil(catQs.length / 6));
                    const activeStage = (selectedMahmahCategory.active_stage || parseInt(localStorage.getItem(`mahmah_active_stage_${selectedMahmahCategory.id}`) || '1') || 1) - 1;
                    return (
                      <div className="space-y-3">
                        <div className="flex gap-3 flex-wrap items-center">
                          {Array.from({ length: totalStages }, (_, i) => {
                            const stageStart = i * 6;
                            const stageEnd = stageStart + 6;
                            const stageQs = catQs.filter(q => {
                              const ord = q.order_number || 1;
                              return ord >= stageStart + 1 && ord <= stageEnd;
                            });
                            const isViewing = selectedMahmahStage === i;
                            const isPlaying = activeStage === i;
                            const colors = ['from-green-500 to-emerald-600', 'from-blue-500 to-indigo-600', 'from-purple-500 to-fuchsia-600', 'from-amber-500 to-orange-600', 'from-red-500 to-rose-600', 'from-cyan-500 to-teal-600'];
                            return (
                              <button key={i} onClick={() => {
                                setSelectedMahmahStage(i);
                                handleSetActiveStage(i);
                              }}
                                className={`relative flex items-center gap-3 px-6 py-4 rounded-2xl font-black transition-all border-2 ${
                                  isPlaying
                                    ? `bg-gradient-to-br ${colors[i % colors.length]} text-white border-amber-400/60 shadow-lg scale-105 shadow-[0_0_20px_rgba(245,158,11,0.25)]`
                                    : isViewing
                                      ? `bg-gradient-to-br ${colors[i % colors.length]} text-white border-transparent shadow-lg scale-105`
                                      : 'bg-black/30 border-white/10 text-white/60 hover:border-white/30 hover:bg-white/5'
                                }`}>
                                {isPlaying && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap z-10">▶ تُلعب في اللعبة</div>}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isViewing || isPlaying ? 'bg-white/20' : 'bg-white/5'}`}>
                                  {isPlaying ? '▶' : i + 1}
                                </div>
                                <div className="text-right">
                                  <div className="text-sm">مرحلة {i + 1}</div>
                                  <div className={`text-xs font-bold ${isViewing || isPlaying ? 'text-white/80' : 'text-white/40'}`}>{stageQs.length} / 6 أسئلة</div>
                                </div>
                                {stageQs.length === 6 && <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-amber-400' : isViewing ? 'bg-white' : 'bg-green-500'}`} />}
                              </button>
                            );
                          })}
                          <button onClick={handleAddMahmahStage} className="flex items-center gap-2 px-5 py-4 rounded-2xl border-2 border-dashed border-white/20 text-white/40 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all font-black text-sm">
                            <Plus size={18} /> إضافة مرحلة
                          </button>
                          {totalStages > 1 && (
                            <button onClick={handleRemoveMahmahStage} className="flex items-center gap-2 px-5 py-4 rounded-2xl border-2 border-dashed border-red-500/20 text-red-400/50 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/5 transition-all font-black text-sm">
                              <Trash2 size={18} /> حذف المرحلة {selectedMahmahStage + 1}
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-amber-400/80 font-bold bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2">
                          اضغط على المرحلة = تظهر أسئلتها + تتحدد كمرحلة تُلعب في اللعبة ▶
                        </div>
                      </div>
                    );
                  })()}

                  {isAddingMahmahQuestion && (
                    <form onSubmit={handleSaveMahmahQuestion} className="bg-indigo-900/10 border border-indigo-500/20 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                      <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4"><Plus size={20} className="text-indigo-500" /> إضافة سؤال — <span className="text-amber-400">مرحلة {selectedMahmahStage + 1}</span></h3>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">اختر المرحلة</label>
                        <div className="flex gap-2">
                          {Array.from({ length: selectedMahmahCategory.num_stages || Math.max(1, Math.ceil(mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id).length / 6)) }, (_, i) => (
                            <button key={i} type="button" onClick={() => {
                              const catQs = mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id);
                              const stageQs = catQs.filter(q => (q.order_number || 1) >= i * 6 + 1 && (q.order_number || 1) <= i * 6 + 6);
                              setNewMahmahQuestion({ ...newMahmahQuestion, order_number: i * 6 + stageQs.length + 1 });
                              setSelectedMahmahStage(i);
                            }}
                              className={`px-5 py-2 rounded-xl font-black text-sm border-2 transition-all ${selectedMahmahStage === i ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400' : 'border-white/10 bg-black/30 text-white/50 hover:border-white/30'}`}>
                              المرحلة {i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">مستوى الصعوبة والنقاط</label>
                          <div className="flex gap-4">
                            <label className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${newMahmahQuestion.points === 100 ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-white/10 bg-black/50 text-zinc-500 hover:border-white/30'}`}>
                              <input type="radio" className="hidden" checked={newMahmahQuestion.points === 100} onChange={() => setNewMahmahQuestion({ ...newMahmahQuestion, points: 100 })} />
                              <span className="font-black text-lg">سهل</span>
                              <span className="font-bold text-sm">100 نقطة</span>
                            </label>
                            <label className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${newMahmahQuestion.points === 300 ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' : 'border-white/10 bg-black/50 text-zinc-500 hover:border-white/30'}`}>
                              <input type="radio" className="hidden" checked={newMahmahQuestion.points === 300} onChange={() => setNewMahmahQuestion({ ...newMahmahQuestion, points: 300 })} />
                              <span className="font-black text-lg">متوسط</span>
                              <span className="font-bold text-sm">300 نقطة</span>
                            </label>
                            <label className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${newMahmahQuestion.points === 500 ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 bg-black/50 text-zinc-500 hover:border-white/30'}`}>
                              <input type="radio" className="hidden" checked={newMahmahQuestion.points === 500} onChange={() => setNewMahmahQuestion({ ...newMahmahQuestion, points: 500 })} />
                              <span className="font-black text-lg">صعب</span>
                              <span className="font-bold text-sm">500 نقطة</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">رقم السؤال في المرحلة (1-6)</label>
                          <div className="flex gap-2">
                            {[1,2,3,4,5,6].map(n => {
                              const globalOrder = selectedMahmahStage * 6 + n;
                              const catQs = mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id);
                              const taken = catQs.some(q => q.order_number === globalOrder);
                              const active = newMahmahQuestion.order_number === globalOrder;
                              const ptsLabel = n <= 2 ? '100' : n <= 4 ? '300' : '600';
                              return (
                                <button key={n} type="button" onClick={() => !taken && setNewMahmahQuestion({ ...newMahmahQuestion, order_number: globalOrder })}
                                  className={`flex-1 py-3 rounded-xl border-2 font-black text-lg transition-all ${taken ? 'border-white/5 bg-white/[0.02] text-zinc-700 cursor-not-allowed' : active ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-white/10 bg-black/50 text-zinc-500 hover:border-white/30'}`}>
                                  {n}
                                  <span className="block text-[10px] font-bold opacity-60">{ptsLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">نص السؤال</label>
                          <input type="text" value={newMahmahQuestion.text} onChange={e => setNewMahmahQuestion({ ...newMahmahQuestion, text: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-indigo-500 transition-all"
                            placeholder="ما هو..." required />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">الإجابة</label>
                          <input type="text" value={newMahmahQuestion.answer} onChange={e => setNewMahmahQuestion({ ...newMahmahQuestion, answer: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-indigo-500 transition-all"
                            placeholder="الإجابة الصحيحة..." required />
                        </div>
                      </div>

                      {/* Media Section */}
                      <div className="border-t border-white/5 pt-6 mt-2">
                        <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">🎬 ميديا السؤال (اختياري)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Media Type Selector */}
                          <div>
                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">نوع الميديا</label>
                            <div className="flex gap-2">
                              {[{t:'image',l:'🖼️ صورة',c:'border-blue-500 bg-blue-500/10 text-blue-400'},{t:'video',l:'🎥 فيديو',c:'border-purple-500 bg-purple-500/10 text-purple-400'},{t:'audio',l:'🎵 صوت',c:'border-pink-500 bg-pink-500/10 text-pink-400'}].map(m => (
                                <button key={m.t} type="button" onClick={() => setNewMahmahQuestion({ ...newMahmahQuestion, media_type: newMahmahQuestion.media_type === m.t ? '' : m.t })}
                                  className={`flex-1 py-2.5 rounded-xl font-black text-xs border-2 transition-all ${newMahmahQuestion.media_type === m.t ? m.c : 'border-white/10 bg-black/50 text-zinc-500 hover:border-white/20'}`}>
                                  {m.l}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Media Upload */}
                          <div>
                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">ملف / رابط الميديا</label>
                            <div className="flex gap-2">
                              <input type="text" value={newMahmahQuestion.media_url} onChange={e => setNewMahmahQuestion({ ...newMahmahQuestion, media_url: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-indigo-500 transition-all text-sm"
                                placeholder="الصق رابط أو ارفع ملف..." />
                              <label className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border border-dashed border-indigo-500/50 cursor-pointer hover:bg-indigo-500/10 transition-colors ${uploadingQuestionMedia ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    setUploadingQuestionMedia(true);
                                    try {
                                      const file = e.target.files[0];
                                      const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
                                      const url = await uploadToCloudinary(file);
                                      if (url) setNewMahmahQuestion(prev => ({ ...prev, media_url: url, media_type: type }));
                                    } catch (err) { showStatus('فشل رفع الملف', true); }
                                    setUploadingQuestionMedia(false);
                                  }
                                }} />
                                {uploadingQuestionMedia ? <RotateCw className="animate-spin text-indigo-500" size={20} /> : <Upload className="text-indigo-500" size={20} />}
                              </label>
                            </div>
                          </div>
                        </div>
                        {/* Media Preview */}
                        {newMahmahQuestion.media_url && (
                          <div className="mt-3 p-3 bg-black/30 rounded-xl border border-white/5 relative">
                            <button type="button" onClick={() => setNewMahmahQuestion({ ...newMahmahQuestion, media_url: '', media_type: '' })} className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center text-white hover:bg-red-500 z-10"><X size={14} /></button>
                            {newMahmahQuestion.media_type === 'image' && <img src={newMahmahQuestion.media_url} alt="preview" className="max-h-32 rounded-lg object-cover" />}
                            {newMahmahQuestion.media_type === 'video' && <video src={newMahmahQuestion.media_url} controls className="max-h-32 rounded-lg" />}
                            {newMahmahQuestion.media_type === 'audio' && <audio src={newMahmahQuestion.media_url} controls className="w-full" />}
                          </div>
                        )}
                      </div>

                      {/* Answer Media Section */}
                      <div className="border-t border-white/5 pt-6 mt-2">
                        <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">🎬 ميديا الإجابة (اختياري)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Answer Media Type Selector */}
                          <div>
                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">نوع ميديا الإجابة</label>
                            <div className="flex gap-2">
                              {[{t:'image',l:'🖼️ صورة',c:'border-blue-500 bg-blue-500/10 text-blue-400'},{t:'video',l:'🎥 فيديو',c:'border-purple-500 bg-purple-500/10 text-purple-400'},{t:'audio',l:'🎵 صوت',c:'border-pink-500 bg-pink-500/10 text-pink-400'}].map(m => (
                                <button key={m.t} type="button" onClick={() => setNewMahmahQuestion({ ...newMahmahQuestion, answer_media_type: newMahmahQuestion.answer_media_type === m.t ? '' : m.t })}
                                  className={`flex-1 py-2.5 rounded-xl font-black text-xs border-2 transition-all ${newMahmahQuestion.answer_media_type === m.t ? m.c : 'border-white/10 bg-black/50 text-zinc-500 hover:border-white/20'}`}>
                                  {m.l}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Answer Media Upload */}
                          <div>
                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">ملف / رابط ميديا الإجابة</label>
                            <div className="flex gap-2">
                              <input type="text" value={newMahmahQuestion.answer_media_url} onChange={e => setNewMahmahQuestion({ ...newMahmahQuestion, answer_media_url: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-all text-sm"
                                placeholder="الصق رابط أو ارفع ملف..." />
                              <label className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border border-dashed border-emerald-500/50 cursor-pointer hover:bg-emerald-500/10 transition-colors ${uploadingAnswerImage ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    setUploadingAnswerImage(true);
                                    try {
                                      const file = e.target.files[0];
                                      const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
                                      const url = await uploadToCloudinary(file);
                                      if (url) setNewMahmahQuestion(prev => ({ ...prev, answer_media_url: url, answer_media_type: type }));
                                    } catch (err) { showStatus('فشل رفع الملف', true); }
                                    setUploadingAnswerImage(false);
                                  }
                                }} />
                                {uploadingAnswerImage ? <RotateCw className="animate-spin text-emerald-500" size={20} /> : <Upload className="text-emerald-500" size={20} />}
                              </label>
                            </div>
                          </div>
                        </div>
                        {/* Answer Media Preview */}
                        {newMahmahQuestion.answer_media_url && (
                          <div className="mt-3 p-3 bg-black/30 rounded-xl border border-white/5 relative">
                            <button type="button" onClick={() => setNewMahmahQuestion({ ...newMahmahQuestion, answer_media_url: '', answer_media_type: '' })} className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center text-white hover:bg-red-500 z-10"><X size={14} /></button>
                            {newMahmahQuestion.answer_media_type === 'image' && <img src={newMahmahQuestion.answer_media_url} alt="answer preview" className="max-h-32 rounded-lg object-cover" />}
                            {newMahmahQuestion.answer_media_type === 'video' && <video src={newMahmahQuestion.answer_media_url} controls className="max-h-32 rounded-lg" />}
                            {newMahmahQuestion.answer_media_type === 'audio' && <audio src={newMahmahQuestion.answer_media_url} controls className="w-full" />}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 justify-end mt-6">
                        <button type="button" onClick={() => setIsAddingMahmahQuestion(false)} className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-black text-sm hover:bg-white/10 transition-all">إلغاء</button>
                        <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]">حفظ السؤال</button>
                      </div>
                    </form>
                  )}

                  {editingMahmahQuestion && (
                    <form onSubmit={handleUpdateMahmahQuestion} className="bg-amber-900/10 border border-amber-500/20 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                      <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4">تعديل السؤال</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">مستوى الصعوبة والنقاط</label>
                          <div className="flex gap-4">
                            {[{v:100,l:'سهل',c:'border-green-500 bg-green-500/10 text-green-400'},{v:300,l:'متوسط',c:'border-yellow-500 bg-yellow-500/10 text-yellow-400'},{v:500,l:'صعب',c:'border-red-500 bg-red-500/10 text-red-400'}].map(m => (
                              <label key={m.v} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${editingMahmahQuestion.points === m.v ? m.c : 'border-white/10 bg-black/50 text-zinc-500 hover:border-white/30'}`}>
                                <input type="radio" className="hidden" checked={editingMahmahQuestion.points === m.v} onChange={() => setEditingMahmahQuestion({ ...editingMahmahQuestion, points: m.v })} />
                                <span className="font-black text-lg">{m.l}</span>
                                <span className="font-bold text-sm">{m.v} نقطة</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">رقم السؤال العالمي</label>
                          <input type="number" min={1} max={60} value={editingMahmahQuestion.order_number || 1} onChange={e => setEditingMahmahQuestion({ ...editingMahmahQuestion, order_number: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all" />
                          <p className="text-zinc-500 text-xs mt-1">المرحلة: {Math.ceil((editingMahmahQuestion.order_number || 1) / 6)} — الموقع: {((editingMahmahQuestion.order_number || 1) - 1) % 6 + 1}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">نص السؤال</label>
                          <input type="text" value={editingMahmahQuestion.text} onChange={e => setEditingMahmahQuestion({ ...editingMahmahQuestion, text: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-amber-500 transition-all" required />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">الإجابة</label>
                          <input type="text" value={editingMahmahQuestion.answer} onChange={e => setEditingMahmahQuestion({ ...editingMahmahQuestion, answer: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-amber-500 transition-all" required />
                        </div>
                      </div>
                      <div className="flex gap-3 justify-end mt-6">
                        <button type="button" onClick={() => setEditingMahmahQuestion(null)} className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-black text-sm hover:bg-white/10 transition-all">إلغاء</button>
                        <button type="submit" className="px-8 py-3 bg-amber-600 text-white rounded-xl font-black text-sm hover:bg-amber-500 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]">حفظ التعديل</button>
                      </div>
                    </form>
                  )}

                  <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 overflow-hidden">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-black/50 text-zinc-500 text-xs font-black uppercase tracking-widest">
                          <th className="p-3 pl-0">رقم</th>
                          <th className="p-3">السؤال</th>
                          <th className="p-3">الإجابة</th>
                          <th className="p-3 text-center">المرحلة والموقع</th>
                          <th className="p-3 text-center">نقاط</th>
                          <th className="p-3 pr-0 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-bold text-sm">
                        {mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id).filter(q => {
                          const ord = q.order_number || 1;
                          const s = Math.ceil(ord / 6) - 1;
                          return s === selectedMahmahStage;
                        }).sort((a,b) => (a.order_number || 1) - (b.order_number || 1)).map(q => {
                          const ord = q.order_number || 1;
                          const stageNum = Math.ceil(ord / 6);
                          const posInStage = ((ord - 1) % 6) + 1;
                          const totalCatQs = mahmahQuestions.filter(cq => cq.category_id === selectedMahmahCategory.id).length;
                          return (
                          <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3 pl-0">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black ${q.points === 100 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : q.points === 300 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                {posInStage}
                              </span>
                            </td>
                            <td className="p-3 text-white/90 max-w-[200px] truncate">{q.text}</td>
                            <td className="p-3 text-emerald-400 font-black max-w-[150px] truncate">{q.answer}</td>
                            <td className="p-3 text-center">
                              <select value={q.order_number || 1} onChange={e => handleMoveMahmahQuestion(q.id, parseInt(e.target.value))}
                                className={`w-20 text-center py-1 rounded-lg border text-xs font-black cursor-pointer bg-black/50 focus:outline-none focus:border-amber-500 ${stageNum === selectedMahmahStage + 1 ? 'border-amber-500/50 text-amber-400' : 'border-white/10 text-white/60'}`}>
                                {Array.from({ length: totalCatQs }, (_, i) => i + 1).map(n => {
                                  const s = Math.ceil(n / 6);
                                  const p = ((n - 1) % 6) + 1;
                                  return <option key={n} value={n}>م{s} - {p}</option>;
                                })}
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              <select value={q.points || 100} onChange={e => { setIsLoading(true); supabase.from('mahmah_questions').update({ points: parseInt(e.target.value) }).eq('id', q.id).then(r => { if (r.error) showStatus('خطأ', true); else { showStatus('تم'); fetchData(); } setIsLoading(false); }) }}
                                className={`w-16 text-center py-1 rounded-lg border text-xs font-black cursor-pointer bg-black/50 ${q.points === 100 ? 'border-green-500/30 text-green-400' : q.points === 300 ? 'border-yellow-500/30 text-yellow-400' : 'border-red-500/30 text-red-400'}`}>
                                <option value={100}>100</option>
                                <option value={300}>300</option>
                                <option value={500}>500</option>
                              </select>
                            </td>
                            <td className="p-3 pr-0">
                              <div className="flex gap-1">
                                <button onClick={() => setEditingMahmahQuestion({ ...q })} className="flex-1 py-2 bg-amber-600/10 text-amber-400 hover:bg-amber-600 hover:text-white rounded-lg transition-colors flex justify-center" title="تعديل"><Edit3 size={14} /></button>
                                <button onClick={() => handleDeleteMahmahQuestion(q.id)} className="flex-1 py-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-colors flex justify-center" title="حذف"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {mahmahQuestions.filter(q => q.category_id === selectedMahmahCategory.id).filter(q => {
                          const ord = q.order_number || 1;
                          const s = Math.ceil(ord / 6) - 1;
                          return s === selectedMahmahStage;
                        }).length === 0 && (
                      <div className="py-12 text-center text-zinc-500 font-bold italic">لا توجد أسئلة في هذه المرحلة، أضف أسئلة جديدة.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HIGHER LOWER TAB */}
          {activeTab === 'higher_lower' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black text-pink-500 italic tracking-tighter">HIGHER / LOWER</h2>
                  <p className="text-zinc-500 font-bold mt-2 text-sm italic uppercase">Total Questions: {hlQuestions.length}</p>
                </div>
                <div className="flex gap-2">
                  {selectedHlStage && (
                    <button onClick={() => setSelectedHlStage(null)} className="px-6 py-3 bg-zinc-800 text-white rounded-xl font-black text-sm hover:bg-zinc-700 transition-all flex items-center gap-2">
                      العودة للمراحل
                    </button>
                  )}
                  {selectedHlStage && (
                    <button onClick={() => setIsAddingHlQuestion(true)} className="px-6 py-3 bg-pink-600/10 text-pink-500 border border-pink-500/20 rounded-xl font-black text-sm hover:bg-pink-600 hover:text-white transition-all flex items-center gap-2">
                      <Plus size={18} /> سؤال جديد
                    </button>
                  )}
                </div>
              </div>

              {!selectedHlStage ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {(() => {
                    const maxStage = Math.max(30, ...hlQuestions.map(q => q.stage_number));
                    const stagesList = Array.from({ length: maxStage + 1 }, (_, i) => i + 1);
                    return stagesList.map(stageNum => {
                      const count = hlQuestions.filter(q => q.stage_number === stageNum).length;
                      return (
                        <button key={stageNum} onClick={() => setSelectedHlStage(stageNum)} 
                          className="bg-[#0a0a0a] border border-white/5 hover:border-pink-500/50 hover:bg-pink-900/10 rounded-2xl p-4 text-center shadow-lg transition-all flex flex-col items-center justify-center gap-2 group">
                          <div className="w-12 h-12 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center font-black text-xl group-hover:bg-pink-500 group-hover:text-white transition-colors">
                            {stageNum}
                          </div>
                          <h3 className="text-white font-black">مرحلة {stageNum}</h3>
                          <p className="text-pink-400 font-bold text-xs">{count} أسئلة</p>
                        </button>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-pink-900/20 to-black border border-pink-500/20 rounded-3xl">
                    <div className="w-20 h-20 rounded-2xl bg-pink-500/20 text-pink-500 flex items-center justify-center font-black text-4xl border-2 border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                      {selectedHlStage}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white">المرحلة {selectedHlStage}</h2>
                      <p className="text-pink-400 font-bold">إدارة أسئلة أعلى أم أقل لهذه المرحلة</p>
                    </div>
                  </div>

                  {isAddingHlQuestion && (
                    <form onSubmit={handleSaveHlQuestion} className="bg-pink-900/10 border border-pink-500/20 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
                      <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4"><Plus size={20} className="text-pink-500" /> إضافة سؤال</h3>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">نص السؤال</label>
                          <input type="text" value={newHlQuestion.text} onChange={e => setNewHlQuestion({ ...newHlQuestion, text: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-pink-500 transition-all"
                            placeholder="هل عدد سكان اليابان أعلى أم أقل من 120 مليون؟" required />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">الإجابة الصحيحة</label>
                          <div className="flex gap-4">
                            <label className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${newHlQuestion.is_higher ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-white/10 bg-black/50 text-zinc-500 hover:border-white/30'}`}>
                              <input type="radio" className="hidden" checked={newHlQuestion.is_higher} onChange={() => setNewHlQuestion({ ...newHlQuestion, is_higher: true })} />
                              <span className="font-black text-lg">أعلى</span>
                            </label>
                            <label className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${!newHlQuestion.is_higher ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 bg-black/50 text-zinc-500 hover:border-white/30'}`}>
                              <input type="radio" className="hidden" checked={!newHlQuestion.is_higher} onChange={() => setNewHlQuestion({ ...newHlQuestion, is_higher: false })} />
                              <span className="font-black text-lg">أقل</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">معلومة إضافية (اختياري)</label>
                          <input type="text" value={newHlQuestion.fact} onChange={e => setNewHlQuestion({ ...newHlQuestion, fact: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-pink-500 transition-all"
                            placeholder="عدد سكان اليابان في عام 2023 هو 123.3 مليون نسمة" />
                        </div>
                      </div>
                      <div className="flex gap-3 justify-end mt-6">
                        <button type="button" onClick={() => setIsAddingHlQuestion(false)} className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-black text-sm hover:bg-white/10 transition-all">إلغاء</button>
                        <button type="submit" className="px-8 py-3 bg-pink-600 text-white rounded-xl font-black text-sm hover:bg-pink-500 transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)]">حفظ السؤال</button>
                      </div>
                    </form>
                  )}

                  <div className="bg-[#0a0a0a] rounded-3xl border border-white/5 overflow-hidden">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-black/50 text-zinc-500 text-xs font-black uppercase tracking-widest">
                          <th className="p-4">السؤال</th>
                          <th className="p-4">الإجابة الصحيحة</th>
                          <th className="p-4">معلومة إضافية</th>
                          <th className="p-4 text-center w-20">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-bold text-sm">
                        {hlQuestions.filter(q => q.stage_number === selectedHlStage).map(q => (
                          <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-4 text-white/90">{q.question_text}</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-black ${q.is_higher ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                {q.is_higher ? 'أعلى' : 'أقل'}
                              </span>
                            </td>
                            <td className="p-4 text-zinc-400 text-xs">{q.fact || '—'}</td>
                            <td className="p-4">
                              <button onClick={() => handleDeleteHlQuestion(q.id)} className="w-full py-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-colors flex justify-center"><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {hlQuestions.filter(q => q.stage_number === selectedHlStage).length === 0 && (
                      <div className="py-12 text-center text-zinc-500 font-bold italic">لا توجد أسئلة، أضف أسئلة جديدة.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STORE TAB */}
          {activeTab === 'store' && (() => {
            const filteredStoreItems = showInactive ? storeItems : storeItems.filter(i => i.is_active);
            const activeCount = storeItems.filter(i => i.is_active).length;
            const inactiveCount = storeItems.filter(i => !i.is_active).length;
            return (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-4xl font-black text-emerald-500 italic tracking-tighter">STORE INVENTORY</h2>
                  <p className="text-zinc-500 font-bold mt-2 text-sm italic uppercase">Active: {activeCount} • Hidden: {inactiveCount} • Total: {storeItems.length}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowInactive(!showInactive)} className={`px-4 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 border ${showInactive ? 'bg-zinc-800 text-white border-white/20' : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white'}`}>
                    {showInactive ? <Eye size={14} /> : <EyeOff size={14} />} {showInactive ? 'الكل' : 'النشطة فقط'}
                  </button>
                  <button onClick={() => setEditingItem({ name: '', description: '', price: 1000, image_url: '', type: 'FRAME', is_active: true })} className="px-6 py-3 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-xl font-black text-sm hover:bg-emerald-600 hover:text-black transition-all flex items-center gap-2">
                    <Plus size={18} /> Add New Item
                  </button>
                </div>
              </div>

              {editingItem && (
                <form onSubmit={handleSaveStoreItem} className="bg-emerald-900/10 border border-emerald-500/20 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  <h3 className="text-xl font-black text-white italic mb-4">{editingItem.id ? 'Edit Item' : 'New Item'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Name" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} required className="bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-black outline-none focus:border-emerald-500" />
                    
                    <div 
                      className={`relative flex gap-2 p-1 rounded-xl border-2 border-dashed transition-all ${isDragging ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]' : 'border-transparent'}`}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          setUploadingImage(true);
                          const url = await uploadToCloudinary(e.dataTransfer.files[0]);
                          if (url) setEditingItem({ ...editingItem, image_url: url });
                          else showStatus('فشل رفع الملف', true);
                          setUploadingImage(false);
                        }
                      }}
                    >
                      <input type="text" placeholder="Image URL (or drop file here)" value={editingItem.image_url} onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value })} required className="bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-black outline-none focus:border-emerald-500 flex-1" />
                      <label className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 flex items-center justify-center cursor-pointer hover:bg-emerald-500 hover:text-black transition-all text-emerald-500 min-w-[50px]" title="رفع ملف أو سحبه وإفلاته">
                        {uploadingImage ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span> : <Upload size={16} />}
                        <input type="file" accept="*/*" className="hidden" onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            setUploadingImage(true);
                            const url = await uploadToCloudinary(e.target.files[0]);
                            if (url) setEditingItem({ ...editingItem, image_url: url });
                            else showStatus('فشل رفع الملف', true);
                            setUploadingImage(false);
                          }
                        }} />
                      </label>
                    </div>
                    <input type="number" placeholder="Price" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: Number(e.target.value) })} required className="bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-black outline-none focus:border-emerald-500" />
                    <select value={editingItem.type} onChange={e => setEditingItem({ ...editingItem, type: e.target.value })} className="bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-black outline-none focus:border-emerald-500 appearance-none">
                      <option value="FRAME">FRAME (إطار)</option>
                      <option value="BADGE">BADGE (شارة)</option>
                      <option value="EFFECT">EFFECT (تأثير)</option>
                    </select>
                    <div className="flex gap-2 relative group md:col-span-2">
                      <input type="text" placeholder="Glow Color (e.g. from-purple-500 to-pink-500)" value={(() => {
                        try {
                          const config = typeof editingItem.config === 'string' ? JSON.parse(editingItem.config || '{}') : (editingItem.config || {});
                          return config.glowColor || '';
                        } catch { return ''; }
                      })()} onChange={e => {
                        try {
                          const config = typeof editingItem.config === 'string' ? JSON.parse(editingItem.config || '{}') : (editingItem.config || {});
                          config.glowColor = e.target.value;
                          setEditingItem({ ...editingItem, config: JSON.stringify(config) });
                        } catch {
                          setEditingItem({ ...editingItem, config: JSON.stringify({ glowColor: e.target.value }) });
                        }
                      }} className="bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-black outline-none focus:border-emerald-500 flex-1" />
                      
                      {/* Live Preview */}
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-black border border-white/10 relative overflow-hidden shrink-0">
                        <div className={`absolute inset-0 bg-gradient-to-br ${(() => {
                          try {
                            const config = typeof editingItem.config === 'string' ? JSON.parse(editingItem.config || '{}') : (editingItem.config || {});
                            return config.glowColor || '';
                          } catch { return ''; }
                        })()} opacity-50`}></div>
                      </div>
                    </div>
                  </div>
                  <textarea placeholder="الوصف (Description)" value={editingItem.description || ''} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} rows={2} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-emerald-500 resize-none" />
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl font-black text-xs hover:bg-zinc-700">Cancel</button>
                    <button type="submit" disabled={isLoading} className="px-6 py-2 bg-emerald-500 text-black rounded-xl font-black text-xs hover:bg-emerald-400">Save Item</button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredStoreItems.map(item => {
                  const getImageUrl = (item: any) => {
                    if (!item.image_url) return '';
                    if (item.image_url.startsWith('http') || item.image_url.startsWith('/')) return item.image_url;
                    if (item.type === 'FRAME') return `/frame/${item.image_url}`;
                    return `/assets/${item.image_url}`;
                  };
                  return (
                    <div key={item.id} className={`bg-gradient-to-b from-zinc-900 to-black border rounded-2xl p-4 flex flex-col items-center gap-3 relative group transition-all overflow-hidden ${item.is_active ? 'border-white/5 hover:border-emerald-500/30 hover:shadow-[0_10px_30px_rgba(16,185,129,0.1)]' : 'border-red-900/20 opacity-40 grayscale'}`}>
                      <div className="absolute top-0 right-0 w-24 h-full bg-emerald-500/5 skew-x-[-20deg] translate-x-12 group-hover:bg-emerald-500/10 transition-colors"></div>
                      <div className="w-16 h-16 relative flex items-center justify-center z-10">
                        {item.image_url ? (
                          <img src={getImageUrl(item)} alt={item.name} className={`max-w-full max-h-full object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-500 ${item.type === 'FRAME' ? 'scale-[1.45]' : 'scale-125'}`} onError={(e) => { (e.target as any).style.display = 'none'; }} />
                        ) : (
                          <span className="text-zinc-600 text-[10px] font-bold">No Image</span>
                        )}
                      </div>
                      <div className="text-center w-full z-10">
                        <div className="text-sm font-black text-white truncate px-2">{item.name}</div>
                        <div className="text-xs font-bold text-emerald-500 mt-1">{item.price} §</div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 bg-white/5 inline-block px-2 py-0.5 rounded-md">{item.type}</div>
                      </div>
                      <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all z-20 translate-x-4 group-hover:translate-x-0">
                        <button onClick={() => setEditingItem(item)} className="p-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-lg backdrop-blur-sm"><Edit size={14} /></button>
                        <button onClick={() => handleDeleteStoreItem(item.id)} className="p-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg backdrop-blur-sm"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
          })()}
        </div>
      </div>
    </div>
  );
};
