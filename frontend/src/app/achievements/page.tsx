'use client';

import { useEffect, useState } from 'react';
import { api, Achievement } from '@/lib/api';

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getAchievements().then(setAchievements).catch(() => setError(true));
  }, []);

  const unlocked = achievements?.filter(a => a.unlocked) ?? [];
  const locked = achievements?.filter(a => !a.unlocked) ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-1">Achievementy</h1>
        {achievements && (
          <p className="text-white/50 text-sm">
            Odblokowane: {unlocked.length} / {achievements.length}
          </p>
        )}
      </div>

      {error && (
        <div className="glass-card p-6 text-center text-white/50">
          Nie udało się załadować osiągnięć. Zaloguj się, aby je zobaczyć.
        </div>
      )}

      {achievements === null && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-24" />
                <div className="h-3 bg-white/5 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {achievements && (
        <div className="space-y-6">
          {unlocked.length > 0 && (
            <div>
              <h2 className="text-yellow-400 font-semibold mb-3">✅ Odblokowane ({unlocked.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {unlocked.map(a => (
                  <div key={a.condition_type} className="glass-card p-4 flex items-start gap-3 border border-yellow-400/20 bg-yellow-400/5">
                    <span className="text-3xl flex-shrink-0">{a.icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-yellow-300">{a.name}</p>
                      <p className="text-white/50 text-xs mt-0.5 leading-tight">{a.description}</p>
                      {a.unlocked_at && (
                        <p className="text-yellow-400/50 text-xs mt-1">
                          {new Date(a.unlocked_at).toLocaleDateString('pl-PL')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {locked.length > 0 && (
            <div>
              <h2 className="text-white/40 font-semibold mb-3">🔒 Zablokowane ({locked.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {locked.map(a => (
                  <div key={a.condition_type} className="glass-card p-4 flex items-start gap-3 border border-white/5 opacity-50">
                    <span className="text-3xl flex-shrink-0 grayscale">{a.icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-white/40">{a.name}</p>
                      <p className="text-white/30 text-xs mt-0.5 leading-tight">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
