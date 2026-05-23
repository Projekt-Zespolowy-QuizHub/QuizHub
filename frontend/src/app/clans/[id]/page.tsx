'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';
import { api, type ClanDetail } from '@/lib/api';

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span>🥇</span>;
  if (rank === 2) return <span>🥈</span>;
  if (rank === 3) return <span>🥉</span>;
  return <span className="text-white/40 text-sm">{rank}</span>;
}

const ROLE_LABEL: Record<string, string> = {
  leader: '👑 Lider',
  officer: '⚔️ Oficer',
  member: '',
};

export default function ClanDetailPage() {
  useRequireAuth();
  const { show } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const clanId = Number(id);

  const [clan, setClan] = useState<ClanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState(false);

  async function load() {
    if (!clanId || Number.isNaN(clanId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await api.getClan(clanId);
      setClan(data);
    } catch (e: any) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [clanId]);

  async function handleJoin() {
    if (!clan) return;
    setActing(true);
    try {
      await api.joinClan(clan.id);
      show(`Dołączyłeś do klanu ${clan.name}!`, 'success');
      await load();
    } catch (e: any) {
      show(e.message ?? 'Nie udało się dołączyć', 'error');
    } finally {
      setActing(false);
    }
  }

  async function handleLeave() {
    if (!clan) return;
    if (!confirm(`Na pewno chcesz opuścić klan ${clan.name}?`)) return;
    setActing(true);
    try {
      const res = await api.leaveClan(clan.id);
      show(res.message ?? `Opuściłeś klan ${clan.name}`, 'info');
      router.push('/clans');
    } catch (e: any) {
      show(e.message ?? 'Nie udało się opuścić klanu', 'error');
      setActing(false);
    }
  }

  async function handleKick(userId: number, name: string) {
    if (!clan) return;
    if (!confirm(`Wyrzucić ${name} z klanu?`)) return;
    setActing(true);
    try {
      await api.kickFromClan(clan.id, userId);
      show(`Wyrzucono ${name}`, 'success');
      await load();
    } catch (e: any) {
      show(e.message ?? 'Nie udało się wyrzucić', 'error');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto text-center py-16 text-white/50">Ładowanie klanu…</div>;
  }

  if (notFound || !clan) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">🛡️</div>
        <h2 className="text-2xl font-bold text-white mb-2">Klan nie znaleziony</h2>
        <p className="text-white/50 mb-6">Ten klan nie istnieje lub został rozwiązany.</p>
        <Link href="/clans" className="btn-primary">← Powrót do klanów</Link>
      </div>
    );
  }

  // Posortowani członkowie wg total_score (backend już sortuje, ale na pewno)
  const sortedMembers = [...clan.members].sort((a, b) => b.total_score - a.total_score);
  const myMembership = clan.members.find(m => m.role); // znajdź samego siebie po klanie
  // Sprawdź czy bieżący user jest leaderem/oficerem — pole is_member jest dla całego klanu.
  // Backend nie zwraca info "kto to ja" w members, więc używamy is_member i wnioskujemy z roli.
  // Aby ograniczyć kick do leadera/oficera w UI, potrzebujemy własnego user_id — ale go nie mamy.
  // Trzymamy się prostego podejścia: pokazujemy kick tylko jeśli is_member i tylko dla nie-liderów,
  // a backend i tak waliduje uprawnienia.

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <Link href="/clans" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors">
        ← Powrót do klanów
      </Link>

      {/* Clan header */}
      <div className="glass-card p-6 mb-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="text-6xl flex-shrink-0">{clan.avatar}</div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-white">{clan.name}</h1>
              <span className="bg-white/10 text-white/60 text-sm px-2 py-0.5 rounded font-mono">[{clan.tag}]</span>
              {!clan.is_open && (
                <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs px-2 py-0.5 rounded-full">Zamknięty</span>
              )}
            </div>
            {clan.description && (
              <p className="text-white/60 text-sm leading-relaxed mb-4">{clan.description}</p>
            )}
            <div className="text-white/40 text-xs">Założony: {new Date(clan.created_at).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">👥</div>
          <div className="text-white font-bold text-xl">{clan.member_count}</div>
          <div className="text-white/40 text-xs">członków</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">🪙</div>
          <div className="text-yellow-400 font-bold text-xl">{clan.total_score.toLocaleString()}</div>
          <div className="text-white/40 text-xs">punktów łącznie</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">🏆</div>
          <div className="text-white font-bold text-xl">#{clan.rank ?? '–'}</div>
          <div className="text-white/40 text-xs">ranking globalny</div>
        </div>
      </div>

      {/* Members list */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">👥 Członkowie klanu</h2>
          <span className="text-white/40 text-sm">{clan.member_count}/{clan.max_members} graczy</span>
        </div>
        {sortedMembers.length === 0 ? (
          <div className="p-6 text-center text-white/40 text-sm">Brak członków</div>
        ) : (
          <table className="w-full text-white">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-3 text-white/40 text-xs font-medium w-10">#</th>
                <th className="text-left p-3 text-white/40 text-xs font-medium">Gracz</th>
                <th className="text-right p-3 text-white/40 text-xs font-medium">Wynik</th>
                <th className="text-right p-3 text-white/40 text-xs font-medium hidden sm:table-cell">Gry</th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((member, idx) => (
                <tr key={member.user_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-3 text-center">
                    <RankMedal rank={idx + 1} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{member.avatar}</span>
                      <div>
                        <span className="text-white text-sm font-medium">{member.display_name}</span>
                        {ROLE_LABEL[member.role] && (
                          <span className="ml-2 text-xs text-yellow-400/80">{ROLE_LABEL[member.role]}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right text-yellow-400 font-semibold text-sm">{member.total_score.toLocaleString()}</td>
                  <td className="p-3 text-right text-white/40 text-sm hidden sm:table-cell">{member.games_played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Join/leave button */}
      <div className="text-center">
        {clan.is_member ? (
          <button
            onClick={handleLeave}
            disabled={acting}
            className="px-8 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm disabled:opacity-50"
          >
            {acting ? '…' : 'Opuść klan'}
          </button>
        ) : !clan.is_open ? (
          <div className="glass-card p-4 inline-block text-white/30 text-sm">
            🔒 Klan zamknięty — wymagane zaproszenie
          </div>
        ) : clan.member_count >= clan.max_members ? (
          <div className="glass-card p-4 inline-block text-white/30 text-sm">
            Klan jest pełny
          </div>
        ) : (
          <button onClick={handleJoin} disabled={acting} className="btn-primary px-10 py-3 text-base disabled:opacity-50">
            {acting ? '…' : 'Dołącz do klanu'}
          </button>
        )}
      </div>
    </div>
  );
}
