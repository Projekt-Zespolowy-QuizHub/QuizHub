'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';
import { api, type Tournament } from '@/lib/api';

type TabFilter = 'active' | 'upcoming' | 'finished';

const TAB_LABELS: Record<TabFilter, string> = {
  active: 'Aktywne',
  upcoming: 'Nadchodzące',
  finished: 'Zakończone',
};

const STATUS_BADGE: Record<Tournament['status'], { label: string; className: string }> = {
  active: { label: 'Aktywny', className: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  upcoming: { label: 'Nadchodzący', className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  finished: { label: 'Zakończony', className: 'bg-white/10 text-white/50 border border-white/10' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TournamentsPage() {
  useRequireAuth();
  const { show } = useToast();
  const [tab, setTab] = useState<TabFilter>('active');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(filter: TabFilter) {
    try {
      setLoading(true);
      const data = await api.listTournaments(filter);
      setTournaments(data);
    } catch (e: any) {
      show(e.message ?? 'Nie udało się załadować turniejów', 'error');
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(tab);
  }, [tab]);

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
      {loading ? (
        <div className="glass-card p-10 text-center text-white/50">Ładowanie turniejów…</div>
      ) : tournaments.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">🏁</div>
          <p className="text-white/50 text-lg mb-2">Brak turniejów</p>
          <p className="text-white/30 text-sm">
            {tab === 'upcoming' ? 'Żadne turnieje nie są zaplanowane.' : tab === 'active' ? 'Żadne turnieje nie trwają teraz.' : 'Brak zakończonych turniejów.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 stagger-children">
          {tournaments.map(tournament => {
            const isFull = tournament.participant_count >= tournament.max_participants;
            const badge = STATUS_BADGE[tournament.status];
            const fillPct = Math.round((tournament.participant_count / tournament.max_participants) * 100);

            return (
              <div key={tournament.id} className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="text-4xl flex-shrink-0">{tournament.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-white font-bold text-lg">{tournament.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                    {tournament.is_participant && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#6C63FF]/20 text-[#a5a0ff] border border-[#6C63FF]/30">
                        ✓ Dołączyłeś
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/50 mb-2">
                    <span>📅 {formatDate(tournament.start_date)} – {formatDate(tournament.end_date)}</span>
                    <span>🏷️ {tournament.category}</span>
                    {tournament.prize_coins > 0 && <span>🪙 {tournament.prize_coins} monet</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isFull ? 'bg-red-400' : 'bg-yellow-400'}`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/40 flex-shrink-0">
                      {tournament.participant_count}/{tournament.max_participants}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Link
                    href={`/tournaments/${tournament.id}`}
                    className={`block text-center text-sm px-5 py-2 rounded-xl transition-colors ${
                      tournament.status === 'finished'
                        ? 'bg-white/10 text-white/60 hover:bg-white/15'
                        : 'btn-primary'
                    }`}
                  >
                    {tournament.status === 'finished' ? 'Wyniki' : 'Szczegóły'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
