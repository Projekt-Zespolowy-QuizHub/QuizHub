'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthProvider';
import { api, Achievement, UserStats } from '@/lib/api';
import { AVATARS, FREE_AVATAR_KEYS, getAvatarEmoji } from '@/lib/avatars';
import { TabBar } from '@/components/TabBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Skeleton, SkeletonCard, SkeletonProfile } from '@/components/Skeleton';
import { useLocale } from '@/lib/LocaleContext';

type Tab = 'stats' | 'achievements' | 'avatar';

function StatsTab({ stats }: { stats: UserStats | null }) {
  const { t } = useLocale();
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">{t('profile_stats_tab')}</h3>
        <Link href="/stats" className="text-yellow-400 hover:text-yellow-300 text-sm font-semibold transition-colors">
          {t('profile_details_link')}
        </Link>
      </div>
      {stats ? (
        <>
          <p className="text-white/70 mb-2">{t('profile_games_played')} {stats.games_played}</p>
          <p className="text-white/70 mb-2">{t('profile_correct_pct')} {stats.correct_percentage}%</p>
          <p className="text-white/70 mb-2">{t('profile_best_streak')} {stats.best_streak}</p>
          <p className="text-white/70">
            {t('profile_avg_time')}{' '}
            {stats.avg_response_time_ms ? (stats.avg_response_time_ms / 1000).toFixed(1) + 's' : '-'}
          </p>
        </>
      ) : (
        <div className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
      )}
    </div>
  );
}

function AchievementsTab({ achievements }: { achievements: Achievement[] | null }) {
  const { t } = useLocale();
  if (achievements === null) {
    return (
      <div className="glass-card p-6">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 flex items-start gap-3 bg-white/5 border border-white/10">
              <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (achievements.length === 0) {
    return <div className="glass-card p-6"><p className="text-white/50">{t('profile_no_badges')}</p></div>;
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-white font-bold mb-4">
        {t('profile_badges_count')} ({achievements.filter(a => a.unlocked).length}/{achievements.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {achievements.map(a => (
          <div
            key={a.condition_type}
            className={`rounded-xl p-4 flex items-start gap-3 border transition-colors ${
              a.unlocked
                ? 'bg-yellow-400/10 border-yellow-400/30'
                : 'bg-white/5 border-white/10 opacity-50'
            }`}
          >
            <span className="text-3xl flex-shrink-0">{a.icon}</span>
            <div className="min-w-0">
              <p className={`font-bold text-sm ${a.unlocked ? 'text-yellow-300' : 'text-white/40'}`}>
                {a.name}
              </p>
              <p className="text-white/50 text-xs mt-0.5 leading-tight">{a.description}</p>
              {a.unlocked && a.unlocked_at && (
                <p className="text-yellow-400/60 text-xs mt-1">
                  {new Date(a.unlocked_at).toLocaleDateString('pl-PL')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AvatarTabProps {
  currentAvatar: string;
  saving: boolean;
  ownedAvatarKeys: Set<string>;
  onSelect: (key: string) => void;
}

function AvatarTab({ currentAvatar, saving, ownedAvatarKeys, onSelect }: AvatarTabProps) {
  const { t } = useLocale();
  return (
    <div className="glass-card p-6">
      <h3 className="text-white font-bold mb-4">{t('profile_choose_avatar')}</h3>
      <div className="grid grid-cols-5 gap-3">
        {AVATARS.map(a => {
          const isFree = FREE_AVATAR_KEYS.has(a.key);
          const isOwned = isFree || ownedAvatarKeys.has(a.key);
          const isActive = currentAvatar === a.key;
          return (
            <button
              key={a.key}
              onClick={() => isOwned ? onSelect(a.key) : undefined}
              disabled={saving || !isOwned}
              title={isOwned ? a.key : 'Kup w sklepie'}
              className={`relative aspect-square rounded-xl text-3xl flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-yellow-400/20 border-2 border-yellow-400 scale-110'
                  : isOwned
                  ? 'bg-white/5 border-2 border-transparent hover:bg-white/10 hover:scale-105'
                  : 'bg-white/3 border-2 border-white/10 opacity-50 cursor-not-allowed'
              }`}
            >
              {a.emoji}
              {!isOwned && (
                <span className="absolute bottom-1 right-1 text-xs">🔒</span>
              )}
            </button>
          );
        })}
      </div>
      {saving && (
        <p className="text-white/40 text-sm mt-4 animate-pulse">{t('profile_saving')}</p>
      )}
      <p className="text-white/30 text-xs mt-4">
        🔒 Zablokowane avatary możesz kupić w{' '}
        <a href="/shop" className="text-yellow-400 hover:underline">sklepie</a>.
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading, refresh } = useAuth();
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [ownedAvatarKeys, setOwnedAvatarKeys] = useState<Set<string>>(new Set());

  const TABS = [
    { key: 'stats' as Tab, label: t('profile_stats_tab') },
    { key: 'achievements' as Tab, label: t('profile_achievements_tab') },
    { key: 'avatar' as Tab, label: t('profile_avatar_tab') },
  ] as const;

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'achievements') {
      api.getAchievements().then(setAchievements).catch(() => {});
    }
    if (tab === 'avatar') {
      api.getShopItems().then((items) => {
        const keys = new Set(
          items
            .filter((i: { item_type: string; avatar_key?: string; owned: boolean }) =>
              i.item_type === 'avatar' && i.avatar_key && i.owned)
            .map((i: { avatar_key: string }) => i.avatar_key)
        );
        setOwnedAvatarKeys(keys);
      }).catch(() => {});
    }
  }, [tab]);

  const handleAvatarSelect = async (key: string) => {
    if (savingAvatar) return;
    setSavingAvatar(true);
    try {
      await api.updateAvatar(key);
      await refresh();
    } finally {
      setSavingAvatar(false);
    }
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Skeleton className="h-8 w-24 mb-8" />
      <SkeletonProfile />
      <SkeletonCard />
    </div>
  );
  if (!user) return <p className="text-white text-center mt-20">{t('profile_login_required')}</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">{t('profile_title')}</h1>

      <div className="glass-card p-6 flex items-center gap-4 mb-6">
        <div className="avatar w-14 h-14 text-3xl">{getAvatarEmoji(user.avatar)}</div>
        <div>
          <p className="text-white font-bold text-lg">{user.display_name}</p>
          <p className="text-white/50 text-sm">{t('profile_points')} {user.total_score}</p>
        </div>
      </div>

      <div className="mb-6">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'stats' && <StatsTab stats={stats} />}
      {tab === 'achievements' && <AchievementsTab achievements={achievements} />}
      {tab === 'avatar' && (
        <AvatarTab
          currentAvatar={user.avatar}
          saving={savingAvatar}
          ownedAvatarKeys={ownedAvatarKeys}
          onSelect={handleAvatarSelect}
        />
      )}
    </div>
  );
}
