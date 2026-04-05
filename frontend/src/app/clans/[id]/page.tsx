'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';

interface ClanMember {
  id: number;
  name: string;
  avatar: string;
  score: number;
  rank: number;
  isLeader: boolean;
  gamesPlayed: number;
  joinDate: string;
}

interface RecentActivity {
  id: number;
  player: string;
  avatar: string;
  action: string;
  points: number;
  time: string;
}

interface ClanDetail {
  id: number;
  name: string;
  tag: string;
  icon: string;
  description: string;
  members: ClanMember[];
  totalScore: number;
  globalRank: number;
  isOpen: boolean;
  createdAt: string;
  isMember: boolean;
}

const MOCK_CLANS: Record<string, ClanDetail> = {
  '1': {
    id: 1, name: 'Quizowi Mistrzowie', tag: 'QM', icon: '🏆',
    description: 'Elitarna drużyna quizowych weteranów. Gramy razem, wygrywamy razem. Szukamy aktywnych graczy z pasją do wiedzy!',
    totalScore: 48200, globalRank: 1, isOpen: true, createdAt: '2025-10-12', isMember: true,
    members: [
      { id: 1, name: 'QuizMaster', avatar: '🦊', score: 12400, rank: 1, isLeader: true, gamesPlayed: 87, joinDate: '2025-10-12' },
      { id: 2, name: 'KnowledgeQueen', avatar: '🧙', score: 9800, rank: 2, isLeader: false, gamesPlayed: 72, joinDate: '2025-10-15' },
      { id: 3, name: 'BrainStorm99', avatar: '🤖', score: 8700, rank: 3, isLeader: false, gamesPlayed: 65, joinDate: '2025-11-01' },
      { id: 4, name: 'TriviaHunter', avatar: '🥷', score: 7200, rank: 4, isLeader: false, gamesPlayed: 58, joinDate: '2025-11-20' },
      { id: 5, name: 'QuizFanatic', avatar: '🚀', score: 6100, rank: 5, isLeader: false, gamesPlayed: 49, joinDate: '2025-12-03' },
    ],
  },
  '2': {
    id: 2, name: 'Wiedzowi Wojownicy', tag: 'WW', icon: '⚔️',
    description: 'Wojownicy wiedzy zdobywają każde pole bitwy quizowej. Przyjmujemy wszystkich, którzy chcą walczyć o top rankingów.',
    totalScore: 41500, globalRank: 2, isOpen: true, createdAt: '2025-11-05', isMember: false,
    members: [
      { id: 1, name: 'KnowledgeKing', avatar: '🐉', score: 11200, rank: 1, isLeader: true, gamesPlayed: 91, joinDate: '2025-11-05' },
      { id: 2, name: 'WarriorOfFacts', avatar: '⚔️', score: 8900, rank: 2, isLeader: false, gamesPlayed: 76, joinDate: '2025-11-10' },
      { id: 3, name: 'TruthSeeker', avatar: '🦊', score: 7400, rank: 3, isLeader: false, gamesPlayed: 61, joinDate: '2025-12-01' },
    ],
  },
  '3': {
    id: 3, name: 'Naukowe Umysły', tag: 'NU', icon: '🔬',
    description: 'Dla pasjonatów nauki, technologii i wszystkiego co da się zmierzyć. Klan zamknięty – zapraszamy tylko najlepszych.',
    totalScore: 34700, globalRank: 3, isOpen: false, createdAt: '2025-09-20', isMember: false,
    members: [
      { id: 1, name: 'BrainiacPro', avatar: '🤖', score: 14200, rank: 1, isLeader: true, gamesPlayed: 103, joinDate: '2025-09-20' },
      { id: 2, name: 'ScienceGeek', avatar: '🔬', score: 11300, rank: 2, isLeader: false, gamesPlayed: 88, joinDate: '2025-09-25' },
    ],
  },
};

const MOCK_ACTIVITY: RecentActivity[] = [
  { id: 1, player: 'QuizMaster', avatar: '🦊', action: 'wygrał grę rankingową', points: 320, time: '5 min temu' },
  { id: 2, player: 'KnowledgeQueen', avatar: '🧙', action: 'ukończył turniej', points: 580, time: '1 godz. temu' },
  { id: 3, player: 'BrainStorm99', avatar: '🤖', action: 'wygrał pojedynek 1v1', points: 200, time: '2 godz. temu' },
  { id: 4, player: 'TriviaHunter', avatar: '🥷', action: 'osiągnął streak x10', points: 150, time: '3 godz. temu' },
  { id: 5, player: 'QuizFanatic', avatar: '🚀', action: 'ukończył quizy publiczne', points: 90, time: '5 godz. temu' },
];

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span>🥇</span>;
  if (rank === 2) return <span>🥈</span>;
  if (rank === 3) return <span>🥉</span>;
  return <span className="text-white/40 text-sm">{rank}</span>;
}

