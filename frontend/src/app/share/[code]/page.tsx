import { serverFetch } from '@/lib/serverApi';
import { getMedalEmoji } from '@/lib/constants';
import { t } from '@/lib/i18n';

interface LeaderboardEntry {
  nickname: string;
  score: number;
  is_host: boolean;
}

interface ShareData {
  room_code: string;
  categories: string[];
  total_rounds: number;
  leaderboard: LeaderboardEntry[];
}

interface Props {
  params: { code: string };
}

export default async function SharePage({ params }: Props) {
  const data = await serverFetch<ShareData>(`/rooms/${params.code}/history/`);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">{t('share_not_found')} {params.code}</p>
      </div>
    );
  }

  const winner = data.leaderboard[0];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Karta wyniku do udostępnienia */}
      <div
        id="share-card"
        className="glass-card p-8 max-w-sm w-full text-center"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)' }}
      >
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-xl font-black text-yellow-400 mb-1">QuizHub</h1>
        <p className="text-white/50 text-sm mb-4">Gra #{data.room_code}</p>

        {winner && (
          <div className="mb-4">
            <p className="text-white/60 text-xs mb-1">{t('share_winner')}</p>
            <p className="text-2xl font-black text-white">{winner.nickname}</p>
            <p className="text-yellow-400 text-3xl font-black">{winner.score.toLocaleString()} pkt</p>
          </div>
        )}

        <div className="text-white/40 text-xs mb-4">
          {data.categories.join(' · ')} · {data.total_rounds} {t('share_rounds')}
        </div>

        <div className="space-y-1">
          {data.leaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.nickname} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <span className="text-sm w-6 text-center">{getMedalEmoji(i)}</span>
              <span className="flex-1 text-white text-sm text-left">{entry.nickname}</span>
              <span className="text-yellow-400 text-sm font-bold">{entry.score}</span>
            </div>
          ))}
        </div>

        <p className="text-white/30 text-xs mt-4">quizhub.tech</p>
      </div>

      <div className="mt-6 flex gap-3">
        <a
          href={`/room/${params.code}/results`}
          className="bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl px-6 py-2 transition text-sm"
        >
          {t('share_full_results')}
        </a>
        <a
          href="/"
          className="btn-primary text-sm px-6 py-2"
        >
          {t('share_play_again')}
        </a>
      </div>
    </main>
  );
}
