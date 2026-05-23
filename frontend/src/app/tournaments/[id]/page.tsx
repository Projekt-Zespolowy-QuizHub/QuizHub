'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';
import { api, type TournamentDetail } from '@/lib/api';

const STATUS_BADGE: Record<TournamentDetail['status'], { label: string; className: string }> = {
  active: { label: 'Aktywny', className: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  upcoming: { label: 'Nadchodzący', className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  finished: { label: 'Zakończony', className: 'bg-white/10 text-white/50 border border-white/10' },
};

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
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const tournamentId = Number(id);

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState(false);

  async function load() {
    if (!tournamentId || Number.isNaN(tournamentId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await api.getTournament(tournamentId);
      setTournament(data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tournamentId]);

  async function handleJoin() {
    if (!tournament) return;
    setActing(true);
    try {
      await api.joinTournament(tournament.id);
      show('Dołączyłeś do turnieju!', 'success');
      await load();
    } catch (e: any) {
      show(e.message ?? 'Nie udało się dołączyć', 'error');
    } finally {
      setActing(false);
    }
  }

  async function handleLeave() {
    if (!tournament) return;
    if (!confirm(`Na pewno chcesz opuścić turniej ${tournament.name}?`)) return;
    setActing(true);
    try {
      const res = await api.leaveTournament(tournament.id);
      show(res.message ?? 'Opuściłeś turniej', 'info');
      await load();
    } catch (e: any) {
      show(e.message ?? 'Nie udało się opuścić turnieju', 'error');
    } finally {
      setActing(false);
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

  if (notFound || !tournament) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">🏁</div>
        <h2 className="text-2xl font-bold text-white mb-2">Turniej nie znaleziony</h2>
        <p className="text-white/50 mb-6">Ten turniej nie istnieje lub został usunięty.</p>
        <Link href="/tournaments" className="btn-primary">← Powrót do turniejów</Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[tournament.status];
  const isFull = tournament.participant_count >= tournament.max_participants;
  const canJoin = tournament.status !== 'finished' && tournament.is_open && !tournament.is_participant && !isFull;

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/tournaments" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors">
        ← Powrót do turniejów
      </Link>

      {/* Header */}
      <div className="glass-card p-6 mb-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-6xl">{tournament.icon}</div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-white">{tournament.name}</h1>
              <span className={`text-xs px-2 py-1 rounded-full ${badge.className}`}>{badge.label}</span>
              {!tournament.is_open && (
                <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">🔒 Zamknięty</span>
              )}
            </div>
            {tournament.description && (
              <p className="text-white/60 text-sm mb-3 leading-relaxed">{tournament.description}</p>
            )}
            <div className="text-white/40 text-xs">Organizator: {tournament.creator_name}</div>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">📅</div>
          <div className="text-white/50 text-xs mb-1">Start</div>
          <div className="text-white text-sm font-semibold">{formatDate(tournament.start_date)}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">🏁</div>
          <div className="text-white/50 text-xs mb-1">Koniec</div>
          <div className="text-white text-sm font-semibold">{formatDate(tournament.end_date)}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">👥</div>
          <div className="text-white/50 text-xs mb-1">Uczestnicy</div>
          <div className="text-white text-sm font-semibold">{tournament.participant_count}/{tournament.max_participants}</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">🪙</div>
          <div className="text-white/50 text-xs mb-1">Nagroda</div>
          <div className="text-white text-sm font-semibold">{tournament.prize_coins} monet</div>
        </div>
      </div>

      {/* Category */}
      <div className="glass-card p-4 mb-6 flex items-center gap-3">
        <span className="text-2xl">🏷️</span>
        <div>
          <div className="text-white/50 text-xs">Kategoria</div>
          <div className="text-white font-semibold">{tournament.category}</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">🏅 Leaderboard</h2>
          <span className="text-white/40 text-sm">{tournament.participants.length} uczestników</span>
        </div>
        {tournament.participants.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">Jeszcze nikt nie dołączył</div>
        ) : (
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
              {tournament.participants.map(entry => (
                <tr key={entry.user_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <div className="flex justify-center">
                      <RankMedal rank={entry.rank} />
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{entry.avatar}</span>
                      <span className="text-white text-sm font-medium">{entry.display_name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-yellow-400 font-bold text-sm">{entry.score.toLocaleString()}</td>
                  <td className="p-3 text-right text-white/40 text-sm hidden sm:table-cell">{entry.games_played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Join / leave button */}
      <div className="text-center">
        {tournament.is_participant ? (
          tournament.status === 'finished' ? (
            <div className="glass-card p-4 inline-flex items-center gap-2 text-white/60">
              <span>🏁</span> Turniej zakończony
            </div>
          ) : (
            <button
              onClick={handleLeave}
              disabled={acting}
              className="px-8 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm disabled:opacity-50"
            >
              {acting ? '…' : 'Opuść turniej'}
            </button>
          )
        ) : tournament.status === 'finished' ? (
          <div className="glass-card p-4 inline-block text-white/40 text-sm">Turniej zakończony</div>
        ) : isFull ? (
          <div className="glass-card p-4 inline-block text-white/40 text-sm">Turniej jest pełny</div>
        ) : !tournament.is_open ? (
          <div className="glass-card p-4 inline-block text-white/40 text-sm">🔒 Turniej zamknięty</div>
        ) : (
          <button onClick={handleJoin} disabled={acting || !canJoin} className="btn-primary px-10 py-3 text-base disabled:opacity-50">
            {acting ? '…' : 'Dołącz do turnieju'}
          </button>
        )}
      </div>
    </div>
  );
}
