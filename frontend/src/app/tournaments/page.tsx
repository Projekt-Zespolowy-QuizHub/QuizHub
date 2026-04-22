'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/useRequireAuth';

type TournamentStatus = 'active' | 'upcoming' | 'finished';
type TabFilter = 'active' | 'upcoming' | 'finished';

interface Tournament {
  id: number;
  name: string;
  icon: string;
  status: TournamentStatus;
  startDate: string;
  endDate: string;
  participants: number;
  maxParticipants: number;
  prize: string;
  category: string;
}

const MOCK_TOURNAMENTS: Tournament[] = [
  { id: 1, name: 'Mistrzostwa Wiedzy', icon: '🏆', status: 'active', startDate: '2026-03-20', endDate: '2026-03-27', participants: 48, maxParticipants: 64, prize: '1000 monet', category: 'Ogólna wiedza' },
  { id: 2, name: 'Quiz Naukowy', icon: '🔬', status: 'active', startDate: '2026-03-21', endDate: '2026-03-28', participants: 32, maxParticipants: 32, prize: '500 monet', category: 'Nauka' },
  { id: 3, name: 'Historia Świata', icon: '🌍', status: 'upcoming', startDate: '2026-04-01', endDate: '2026-04-07', participants: 12, maxParticipants: 64, prize: '750 monet', category: 'Historia' },
  { id: 4, name: 'Wiosenny Turniej', icon: '🌸', status: 'upcoming', startDate: '2026-04-15', endDate: '2026-04-22', participants: 0, maxParticipants: 32, prize: '2000 monet', category: 'Mieszana' },
  { id: 5, name: 'Turniej Filmowy', icon: '🎬', status: 'finished', startDate: '2026-03-01', endDate: '2026-03-07', participants: 64, maxParticipants: 64, prize: '1000 monet', category: 'Film i muzyka' },
  { id: 6, name: 'Liga Sportowa', icon: '⚽', status: 'finished', startDate: '2026-02-10', endDate: '2026-02-17', participants: 32, maxParticipants: 32, prize: '600 monet', category: 'Sport' },
];

const TAB_LABELS: Record<TabFilter, string> = {
  active: 'Aktywne',
  upcoming: 'Nadchodzące',
  finished: 'Zakończone',
};

const STATUS_BADGE: Record<TournamentStatus, { label: string; className: string }> = {
  active: { label: 'Aktywny', className: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  upcoming: { label: 'Nadchodzący', className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  finished: { label: 'Zakończony', className: 'bg-white/10 text-white/50 border border-white/10' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TournamentsPage() {
  useRequireAuth();
  const [tab, setTab] = useState<TabFilter>('active');

  const filtered = MOCK_TOURNAMENTS.filter(t => t.status === tab);
  const tabs: TabFilter[] = ['active', 'upcoming', 'finished'];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Turnieje</h1>
          <p className="text-white/50 text-sm">Rywalizuj z graczami z całego świata</p>
        </div>
        <Link href="/tournaments/create" className="btn-primary text-sm">+ Utwórz turniej</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-white/15 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tournament cards */}
      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">🏁</div>
          <p className="text-white/50 text-lg mb-2">Brak turniejów</p>
          <p className="text-white/30 text-sm">
            {tab === 'upcoming' ? 'Żadne turnieje nie są zaplanowane.' : tab === 'active' ? 'Żadne turnieje nie trwają teraz.' : 'Brak zakończonych turniejów.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 stagger-children">
          {filtered.map(tournament => {
            const isFull = tournament.participants >= tournament.maxParticipants;
            const badge = STATUS_BADGE[tournament.status];
            const fillPct = Math.round((tournament.participants / tournament.maxParticipants) * 100);

            return (
              <div key={tournament.id} className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="text-4xl flex-shrink-0">{tournament.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-white font-bold text-lg">{tournament.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/50 mb-2">
                    <span>📅 {formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}</span>
                    <span>🏷️ {tournament.category}</span>
                    <span>🪙 {tournament.prize}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isFull ? 'bg-red-400' : 'bg-yellow-400'}`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/40 flex-shrink-0">
                      {tournament.participants}/{tournament.maxParticipants}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {tournament.status === 'finished' ? (
                    <Link
                      href={`/tournaments/${tournament.id}`}
                      className="block text-center text-sm px-5 py-2 rounded-xl bg-white/10 text-white/60 hover:bg-white/15 transition-colors"
                    >
                      Wyniki
                    </Link>
                  ) : isFull ? (
                    <span className="block text-center text-sm px-5 py-2 rounded-xl bg-white/5 text-white/30 border border-white/10 cursor-not-allowed">
                      Pełny
                    </span>
                  ) : (
                    <Link
                      href={`/tournaments/${tournament.id}`}
                      className="block text-center btn-primary text-sm px-5 py-2"
                    >
                      Dołącz
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
