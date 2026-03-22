'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { OPTION_LABELS, getMedalEmoji } from '@/lib/constants';
import { useLocale } from '@/lib/LocaleContext';
import clsx from 'clsx';

interface HistoryQuestion {
  round: number;
  content: string;
  options: string[];
  correct: string;
  explanation: string;
}

interface LeaderboardEntry {
  nickname: string;
  score: number;
  is_host: boolean;
}

interface HistoryData {
  room_code: string;
  categories: string[];
  total_rounds: number;
  leaderboard: LeaderboardEntry[];
  questions: HistoryQuestion[];
}

export default function ResultsPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { t } = useLocale();

  const [data, setData] = useState<HistoryData | null>(null);
  const [myNick, setMyNick] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nick = sessionStorage.getItem(`nick_${code}`) ?? '';
    setMyNick(nick);
    api.getRoomHistory(code)
      .then(setData)
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card p-8 text-center max-w-md w-full mb-8">
        <div className="h-6 w-32 mx-auto bg-white/10 rounded animate-pulse mb-4" />
        <div className="h-16 w-28 mx-auto bg-white/10 rounded-lg animate-pulse mb-4" />
        <div className="h-4 w-20 mx-auto bg-white/10 rounded animate-pulse" />
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-red-400">{t('results_not_found')} {code}</div>
    </div>
  );

  const myRank = data.leaderboard.findIndex(p => p.nickname === myNick) + 1;
  const myScore = data.leaderboard.find(p => p.nickname === myNick)?.score ?? 0;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card p-6 sm:p-10 text-center max-w-md w-full mb-8">
        <h1 className="text-2xl font-bold text-yellow-400 mb-4">{t('results_your_score')}</h1>
        <p className="text-6xl font-black text-white mb-2">{myScore.toLocaleString()}</p>
        <p className="text-white/50 text-sm mb-1">{t('results_place')} {myRank}</p>
        <p className="text-white/50 text-sm mb-6">
          {t('results_correct')} {data.questions.length} / {data.total_rounds}
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => router.push('/dashboard')} className="btn-primary text-lg px-8 py-3">
            {t('results_back_dashboard')}
          </button>
          <button
            onClick={() => router.push(`/room/${code}/replay`)}
            className="bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl px-6 py-3 transition"
          >
            {t('results_see_details')}
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/share/${code}`;
              navigator.clipboard.writeText(url).then(() => {});
              router.push(`/share/${code}`);
            }}
            className="bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl px-6 py-3 transition"
          >
            {t('results_share')}
          </button>
        </div>
      </div>

      <div className="w-full max-w-md glass-card overflow-hidden mb-6">
        <h3 className="text-white font-bold p-4 border-b border-white/10">{t('results_game_ranking')}</h3>
        {data.leaderboard.map((entry, i) => (
          <div
            key={entry.nickname}
            className={clsx(
              'flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0',
              entry.nickname === myNick && 'bg-yellow-400/10'
            )}
          >
            <span className="text-lg w-8 text-center font-bold text-white/70">
              {getMedalEmoji(i)}
            </span>
            <span className="flex-1 text-white font-medium">{entry.nickname}</span>
            <span className="text-yellow-400 font-bold">{entry.score} pkt</span>
          </div>
        ))}
      </div>

      <div className="w-full max-w-md space-y-4">
        {data.questions.map((q) => (
          <div key={q.round} className="glass-card p-5">
            <p className="text-white/50 text-xs mb-2">{t('results_round')} {q.round}</p>
            <p className="text-white font-semibold mb-3">{q.content}</p>
            <div className="space-y-2">
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
              <p className="mt-3 text-white/40 text-xs border-t border-white/5 pt-2">
                {q.explanation}
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
