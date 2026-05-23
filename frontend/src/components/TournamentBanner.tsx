'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface PublicTournamentData {
  room_id: string;
  start_time: string;
  player_count: number;
  max_players: number;
  seconds_until_start: number;
  interval_minutes: number;
  categories: string[];
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const DISMISS_KEY = 'tournament_banner_dismissed';

export default function TournamentBanner() {
  const [data, setData] = useState<PublicTournamentData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sprawdź czy banner był wcześniej odrzucony w tej sesji
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    }
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/tournaments/next-public/', { cache: 'no-store' });
      if (!res.ok || res.status === 204) {
        setData(null);
        return;
      }
      const json: PublicTournamentData = await res.json();
      setData(json);
      setSecondsLeft(json.seconds_until_start);
    } catch {
      setData(null);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRef.current = setInterval(fetchData, 30_000);
    return () => {
      if (fetchRef.current) clearInterval(fetchRef.current);
    };
  }, []);

  // Odliczanie co sekundę
  useEffect(() => {
    if (!data) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [data]);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  if (!data || dismissed) return null;

  const isLive = secondsLeft <= 0;

  return (
    <div
      className="relative w-full text-white text-sm font-medium"
      style={{
        background: 'linear-gradient(90deg, #6C63FF 0%, #9333ea 50%, #7c3aed 100%)',
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        {/* Lewa — ikona + tekst + timer */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">🏆</span>
          <span className="truncate">
            {isLive ? (
              <span className="font-bold">Turniej trwa! Dołącz teraz!</span>
            ) : (
              <>
                <span className="hidden sm:inline">Następny turniej publiczny za: </span>
                <span className="sm:hidden">Turniej za: </span>
                <span className="font-bold tabular-nums">{formatCountdown(secondsLeft)}</span>
              </>
            )}
          </span>
        </div>

        {/* Środek — liczba graczy */}
        <span className="text-white/70 text-xs shrink-0 hidden sm:block">
          {data.player_count}/{data.max_players} graczy
        </span>

        {/* Prawa — przycisk dołącz + zamknij */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/room/${data.room_id}/lobby`}
            className="bg-white text-purple-700 font-bold text-xs px-3 py-1 rounded-lg hover:bg-white/90 transition-colors"
          >
            Dołącz
          </Link>
          <button
            onClick={handleDismiss}
            aria-label="Ukryj banner"
            className="text-white/60 hover:text-white transition-colors p-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