export default function ClanDetailPage() {
  useRequireAuth();
  const { show } = useToast();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [joined, setJoined] = useState(false);
  const [left, setLeft] = useState(false);

  const clan = MOCK_CLANS[id] ?? null;

  if (!clan) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="text-5xl mb-4">🛡️</div>
        <h2 className="text-2xl font-bold text-white mb-2">Klan nie znaleziony</h2>
        <p className="text-white/50 mb-6">Ten klan nie istnieje lub został rozwiązany.</p>
        <Link href="/clans" className="btn-primary">← Powrót do klanów</Link>
      </div>
    );
  }

  const isMember = (clan.isMember && !left) || joined;
  const totalMembers = clan.members.length;

  function handleJoin() {
    if (!clan.isOpen) { show('Ten klan jest zamknięty', 'error'); return; }
    setJoined(true);
    show(`Dołączyłeś do klanu ${clan.name}!`, 'success');
  }

  function handleLeave() {
    setLeft(true);
    show(`Opuściłeś klan ${clan.name}`, 'info');
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <Link href="/clans" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors">
        ← Powrót do klanów
      </Link>

      {/* Clan header */}
      <div className="glass-card p-6 mb-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="text-6xl flex-shrink-0">{clan.icon}</div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-white">{clan.name}</h1>
              <span className="bg-white/10 text-white/60 text-sm px-2 py-0.5 rounded font-mono">[{clan.tag}]</span>
              {!clan.isOpen && (
                <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs px-2 py-0.5 rounded-full">Zamknięty</span>
              )}
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-4">{clan.description}</p>
            <div className="text-white/40 text-xs">Założony: {new Date(clan.createdAt).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">👥</div>
          <div className="text-white font-bold text-xl">{totalMembers}</div>
          <div className="text-white/40 text-xs">członków</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">🪙</div>
          <div className="text-yellow-400 font-bold text-xl">{clan.totalScore.toLocaleString()}</div>
          <div className="text-white/40 text-xs">punktów łącznie</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl mb-1">🏆</div>
          <div className="text-white font-bold text-xl">#{clan.globalRank}</div>
          <div className="text-white/40 text-xs">ranking globalny</div>
        </div>
      </div>

      {/* Members list */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">👥 Członkowie klanu</h2>
          <span className="text-white/40 text-sm">{totalMembers} graczy</span>
        </div>
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
            {clan.members.map(member => (
              <tr key={member.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-3 text-center">
                  <RankMedal rank={member.rank} />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{member.avatar}</span>
                    <div>
                      <span className="text-white text-sm font-medium">{member.name}</span>
                      {member.isLeader && (
                        <span className="ml-2 text-xs text-yellow-400/80">👑 Lider</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-right text-yellow-400 font-semibold text-sm">{member.score.toLocaleString()}</td>
                <td className="p-3 text-right text-white/40 text-sm hidden sm:table-cell">{member.gamesPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent activity */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">⚡ Ostatnia aktywność</h2>
        </div>
        <div className="divide-y divide-white/5">
          {MOCK_ACTIVITY.map(activity => (
            <div key={activity.id} className="p-3 flex items-center gap-3">
              <span className="text-xl flex-shrink-0">{activity.avatar}</span>
              <div className="flex-1 min-w-0">
                <span className="text-white text-sm font-medium">{activity.player}</span>
                <span className="text-white/50 text-sm"> {activity.action}</span>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-yellow-400 text-sm font-semibold">+{activity.points}</div>
                <div className="text-white/30 text-xs">{activity.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Join/leave button */}
      <div className="text-center">
        {isMember ? (
          <button
            onClick={handleLeave}
            className="px-8 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
          >
            Opuść klan
          </button>
        ) : !clan.isOpen ? (
          <div className="glass-card p-4 inline-block text-white/30 text-sm">
            🔒 Klan zamknięty — wymagane zaproszenie
          </div>
        ) : (
          <button onClick={handleJoin} className="btn-primary px-10 py-3 text-base">
            Dołącz do klanu
          </button>
        )}
      </div>
    </div>
  );
}
