import React, { useState } from 'react';
import './AdminControlCenter.css';
import { adminApi } from '../services/adminCenter';
import { Icon, Particles } from './adminCenterParts';

/**
 * بوابة المشرف — كلمة سر الإدارة وحدها. الاسم لا يُطلب ولا يُرسَل:
 * هوية المشرف تُقرأ من القاعدة في /api/admin/login، والكلمة لا تظهر في الواجهة إطلاقاً.
 */
export default function AdminLogin({ onSuccess, onBack }: { onSuccess: (staffName: string, role: string) => void, onBack?: () => void }) {
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy || !password) return;
        setBusy(true);
        setError('');
        const r = await adminApi.login(password);
        setBusy(false);
        if (!r.ok || !r.staff) {
            setPassword('');
            setError(r.error || 'تعذّر تسجيل الدخول');
            return;
        }
        onSuccess(r.staff.staff_name, r.staff.role);
    };

    return (
        <div className="icc icc-gate" dir="rtl">
            <Particles />
            <form className="icc-card icc-gate-box" onSubmit={submit}>
                <div className="icc-logo" style={{ padding: '0 0 10px' }}><b>C</b><span>iCG1 ADM</span></div>
                <h1>مركز تحكم الإدارة</h1>
                <div className="icc-bc">SYSTEM ADMINISTRATION — الدخول للمشرفين فقط</div>

                <label>كلمة سر الإدارة</label>
                <input className="icc-f" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password" autoFocus />

                {error && <div className="icc-err" style={{ marginTop: 14 }}>{error}</div>}

                <button className="icc-btn" type="submit" disabled={busy || !password} style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
                    <Icon n={busy ? 'refresh' : 'key'} /> {busy ? 'جارٍ التحقق…' : 'دخول اللوحة'}
                </button>

                {onBack && (
                    <button className="icc-btn o" type="button" onClick={onBack}
                        style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
                        <Icon n="home" /> العودة للرئيسية
                    </button>
                )}

                <div style={{ color: 'var(--m)', fontSize: 12, marginTop: 14, lineHeight: 1.9 }}>
                    خمس محاولات كل خمس عشرة دقيقة، والتحقق كله في السيرفر. كل عملية داخل اللوحة تُنسَب للمشرف
                    وتُسجَّل في سجل العمليات. الجلسة تنتهي تلقائياً بعد ١٢ ساعة.
                </div>
            </form>
        </div>
    );
}
