'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/LocaleContext';

export default function LandingPage() {
  const { t } = useLocale();

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center px-4">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 animate-fade-in-up">
        {t('landing_title')}
      </h1>
      <p className="text-white/60 text-base sm:text-lg mb-10 max-w-md animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {t('landing_subtitle')}
      </p>
      <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <Link href="/dashboard" className="btn-primary text-lg px-10 py-3 animate-pulse-glow">
          {t('landing_play')}
        </Link>
        <Link
          href="/register"
          className="border border-white/40 text-white font-bold px-10 py-3 rounded-lg hover:bg-white/10 transition-colors text-lg"
        >
          {t('landing_more')}
        </Link>
      </div>
    </div>
  );
}
