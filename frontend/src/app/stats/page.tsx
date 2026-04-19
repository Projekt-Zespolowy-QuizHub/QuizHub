'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthProvider';
import { api, UserStats, CategoryAccuracy, TrendEntry } from '@/lib/api';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SkeletonStats, SkeletonCard } from '@/components/Skeleton';
import { useLocale } from '@/lib/LocaleContext';

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card p-4 text-center">
      <p className="text-white/50 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-xl">{value}</p>
    </div>
  );
}

function CategoryChart({ data }: { data: CategoryAccuracy[] }) {
  const { t } = useLocale();
  if (!data.length) {
    return <p className="text-white/50 text-sm">{t('stats_no_category')}</p>;
  }
  return (
    <div className="space-y-3">
      {data.map(d => (
        <div key={d.category}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-white/80">{d.category}</span>
            <span className="text-yellow-400 font-semibold">{d.accuracy}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${d.accuracy}%` }} />
          </div>
          <p className="text-white/30 text-xs mt-0.5">{d.total_answers} {t('stats_answers')}</p>
        </div>
      ))}
    </div>
  );
}

function heatBg(count: number): string {
  if (count === 0) return 'rgba(255,255,255,0.08)';
  if (count === 1) return 'rgba(74,222,128,0.35)';
  if (count === 2) return 'rgba(74,222,128,0.6)';
  return 'rgba(74,222,128,0.9)';
}

function ActivityHeatmap({ gamesPerDay }: { gamesPerDay: Record<string, number> }) {
  const { t } = useLocale();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const str = d.toISOString().split('T')[0];
    days.push({ date: str, count: gamesPerDay[str] || 0 });
  }

  const firstDow = new Date(days[0].date).getDay();
  const padded: ({ date: string; count: number } | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...days,
  ];

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="inline-grid gap-1"
        style={{ gridTemplateRows: 'repeat(7, 12px)', gridAutoFlow: 'column', gridAutoColumns: '12px' }}
      >
        {padded.map((day, i) =>
          day === null ? (
            <div key={`pad-${i}`} style={{ width: 12, height: 12 }} />
          ) : (
            <div
              key={day.date}
              style={{ width: 12, height: 12, background: heatBg(day.count), borderRadius: 2 }}
              title={`${day.date}: ${day.count} ${day.count === 1 ? 'gra' : 'gier'}`}
            />
          )
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-white/40 text-xs mr-1">{t('stats_less')}</span>
        {[0, 1, 2, 3].map(n => (
          <div key={n} style={{ width: 10, height: 10, background: heatBg(n), borderRadius: 2 }} />
        ))}
        <span className="text-white/40 text-xs ml-1">{t('stats_more')}</span>
      </div>
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendEntry[] }) {
  const { t } = useLocale();
  if (trend.length < 2) {
    return (
      <p className="text-white/50 text-sm py-4">
        {t('stats_min_2_games')}
      </p>
    );
  }

  const W = 400;
  const H = 80;
  const PAD = 14;

  const scores = trend.map(t => t.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const pts = trend.map((t, i) => {
    const x = PAD + (i / (trend.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((t.score - min) / range) * (H - PAD * 2);
    return [x, y] as [number, number];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const fmt = (d: string) => new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <text x={PAD - 2} y={PAD + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="8">{max}</text>
        <text x={PAD - 2} y={H - PAD + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="8">{min}</text>
        <polyline points={polyline} fill="none" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#FACC15">
            <title>{`${trend[i].date}: ${trend[i].score} pkt`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-white/40 px-3 mt-1">
        <span>{fmt(trend[0].date)}</span>
        <span>{fmt(trend[trend.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setError(true));
  }, []);

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SkeletonStats count={6} />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
  if (!user) return <p className="text-white text-center mt-20">{t('stats_login_required')}</p>;
  if (error) return <p className="text-white/50 text-center mt-20">{t('stats_load_error')}</p>;
  if (!stats) return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse bg-white/10 rounded-lg" />
      </div>
      <SkeletonStats count={6} />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-white">{t('stats_title')}</h1>
        <Link href="/profile" className="text-white/50 hover:text-white text-sm transition-colors min-h-[44px] flex items-center">
          {t('stats_back_profile')}
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 stagger-children">
        <StatCard label={t('stats_games_played')} value={stats.games_played} />
        <StatCard label={t('stats_wins')} value={stats.games_played ? `${stats.wins} (${stats.win_rate}%)` : '—'} />
        <StatCard label={t('stats_accuracy')} value={stats.correct_percentage ? `${stats.correct_percentage}%` : '—'} />
        <StatCard label={t('stats_best_streak')} value={stats.best_streak || '—'} />
        <StatCard label={t('stats_avg_time')} value={stats.avg_response_time_ms ? `${(stats.avg_response_time_ms / 1000).toFixed(1)}s` : '—'} />
        <StatCard label={t('stats_total_score')} value={stats.total_score} />
      </div>

      {stats.category_accuracy?.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-white font-bold mb-4">{t('stats_category_accuracy')}</h2>
          <CategoryChart data={stats.category_accuracy} />
        </div>
      )}

      <div className="glass-card p-6">
        <h2 className="text-white font-bold mb-3">{t('stats_activity')}</h2>
        <ActivityHeatmap gamesPerDay={stats.games_per_day ?? {}} />
      </div>

      <div className="glass-card p-6">
        <h2 className="text-white font-bold mb-4">{t('stats_trend')}</h2>
        <TrendChart trend={stats.performance_trend ?? []} />
      </div>
    </div>
  );
}
