'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';
import { api, type Clan } from '@/lib/api';

export default function ClansPage() {
  useRequireAuth();
  const { show } = useToast();
  const [search, setSearch] = useState('');
  const [clans, setClans] = useState<Clan[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);
      const data = await api.listClans();
      setClans(data);
    } catch (e: any) {
      show(e.message ?? 'Nie udało się załadować klanów', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const myClan = clans.find(c => c.is_member) ?? null;
  const otherClans = clans.filter(c => !c.is_member);
  const filtered = otherClans.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.tag.toLowerCase().includes(search.toLowerCase())
  );

  async function handleJoin(clan: Clan) {
    if (clan.member_count >= clan.max_members) {
      show('Klan jest pełny', 'error');
      return;
    }
    setJoiningId(clan.id);
    try {
      await api.joinClan(clan.id);
      show(`Dołączyłeś do klanu ${clan.name}!`, 'success');
      await load();
    } catch (e: any) {
      show(e.message ?? 'Nie udało się dołączyć', 'error');
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Klany</h1>
          <p className="text-white/50 text-sm">Dołącz do klanu i rywalizuj razem</p>
        </div>
        {!myClan && (
          <Link href="/clans/create" className="btn-primary text-sm">+ Utwórz klan</Link>
        )}
      </div>

      {loading ? (
        <div className="glass-card p-10 text-center text-white/50">Ładowanie klanów…</div>
      ) : (
        <>
          {/* My clan */}
          {myClan && (
            <div className="mb-8">
              <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-3">Twój klan</h2>
              <Link href={`/clans/${myClan.id}`} className="glass-card p-5 flex items-center gap-4 block hover:bg-white/5 transition-colors">
                <div className="text-5xl">{myClan.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-xl">{myClan.name}</span>
                    <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded font-mono">[{myClan.tag}]</span>
                  </div>
                  <p className="text-white/50 text-sm">Lider: {myClan.leader}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="text-yellow-400 font-bold text-lg">{myClan.total_score.toLocaleString()}</div>
                  <div className="text-white/40 text-xs">pkt łącznie</div>
                  <div className="text-white/50 text-xs">{myClan.member_count}/{myClan.max_members} graczy</div>
                </div>
              </Link>
            </div>
          )}

          {/* Search */}
          <div className="mb-5">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Szukaj klanu po nazwie lub tagu..."
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#6C63FF]/50 transition-colors"
            />
          </div>

          {/* All clans */}
          <div>
            <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-3">Wszystkie klany</h2>

            {filtered.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <div className="text-5xl mb-3">🔍</div>
                <p className="text-white/50">
                  {search
                    ? `Nie znaleziono klanów pasujących do "${search}"`
                    : otherClans.length === 0
                      ? 'Brak klanów do dołączenia — utwórz swój własny!'
                      : 'Brak klanów'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 stagger-children">
                {filtered.map(clan => {
                  const isFull = clan.member_count >= clan.max_members;
                  const isJoining = joiningId === clan.id;

                  return (
                    <div key={clan.id} className="glass-card p-4 flex items-center gap-4">
                      <div className="text-white/30 text-sm font-bold w-6 text-center flex-shrink-0">{clan.rank ?? '–'}</div>
                      <div className="text-3xl flex-shrink-0">{clan.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Link href={`/clans/${clan.id}`} className="text-white font-semibold hover:text-yellow-400 transition-colors truncate">
                            {clan.name}
                          </Link>
                          <span className="bg-white/10 text-white/50 text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0">[{clan.tag}]</span>
                          {!clan.is_open && <span className="text-white/30 text-xs flex-shrink-0">🔒</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/40">
                          <span>Lider: {clan.leader || '—'}</span>
                          <span>{clan.member_count}/{clan.max_members} graczy</span>
                          <span className="text-yellow-400/70">{clan.total_score.toLocaleString()} pkt</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isFull ? (
                          <span className="text-white/30 text-xs border border-white/10 rounded-lg px-3 py-1.5">Pełny</span>
                        ) : !clan.is_open ? (
                          <span className="text-white/30 text-xs border border-white/10 rounded-lg px-3 py-1.5">Zamknięty</span>
                        ) : myClan ? (
                          <span className="text-white/30 text-xs border border-white/10 rounded-lg px-3 py-1.5">Masz już klan</span>
                        ) : (
                          <button
                            onClick={() => handleJoin(clan)}
                            disabled={isJoining}
                            className="text-sm px-4 py-1.5 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white transition-colors disabled:opacity-50"
                          >
                            {isJoining ? '…' : 'Dołącz'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
