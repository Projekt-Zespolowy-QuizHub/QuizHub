'use client';

import { useLocale } from '@/lib/LocaleContext';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1 text-xs font-semibold">
      <button
        onClick={() => setLocale('pl')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          locale === 'pl'
            ? 'text-yellow-400'
            : 'text-white/50 hover:text-white/80'
        }`}
        aria-label="Polski"
      >
        PL
      </button>
      <span className="text-white/30">|</span>
      <button
        onClick={() => setLocale('en')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          locale === 'en'
            ? 'text-yellow-400'
            : 'text-white/50 hover:text-white/80'
        }`}
        aria-label="English"
      >
        EN
      </button>
    </div>
  );
}
