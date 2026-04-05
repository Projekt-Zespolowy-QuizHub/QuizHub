'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useLocale } from '@/lib/LocaleContext';
import { api } from '@/lib/api';
import { useGameSocket } from '@/lib/useGameSocket';

type MatchmakingState = 'searching' | 'found' | 'error';

export default function MatchmakingPage() {
  const { user } = useRequireAuth();
  const router = useRouter();
  const { t } = useLocale();

  const [state, setState] = useState<MatchmakingState>('searching');
  const [roomCode, setRoomCode] = useState('');
  const [waitTime, setWaitTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Krok 1: pobierz następną publiczną grę i dołącz
  useEffect(() => {
    if (!user) return;

    async function joinPublicGame() {
      try {
        const game = await api.getNextPublicGame();
        await api.joinRoom({ room_code: game.code, nickname: user!.display_name });
        sessionStorage.setItem(`nick_${game.code}`, user!.display_name);
        setRoomCode(game.code);

        timerRef.current = setInterval(() => {
          setWaitTime(prev => prev + 1);
        }, 1000);
      } catch {
        setErrorMsg(t('matchmaking_no_game'));
        setState('error');
      }
    }

    joinPublicGame();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user]);

  // Krok 2: nasłuchuj na game_start przez WebSocket
  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'game_start') {
      if (timerRef.current) clearInterval(timerRef.current);
      setState('found');
      setTimeout(() => {
        router.push(`/room/${roomCode}/game`);
      }, 1000);
    }
  }, [roomCode, router]);

  useGameSocket(roomCode, handleMessage);

  function handleCancel() {
    if (timerRef.current) clearInterval(timerRef.current);
    router.back();
  }

  if (state === 'error') {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="glass-card p-10 text-center max-w-md w-full">
          <div className="text-5xl mb-4">😞</div>
          <p className="text-red-400 mb-6">{errorMsg}</p>
          <button onClick={() => router.back()} className="btn-primary">
            {t('common_back')}
          </button>
        </div>
      </div>
    );
  }

  if (state === 'found') {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="glass-card p-10 text-center max-w-md w-full">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-white text-xl font-bold">{t('matchmaking_found')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="glass-card p-10 text-center max-w-md w-full">
        {/* Animowany spinner */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-white/10" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#6C63FF] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div
            className="absolute inset-3 rounded-full border-4 border-t-transparent border-r-yellow-400 border-b-transparent border-l-transparent animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">⚔️</div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{t('matchmaking_searching')}</h1>

        {/* Pulsujące kropki */}
        <div className="flex justify-center gap-1.5 mb-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#6C63FF] animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>

        <p className="text-white/40 text-sm mb-8">
          {t('matchmaking_wait_time')} {waitTime}s
        </p>

        <button
          onClick={handleCancel}
          className="px-8 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors text-sm"
        >
          {t('matchmaking_cancel')}
        </button>
      </div>
    </div>
  );
}
