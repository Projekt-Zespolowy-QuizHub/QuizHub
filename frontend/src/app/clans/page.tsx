'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';

interface Clan {
  id: number;
  name: string;
  tag: string;
  icon: string;
  members: number;
  maxMembers: number;
  leader: string;
  totalScore: number;
  rank: number;
  isOpen: boolean;
  isMember: boolean;
}

const MOCK_CLANS: Clan[] = [
  { id: 1, name: 'Quizowi Mistrzowie', tag: 'QM', icon: '🏆', members: 12, maxMembers: 20, leader: 'QuizMaster', totalScore: 48200, rank: 1, isOpen: true, isMember: true },
  { id: 2, name: 'Wiedzowi Wojownicy', tag: 'WW', icon: '⚔️', members: 18, maxMembers: 20, leader: 'KnowledgeKing', totalScore: 41500, rank: 2, isOpen: true, isMember: false },
  { id: 3, name: 'Naukowe Umysły', tag: 'NU', icon: '🔬', members: 8, maxMembers: 15, leader: 'BrainiacPro', totalScore: 34700, rank: 3, isOpen: false, isMember: false },
  { id: 4, name: 'Historia i Kultura', tag: 'HK', icon: '🌍', members: 20, maxMembers: 20, leader: 'HistoryBuff', totalScore: 29300, rank: 4, isOpen: true, isMember: false },
  { id: 5, name: 'Liga Sportowa', tag: 'LS', icon: '⚽', members: 15, maxMembers: 25, leader: 'SportsFan', totalScore: 22100, rank: 5, isOpen: true, isMember: false },
  { id: 6, name: 'Tech Guru', tag: 'TG', icon: '💻', members: 6, maxMembers: 20, leader: 'TechWizard', totalScore: 18600, rank: 6, isOpen: true, isMember: false },
];

export default function ClansPage() {
  useRequireAuth();
  const { show } = useToast();
  const [search, setSearch] = useState('');
  const [joinedIds, setJoinedIds] = useState<number[]>([]);

  const myClan = MOCK_CLANS.find(c => c.isMember) ?? null;
  const allClans = MOCK_CLANS.filter(c => !c.isMember);
  const filtered = allClans.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.tag.toLowerCase().includes(search.toLowerCase())
  );

  function handleJoin(clan: Clan) {
    if (clan.members >= clan.maxMembers) { show('Klan jest pełny', 'error'); return; }
    setJoinedIds(prev => [...prev, clan.id]);
    show(`Dołączyłeś do klanu ${clan.name}!`, 'success');
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

      {/* My clan */}
      {myClan && (
        <div className="mb-8">
          <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-3">Twój klan</h2>
          <Link href={`/clans/${myClan.id}`} className="glass-card p-5 flex items-center gap-4 block hover:bg-white/5 transition-colors">
            <div className="text-5xl">{myClan.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-bold text-xl">{myClan.name}</span>
                <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded font-mono">[{myClan.tag}]</span>
              </div>
              <p className="text-white/50 text-sm">Lider: {myClan.leader}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="text-yellow-400 font-bold text-lg">{myClan.totalScore.toLocaleString()}</div>
              <div className="text-white/40 text-xs">pkt łącznie</div>
              <div className="text-white/50 text-xs">{myClan.members}/{myClan.maxMembers} graczy</div>
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
            <p className="text-white/50">Nie znaleziono klanów pasujących do &quot;{search}&quot;</p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {filtered.map(clan => {
              const isJoined = joinedIds.includes(clan.id);
              const isFull = clan.members >= clan.maxMembers;

              return (
                <div key={clan.id} className="glass-card p-4 flex items-center gap-4">
                  <div className="text-white/30 text-sm font-bold w-6 text-center flex-shrink-0">{clan.rank}</div>
                  <div className="text-3xl flex-shrink-0">{clan.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link href={`/clans/${clan.id}`} className="text-white font-semibold hover:text-yellow-400 transition-colors truncate">
                        {clan.name}
                      </Link>
                      <span className="bg-white/10 text-white/50 text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0">[{clan.tag}]</span>
                      {!clan.isOpen && <span className="text-white/30 text-xs flex-shrink-0">🔒</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/40">
                      <span>Lider: {clan.leader}</span>
                      <span>{clan.members}/{clan.maxMembers} graczy</span>
                      <span className="text-yellow-400/70">{clan.totalScore.toLocaleString()} pkt</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isJoined ? (
                      <span className="text-green-400 text-sm">✅ Dołączono</span>
                    ) : isFull ? (
                      <span className="text-white/30 text-xs border border-white/10 rounded-lg px-3 py-1.5">Pełny</span>
                    ) : !clan.isOpen ? (
                      <span className="text-white/30 text-xs border border-white/10 rounded-lg px-3 py-1.5">Zamknięty</span>
                    ) : (
                      <button
                        onClick={() => handleJoin(clan)}
                        className="text-sm px-4 py-1.5 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white transition-colors"
                      >
                        Dołącz
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
