'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { api } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

export default function JoinGamePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { t } = useLocale();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const nickname = user?.display_name ?? 'Player';
    try {
      const data = await api.joinRoom({
        nickname,
        room_code: code.trim().toUpperCase(),
      });
      sessionStorage.setItem(`nick_${data.room_code}`, nickname);
      router.push(`/room/${data.room_code}/lobby`);
    } catch {
      setError(t('join_error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <form onSubmit={handleJoin} className="glass-card p-8 w-full max-w-sm">
        <h2 className="text-2xl font-bold text-yellow-400 mb-6">{t('join_title')}</h2>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <label className="block text-white/70 text-sm mb-1">{t('join_code_label')}</label>
        <input
          type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder={t('join_placeholder')} maxLength={6}
          className="w-full bg-white rounded-lg px-4 py-2 text-black mb-6 uppercase tracking-widest font-mono text-lg" required
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('join_joining') : t('join_btn')}
        </button>
      </form>
    </div>
  );
}
