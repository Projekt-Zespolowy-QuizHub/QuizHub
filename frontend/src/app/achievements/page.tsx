'use client';

import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { api } from '@/lib/api';

interface Achievement {
  condition_type: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export default function AchievementsPage() {
  useRequireAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAchievements()
      .then(setAchievements)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const unlocked = achievements.filter(a => a.unlocked).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-4xl">🏅</span>
        <div>
          <h1 className="text-3xl font-bold text-white">Osiągnięcia</h1>
          {!loading && (
            <p className="text-white/50 text-sm">{unlocked} / {achievements.length} odblokowanych</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map(a => (
            <div
              key={a.condition_type}
              className={`glass-card p-5 flex gap-4 items-start transition-all ${
                a.unlocked
                  ? 'border border-yellow-400/30 bg-yellow-400/5'
                  : 'opacity-50'
              }`}
            >
              <div className="text-3xl">{a.unlocked ? a.icon : '🔒'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{a.name}</p>
                <p className="text-white/50 text-xs mt-1">{a.description}</p>
                {a.unlocked && a.unlocked_at && (
                  <p className="text-yellow-400/70 text-xs mt-2">
                    {new Date(a.unlocked_at).toLocaleDateString('pl-PL')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
