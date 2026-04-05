'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';
import { useLocale } from '@/lib/LocaleContext';
import { api } from '@/lib/api';

interface PublicGame {
  code: string;
  categories: string[];
  scheduled_at: string;
  player_count: number;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  score: number;
  gamesPlayed: number;
}

// Mock leaderboard — backend nie ma per-turniej leaderboard endpoint
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: 'QuizMaster', avatar: '🦊', score: 2840, gamesPlayed: 12 },
  { rank: 2, name: 'KnowledgeKing', avatar: '🧙', score: 2610, gamesPlayed: 11 },
  { rank: 3, name: 'BrainiacPro', avatar: '🤖', score: 2490, gamesPlayed: 12 },
  { rank: 4, name: 'TriviaLord', avatar: '🐉', score: 2210, gamesPlayed: 10 },
  { rank: 5, name: 'SmartyCat', avatar: '🥷', score: 1980, gamesPlayed: 9 },
];

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-400 font-bold">🥇</span>;
  if (rank === 2) return <span className="text-gray-300 font-bold">🥈</span>;
  if (rank === 3) return <span className="text-amber-600 font-bold">🥉</span>;
  return <span className="text-white/40 text-sm">{rank}</span>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TournamentDetailPage() {
  useRequireAuth();
  const { show } = useToast();
  const { t } = useLocale();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [game, setGame] = useState<PublicGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.getNextPublicGame()
      .then(data => setGame(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleJoin() {
    if (!game) return;
    try {
      setJoined(true);
      show('Dołączyłeś do turnieju!', 'success');
    } catch {
      show(t('error_generic'), 'error');
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="glass-card p-8 animate-pulse">
          <div className="h-8 w-64 bg-white/10 rounded mb-4" />
          <div className="h-4 w-48 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (notFound || !game) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">🏁</div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('tournaments_no_tournaments')}</h2>
        <p className="text-white/50 mb-6">Brak zaplanowanych turniejów. Sprawdź ponownie później.</p>
        <Link href="/tournaments" className="btn-primary">← {t('common_back')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link href="/tournaments" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors">
        ← Powrót do turniejów
      </Link>

      {/* Header */}
      <div className="glass-card p-6 mb-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-6xl">🏆</div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-white">Turniej Publiczny</h1>
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                {t('tournaments_active')}
              </span>
            </div>
            <p className="text-white/60 text-sm mb-3">
              Gra #{game.code} · {game.player_count} graczy dołączyło
            </p>
            <div className="flex flex-wrap gap-2">
              {game.categories.map(cat => (
                <span key={cat} className="text-xs bg-white/10 text-white/70 rounded-full px-3 py-1">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">📅</div>
          <div className="text-white/50 text-xs mb-1">{t('tournaments_starts')}</div>
          <div className="text-white text-sm font-semibold">{formatDate(game.scheduled_at)}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">👥</div>
          <div className="text-white/50 text-xs mb-1">{t('tournaments_participants')}</div>
          <div className="text-white text-sm font-semibold">{game.player_count}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">🏷️</div>
          <div className="text-white/50 text-xs mb-1">Kategorie</div>
          <div className="text-white text-sm font-semibold">{game.categories.join(', ')}</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">🏅 Ostatnie wyniki</h2>
        </div>
        <table className="w-full text-white">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left p-3 text-white/50 text-sm font-medium w-12">Miejsce</th>
              <th className="text-left p-3 text-white/50 text-sm font-medium">Gracz</th>
              <th className="text-right p-3 text-white/50 text-sm font-medium">Wynik</th>
              <th className="text-right p-3 text-white/50 text-sm font-medium hidden sm:table-cell">Gry</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LEADERBOARD.map(entry => (
              <tr key={entry.rank} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-3">
                  <div className="flex justify-center">
                    <RankMedal rank={entry.rank} />
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{entry.avatar}</span>
                    <span className="text-white text-sm font-medium">{entry.name}</span>
                  </div>
                </td>
                <td className="p-3 text-right text-yellow-400 font-bold text-sm">{entry.score.toLocaleString()}</td>
                <td className="p-3 text-right text-white/40 text-sm hidden sm:table-cell">{entry.gamesPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Join button */}
      <div className="text-center">
        {joined ? (
          <div className="glass-card p-4 inline-flex items-center gap-2 text-green-300">
            <span>✅</span> Dołączyłeś do turnieju
          </div>
        ) : (
          <button onClick={handleJoin} className="btn-primary px-10 py-3 text-base">
            {t('tournaments_join')}
          </button>
        )}
      </div>
    </div>
  );
}
