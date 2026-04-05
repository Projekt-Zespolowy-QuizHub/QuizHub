'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useLocale } from '@/lib/LocaleContext';
import { useAuth } from '@/lib/AuthProvider';
import { api } from '@/lib/api';
import { useGameSocket } from '@/lib/useGameSocket';

type DuelState = 'idle' | 'searching' | 'found';

const CATEGORIES = [
  { value: 'random', label: '🎲 Losowa' },
  { value: 'Historia', label: '🌍 Historia' },
  { value: 'Nauka', label: '🔬 Nauka' },
  { value: 'Kultura', label: '🎭 Kultura' },
  { value: 'Sport', label: '⚽ Sport' },
  { value: 'Technologia', label: '💻 Technologia' },
  { value: 'Film i Seriale', label: '🎬 Film i Seriale' },
];

function HowItWorksStep({ number, text, icon }: { number: number; text: string; icon: string }) {
  return (
    <div className="flex flex-col items-center text-center p-4">
      <div className="w-10 h-10 rounded-full bg-[#6C63FF]/20 border border-[#6C63FF]/40 flex items-center justify-center text-lg mb-3">
        {icon}
      </div>
      <div className="text-yellow-400 text-xs font-bold mb-1">KROK {number}</div>
      <p className="text-white/70 text-sm">{text}</p>
    </div>
  );
}

export default function DuelPage() {
  const { user } = useRequireAuth();
  const { user: authUser } = useAuth();
  const router = useRouter();
  const { t } = useLocale();

  const [category, setCategory] = useState('random');
  const [state, setState] = useState<DuelState>('idle');
  const [searchTime, setSearchTime] = useState(0);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Nasłuchuj game_start gdy mamy kod pokoju
  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'game_start' || msg.type === 'player_joined') {
      if (msg.type === 'game_start') {
        if (timerRef.current) clearInterval(timerRef.current);
        setState('found');
        setTimeout(() => {
          router.push(`/room/${roomCode}/lobby`);
        }, 800);
      }
    }
  }, [roomCode, router]);

  useGameSocket(roomCode, handleMessage);

  async function startSearch() {
    if (!authUser) return;
    setState('searching');
    setSearchTime(0);
    setError('');

    timerRef.current = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);

    try {
      // Utwórz pokój z wybraną kategorią i dołącz
      const cats = category === 'random'
        ? ['Historia', 'Nauka', 'Kultura']
        : [category];

      const room = await api.createRoom({
        host_nickname: authUser.display_name,
        categories: cats,
        total_rounds: 10,
      });

      sessionStorage.setItem(`nick_${room.code}`, authUser.display_name);
      setRoomCode(room.code);

      // Przekieruj do lobby — tam czeka na drugiego gracza
      if (timerRef.current) clearInterval(timerRef.current);
      setState('found');
      setTimeout(() => {
        router.push(`/room/${room.code}/lobby`);
      }, 800);
    } catch {
      if (timerRef.current) clearInterval(timerRef.current);
      setError('Nie udało się znaleźć gry. Spróbuj ponownie.');
      setState('idle');
    }
  }

  function cancelSearch() {
    if (timerRef.current) clearInterval(timerRef.current);
    setState('idle');
    setSearchTime(0);
    setRoomCode('');
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const selectedCategoryLabel = CATEGORIES.find(c => c.value === category)?.label ?? 'Losowa';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8 animate-fade-in-up">
        <div className="text-6xl mb-3">⚔️</div>
        <h1 className="text-4xl font-bold text-white mb-2">{t('duel_title')}</h1>
        <p className="text-white/60 text-lg">Zmierz się z losowym przeciwnikiem w błyskawicznym pojedynku!</p>
      </div>

      {error && (
        <div className="glass-card p-4 mb-4 text-center text-red-400 text-sm">{error}</div>
      )}

      {/* Main card */}
      {state === 'idle' && (
        <div className="glass-card p-8 mb-6 animate-fade-in-up">
          <h2 className="text-white font-bold text-lg mb-4 text-center">Wybierz kategorię</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`py-3 px-3 rounded-xl text-sm font-medium transition-all border text-left ${
                  category === cat.value
                    ? 'bg-[#6C63FF] border-[#6C63FF] text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            onClick={startSearch}
            className="btn-primary w-full py-4 text-lg font-bold"
          >
            ⚔️ {t('duel_find_opponent')}
          </button>
          <p className="text-center text-white/30 text-xs mt-3">{t('duel_category')}: {selectedCategoryLabel}</p>
        </div>
      )}

      {state === 'searching' && (
        <div className="glass-card p-10 mb-6 text-center animate-fade-in-up">
          {/* Animowany spinner */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#6C63FF] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full border-4 border-t-transparent border-r-yellow-400 border-b-transparent border-l-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">⚔️</div>
          </div>

          <h2 className="text-white text-xl font-bold mb-1">{t('duel_searching')}</h2>
          <p className="text-white/50 text-sm mb-2">{t('duel_category')}: {selectedCategoryLabel}</p>
          <p className="text-white/30 text-xs mb-8">Czas oczekiwania: {searchTime}s</p>

          <div className="flex justify-center gap-1.5 mb-8">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-[#6C63FF] animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>

          <button
            onClick={cancelSearch}
            className="px-8 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors text-sm"
          >
            {t('duel_cancel')}
          </button>
        </div>
      )}

      {state === 'found' && (
        <div className="glass-card p-10 mb-6 text-center animate-fade-in-up">
          <div className="text-green-400 text-5xl mb-3">✅</div>
          <h2 className="text-white text-2xl font-bold mb-1">Pokój gotowy!</h2>
          <p className="text-white/50 text-sm">Przekierowuję do lobby...</p>
        </div>
      )}

      {/* How it works */}
      {state === 'idle' && (
        <div className="glass-card p-6 animate-fade-in-up">
          <h2 className="text-white font-bold text-center mb-4">Jak to działa?</h2>
          <div className="grid grid-cols-3 gap-2 divide-x divide-white/10">
            <HowItWorksStep number={1} icon="🎯" text="10 pytań z wybranej kategorii" />
            <HowItWorksStep number={2} icon="⏱️" text="30 sekund na każdą odpowiedź" />
            <HowItWorksStep number={3} icon="🏆" text="Zwycięzca zdobywa punkty rankingowe" />
          </div>
        </div>
      )}
    </div>
  );
}
