import React, { useState } from 'react';
import { Home } from 'lucide-react';

interface GameBackButtonProps {
  onHome: () => void;
  /** الشاشات التي تملأ الشاشة بدون Layout تحتاج تثبيتاً على المنفذ */
  fixed?: boolean;
  label?: string;
}

/**
 * زر الرجوع الوحيد لكل الألعاب. الهندسة والألوان inline عمداً: طريق الخروج من
 * لعبة لا يجوز أن يعتمد على تحميل إطار التنسيقات أو على ألوان الصفحة المضيفة.
 */
export const GameBackButton: React.FC<GameBackButtonProps> = ({ onHome, fixed, label = 'الرئيسية' }) => {
  const [hot, setHot] = useState(false);
  const [press, setPress] = useState(false);
  return (
    <button
      type="button"
      onClick={onHome}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => { setHot(false); setPress(false); }}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      title={`العودة إلى ${label}`}
      aria-label={`العودة إلى ${label}`}
      style={{
        position: fixed ? 'fixed' : 'absolute',
        zIndex: 120,
        right: 12,
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 999,
        border: `1px solid ${hot ? '#e8be6e' : 'rgba(232,190,110,0.45)'}`,
        background: hot ? '#e8be6e' : 'rgba(11,7,6,0.85)',
        color: hot ? '#1a1006' : '#fbeccb',
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1,
        cursor: 'pointer',
        transform: press ? 'scale(0.95)' : 'none',
        transition: 'background .18s ease, color .18s ease, border-color .18s ease, transform .12s ease',
        boxShadow: '0 8px 26px rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <Home size={13} strokeWidth={2.6} />
      <span>{label}</span>
    </button>
  );
};
