'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, QuestionPack } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useLocale } from '@/lib/LocaleContext';

export default function PacksPage() {
  useRequireAuth();
  const router = useRouter();
  const { show } = useToast();
  const { t } = useLocale();
  const [packs, setPacks] = useState<QuestionPack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPacks()
      .then(setPacks)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm(t('packs_delete_confirm'))) return;
    try {
      await api.deletePack(id);
      setPacks(prev => prev.filter(p => p.id !== id));
      show(t('packs_delete_success'), 'success');
    } catch {
      show(t('packs_delete_error'), 'error');
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto">
      <div className="h-8 w-48 bg-white/10 rounded animate-pulse mb-6" />
      {[1, 2, 3].map(i => (
        <div key={i} className="glass-card p-5 mb-4 h-20 animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">{t('packs_title')}</h1>
        <Link href="/packs/create" className="btn-primary text-sm">{t('packs_new')}</Link>
      </div>

      {packs.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-white/50 mb-4">{t('packs_no_packs')}</p>
          <Link href="/packs/create" className="btn-primary">{t('packs_create_first')}</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map(pack => (
            <div key={pack.id} className="glass-card p-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold truncate">{pack.name}</span>
                  {pack.is_public && (
                    <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 rounded px-1.5 py-0.5">
                      {t('packs_public_badge')}
                    </span>
                  )}
                  {!pack.is_mine && (
                    <span className="text-xs bg-white/10 text-white/50 rounded px-1.5 py-0.5">
                      {t('packs_foreign_badge')}
                    </span>
                  )}
                </div>
                {pack.description && (
                  <p className="text-white/40 text-sm truncate">{pack.description}</p>
                )}
                <p className="text-white/30 text-xs mt-1">{pack.question_count} {t('packs_questions_count')}</p>
              </div>
              {pack.is_mine && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => router.push(`/packs/${pack.id}/edit`)}
                    className="text-yellow-400 text-sm hover:underline"
                  >
                    {t('packs_edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(pack.id)}
                    className="text-red-400 text-sm hover:underline"
                  >
                    {t('packs_delete')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
