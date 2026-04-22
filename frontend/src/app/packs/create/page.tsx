'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useLocale } from '@/lib/LocaleContext';

export default function CreatePackPage() {
  useRequireAuth();
  const router = useRouter();
  const { show } = useToast();
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) { show(t('pack_name_required'), 'error'); return; }
    setLoading(true);
    try {
      const pack = await api.createPack(name.trim(), description, isPublic);
      show(t('packs_create_success'), 'success');
      router.push(`/packs/${pack.id}/edit`);
    } catch {
      show(t('pack_error_save'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white text-sm">{t('common_back')}</button>
        <h1 className="text-2xl font-bold text-white">{t('pack_create_title')}</h1>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div>
          <label className="block text-white text-sm font-bold mb-1">{t('pack_name_label')} *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('pack_name_placeholder')}
            className="w-full bg-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40"
          />
        </div>

        <div>
          <label className="block text-white text-sm font-bold mb-1">{t('pack_desc_label')}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('pack_desc_label')}
            rows={3}
            className="w-full bg-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40 resize-none"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={e => setIsPublic(e.target.checked)}
            className="w-4 h-4 accent-yellow-400"
          />
          <span className="text-white text-sm">{t('pack_public_label')}</span>
        </label>

        <button
          onClick={handleCreate}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? t('pack_saving') : t('pack_save_btn')}
        </button>
      </div>
    </div>
  );
}
