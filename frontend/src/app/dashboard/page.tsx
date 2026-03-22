'use client';

import Link from 'next/link';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useLocale } from '@/lib/LocaleContext';

export default function DashboardPage() {
  const { user } = useRequireAuth();
  const { t } = useLocale();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white mb-2">{t('nav_dashboard')}</h1>
        {user && <p className="text-white/50 mb-8">{t('dash_welcome')}, {user.display_name}!</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 stagger-children">
        <Link href="/create" className="glass-card p-6 quiz-card block group">
          <div className="text-3xl mb-3">🎮</div>
          <h3 className="text-white font-bold text-lg mb-2 group-hover:text-yellow-400 transition-colors">{t('dash_create_title')}</h3>
          <p className="text-white/50 text-sm mb-4">{t('dash_create_desc')}</p>
          <span className="btn-primary inline-block text-sm">{t('game_start')}</span>
        </Link>
        <Link href="/join" className="glass-card p-6 quiz-card block group">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="text-white font-bold text-lg mb-2 group-hover:text-yellow-400 transition-colors">{t('dash_join_title')}</h3>
          <p className="text-white/50 text-sm mb-4">{t('dash_join_desc')}</p>
          <span className="btn-primary inline-block text-sm">{t('dash_join_btn')}</span>
        </Link>
        <Link href="/public" className="glass-card p-6 quiz-card block group sm:col-span-2 md:col-span-1">
          <div className="text-3xl mb-3">🌍</div>
          <h3 className="text-white font-bold text-lg mb-2 group-hover:text-yellow-400 transition-colors">{t('dash_public_title')}</h3>
          <p className="text-white/50 text-sm mb-4">{t('dash_public_desc')}</p>
          <span className="btn-primary inline-block text-sm">{t('dash_play')}</span>
        </Link>
      </div>
    </div>
  );
}
