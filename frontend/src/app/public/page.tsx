'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { api } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';

export default function PublicGamePage() {
  const { user } = useRequireAuth();
  const router = useRouter();
  const { t } = useLocale();
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState('--:--');
  const [noGame, setNoGame] = useState(false);

  useEffect(() => {
    api.getNextPublicGame()
      .then(data => {
        setScheduledAt(data.scheduled_at);
        setCode(data.code);
      })
      .catch(() => setNoGame(true));
  }, []);

  useEffect(() => {
    if (!scheduledAt) return;
    const interval = setInterval(() => {
      const diff = new Date(scheduledAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('00:00'); clearInterval(interval); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [scheduledAt]);

  async function handleJoin() {
    if (!code || !user) return;
    try {
      await api.joinRoom({ room_code: code, nickname: user.display_name });
      sessionStorage.setItem(`nick_${code}`, user.display_name);
      router.push(`/room/${code}/lobby`);
    } catch {}
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="glass-card p-10 text-center max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-2">{t('public_title')}</h1>
        {noGame ? (
          <p className="text-white/50 mt-4">{t('public_no_game')}</p>
        ) : (
          <>
            <p className="text-white/60 text-sm mb-6">{t('public_next_game')}</p>
            <p className="text-6xl font-bold text-white mb-4 font-mono">{timeLeft}</p>
            <p className="text-white/50 text-sm mb-6">{t('public_categories_random')}</p>
            <button onClick={handleJoin} className="btn-primary text-lg px-8 py-3">
              {t('public_join')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
