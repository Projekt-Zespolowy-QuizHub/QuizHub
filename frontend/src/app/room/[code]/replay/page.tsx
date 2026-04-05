'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ReplayData, ReplayQuestion } from '@/lib/api';
import { OPTION_LABELS } from '@/lib/constants';
import { useLocale } from '@/lib/LocaleContext';
import clsx from 'clsx';

function QuestionCard({ q }: { q: ReplayQuestion }) {
  const { t } = useLocale();
  return (
    <div className="glass-card p-5 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/50 text-xs">{t('replay_round')} {q.round}</span>
        {q.fastest_nick && (
          <span className="text-yellow-400 text-xs">{t('replay_fastest')} {q.fastest_nick}</span>
        )}
      </div>
      <p className="text-white font-semibold mb-3">{q.content}</p>

      <div className="space-y-1 mb-4">
        {q.options.map((option, idx) => {
          const label = OPTION_LABELS[idx];
          const isCorrect = label === q.correct;
          return (
            <div
              key={label}
              className={clsx(
                'px-3 py-2 rounded-lg text-sm',
                isCorrect
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-white/5 text-white/50'
              )}
            >
              <span className="font-bold mr-2">{label}.</span> {option}
            </div>
          );
        })}
      </div>

      {q.explanation && (
        <p className="text-white/40 text-xs border-t border-white/5 pt-2 mb-3">{q.explanation}</p>
      )}

      <div className="space-y-1">
        <p className="text-white/60 text-xs font-semibold mb-1">{t('replay_player_answers')}</p>
        {q.answers.map((a) => (
          <div
            key={a.nickname}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs',
              a.is_correct ? 'bg-green-500/10' : 'bg-red-500/10'
            )}
          >
            <span className={clsx('font-bold w-4', a.is_correct ? 'text-green-400' : 'text-red-400')}>
              {a.is_correct ? '✓' : '✗'}
            </span>
            <span className="text-white flex-1">{a.nickname}</span>
            <span className="text-white/50">{a.chosen_option}</span>
            <span className="text-white/50">{(a.response_time_ms / 1000).toFixed(1)}s</span>
            <span className="text-yellow-400 font-bold">{a.points_earned} pkt</span>
          </div>
        ))}
        {q.answers.length === 0 && (
          <p className="text-white/30 text-xs">{t('replay_no_answers')}</p>
        )}
      </div>
    </div>
  );
}

export default function ReplayPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { t } = useLocale();
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRoomReplay(code)
      .then(setData)
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass-card p-8 text-center">
        <div className="h-4 w-32 bg-white/10 rounded animate-pulse mx-auto" />
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-400">{t('replay_not_found')} {code}</p>
    </div>
  );

  return (
    <main className="max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white text-sm">
          {t('common_back')}
        </button>
        <h1 className="text-2xl font-bold text-yellow-400">{t('replay_title')} — {code}</h1>
      </div>
      {data.questions.map((q) => (
        <QuestionCard key={q.round} q={q} />
      ))}
    </main>
  );
}
