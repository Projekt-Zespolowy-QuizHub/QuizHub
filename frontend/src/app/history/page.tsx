import { serverFetch } from '@/lib/serverApi';
import { GameHistoryEntry } from '@/lib/api';

export default async function HistoryPage() {
  const history = await serverFetch<GameHistoryEntry[]>('/profile/history/');

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">Historia gier</h1>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-white min-w-[400px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-3 sm:p-4 text-white/70 text-sm font-semibold whitespace-nowrap">Data</th>
                <th className="text-left p-3 sm:p-4 text-white/70 text-sm font-semibold">Kategorie</th>
                <th className="text-left p-3 sm:p-4 text-white/70 text-sm font-semibold whitespace-nowrap">Punkty</th>
                <th className="text-left p-3 sm:p-4 text-white/70 text-sm font-semibold whitespace-nowrap">Miejsce</th>
              </tr>
            </thead>
            <tbody>
              {!history || history.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-white/50">Brak rozegranych gier</td></tr>
              ) : (
                history.map((g, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 sm:p-4 text-sm whitespace-nowrap">{new Date(g.date).toLocaleDateString('pl-PL')}</td>
                    <td className="p-3 sm:p-4 text-sm">{g.categories.join(', ')}</td>
                    <td className="p-3 sm:p-4 text-sm whitespace-nowrap">{g.score}</td>
                    <td className="p-3 sm:p-4 text-sm whitespace-nowrap">{g.rank}</td>
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
