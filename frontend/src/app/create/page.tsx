'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { api, QuestionPack } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';
import { InfoTooltip } from '@/components/InfoTooltip';

export default function CreateGamePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { t } = useLocale();
  const [categoryInput, setCategoryInput] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [rounds, setRounds] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [packs, setPacks] = useState<QuestionPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
  const [mode, setMode] = useState<'ai' | 'pack'>('ai');
  const [gameMode, setGameMode] = useState<'classic' | 'duel' | 'survival'>('classic');
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      api.getPacks().then(p => setPacks(p.filter(pk => pk.is_mine))).catch(() => {});
    }
  }, [authLoading, user]);

  function addCategory() {
    const cat = categoryInput.trim();
    if (!cat || categories.length >= 3 || categories.includes(cat)) return;
    setCategories([...categories, cat]);
    setCategoryInput('');
  }

  function removeCategory(idx: number) {
    setCategories(categories.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (!selectedPackId && categories.length === 0) {
      setError(t('create_error_category'));
      return;
    }
    const nickname = user?.display_name ?? 'Host';
    setLoading(true);
    setError('');
    try {
      const data = await api.createRoom({
        host_nickname: nickname,
        categories: selectedPackId ? [] : categories,
        total_rounds: rounds,
        pack_id: selectedPackId ?? undefined,
        game_mode: gameMode,
      });
      sessionStorage.setItem(`nick_${data.room_code}`, nickname);
      router.push(`/room/${data.room_code}/lobby`);
    } catch (e: any) {
      setError(e?.message ?? t('error_generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-yellow-400 mb-6 text-center">{t('create_title')}</h1>
        <div className="glass-card p-6">

          {/* Tryb: AI vs paczka */}
          <label className="block text-white text-sm font-bold mb-3">{t('create_source')}</label>
          <div className="flex gap-2 mb-5">
            <InfoTooltip content={t('mode_ai_tooltip')} className="flex-1">
              <button
                onClick={() => { setMode('ai'); setSelectedPackId(null); }}
                className={`w-full rounded-xl py-2 text-sm font-bold transition ${mode === 'ai' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
              >
                🤖 {t('create_ai')}
              </button>
            </InfoTooltip>
            <InfoTooltip content={t('mode_pack_tooltip')} className="flex-1">
              <button
                onClick={() => { setMode('pack'); if (packs.length > 0) setSelectedPackId(packs[0].id); }}
                className={`w-full rounded-xl py-2 text-sm font-bold transition ${mode === 'pack' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                disabled={packs.length === 0}
                title={packs.length === 0 ? t('create_no_packs') : undefined}
              >
                📦 {t('create_my_pack')}
              </button>
            </InfoTooltip>
          </div>

          {mode === 'ai' ? (
            <>
              <label className="block text-white text-sm font-bold mb-1">{t('create_categories')}</label>
              <p className="text-white/50 text-xs mb-3">{t('create_categories_hint')}</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text" value={categoryInput} onChange={e => setCategoryInput(e.target.value)}
                  placeholder={t('create_category_placeholder')}
                  className="flex-1 bg-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                  disabled={categories.length >= 3}
                />
                <button
                  onClick={addCategory} disabled={categories.length >= 3}
                  className="bg-yellow-400 text-black font-bold w-11 h-11 min-w-[44px] rounded-full hover:bg-yellow-300 disabled:opacity-50 text-xl flex-shrink-0"
                >+</button>
              </div>
              {categories.map((cat, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2 mb-2">
                  <span className="text-white">{cat}</span>
                  <button onClick={() => removeCategory(i)} className="text-red-400 hover:text-red-300 text-lg">x</button>
                </div>
              ))}
            </>
          ) : (
            <div className="mb-4">
              <label className="block text-white text-sm font-bold mb-2">{t('create_select_pack')}</label>
              <div className="space-y-2">
                {packs.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPackId(p.id)}
                    className={`w-full text-left rounded-xl px-4 py-3 transition ${selectedPackId === p.id ? 'bg-yellow-400/20 border border-yellow-400/40' : 'bg-white/5 hover:bg-white/10'}`}
                  >
                    <span className="text-white font-medium">{p.name}</span>
                    <span className="text-white/40 text-xs ml-2">({p.question_count} {t('packs_questions_count')})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tryb gry */}
          <label className="block text-white text-sm font-bold mb-3 mt-4">Tryb gry</label>
          <div className="flex gap-2 mb-5">
            {(['classic', 'duel', 'survival'] as const).map((m) => {
              const tooltipKey =
                m === 'classic' ? 'mode_classic_tooltip'
                : m === 'duel' ? 'mode_duel_tooltip'
                : 'mode_survival_tooltip';
              return (
                <InfoTooltip key={m} content={t(tooltipKey)} className="flex-1">
                  <button
                    onClick={() => setGameMode(m)}
                    className={`w-full rounded-xl py-2 text-sm font-bold transition ${gameMode === m ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                  >
                    {m === 'classic' && '🎯 Klasyczny'}
                    {m === 'duel' && '⚔️ Pojedynek'}
                    {m === 'survival' && '💀 Przetrwanie'}
                  </button>
                </InfoTooltip>
              );
            })}
          </div>

          <label className="block text-white text-sm font-bold mt-4 mb-1">{t('create_rounds')}: {rounds}</label>
          <input
            type="range" min={5} max={20} value={rounds}
            onChange={e => setRounds(Number(e.target.value))}
            className="w-full accent-yellow-400 mb-4"
          />

          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          <button onClick={handleCreate} disabled={loading} className="btn-primary w-full sm:w-auto">
            {loading ? t('create_creating') : t('create_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}
