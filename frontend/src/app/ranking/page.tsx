'use client';

import { useEffect, useState } from 'react';
import { api, RankEntry } from '@/lib/api';
import { TabBar } from '@/components/TabBar';
import { Skeleton } from '@/components/Skeleton';
import { useLocale } from '@/lib/LocaleContext';

type Tab = 'global' | 'weekly' | 'friends';

const FETCHERS = {
  global: () => api.getRankingGlobal(),
  weekly: () => api.getRankingWeekly(),
  friends: () => api.getRankingFriends(),
};

export default function RankingPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>('global');
  const [data, setData] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const TABS = [
    { key: 'global' as Tab, label: t('ranking_global') },
    { key: 'weekly' as Tab, label: t('ranking_weekly') },
    { key: 'friends' as Tab, label: t('ranking_friends') },
  ] as const;

  useEffect(() => {
    setLoading(true);
    FETCHERS[tab]()
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-4">{t('ranking_title')}</h1>
      <div className="mb-6">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-white min-w-[300px]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-3 sm:p-4 text-white/70 text-sm font-semibold whitespace-nowrap">{t('ranking_place')}</th>
              <th className="text-left p-3 sm:p-4 text-white/70 text-sm font-semibold">{t('ranking_player')}</th>
              <th className="text-left p-3 sm:p-4 text-white/70 text-sm font-semibold whitespace-nowrap">{t('ranking_points')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-4">
                  <div className="space-y-3">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-4 w-8 flex-shrink-0" />
                        <div className="flex items-center gap-2 flex-1">
                          <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
                          <Skeleton className="h-4 w-36" />
                        </div>
                        <Skeleton className="h-4 w-14 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-white/50">{t('ranking_no_data')}</td></tr>
            ) : (
              data.map(entry => (
                <tr key={entry.rank} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 sm:p-4 text-sm whitespace-nowrap">{entry.rank}</td>
                  <td className="p-3 sm:p-4 text-sm">
                    <span className="inline-flex items-center gap-2">
                      <span>{entry.avatar ?? '🦊'}</span>
                      <span className="truncate max-w-[140px] sm:max-w-none">{entry.display_name}</span>
                    </span>
                  </td>
                  <td className="p-3 sm:p-4 text-sm whitespace-nowrap">{entry.total_score ?? entry.score ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
