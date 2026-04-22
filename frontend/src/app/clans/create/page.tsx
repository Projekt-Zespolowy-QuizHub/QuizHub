'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';

export default function CreateClanPage() {
  useRequireAuth();
  const router = useRouter();
  const { show } = useToast();

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  function handleTagChange(value: string) {
    setTag(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3));
  }

  function validate(): string | null {
    if (!name.trim()) return 'Podaj nazwę klanu';
    if (name.trim().length < 3) return 'Nazwa klanu musi mieć co najmniej 3 znaki';
    if (!tag || tag.length < 2) return 'Tag klanu musi mieć 2-3 znaki';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { show(err, 'error'); return; }

    setLoading(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 800));
    show('Klan został utworzony!', 'success');
    router.push('/clans');
  }

  const inputClass = 'w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#6C63FF]/50 transition-colors';
  const labelClass = 'block text-white/80 text-sm font-medium mb-1.5';

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <Link href="/clans" className="text-white/50 hover:text-white text-sm transition-colors">← Wróć</Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Utwórz klan</h1>
          <p className="text-white/40 text-sm">Zaproś znajomych i rywalizujcie razem</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        {/* Name */}
        <div>
          <label className={labelClass}>Nazwa klanu *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Np. Quizowi Mistrzowie"
            className={inputClass}
            maxLength={40}
          />
          <p className="text-white/30 text-xs mt-1 text-right">{name.length}/40</p>
        </div>

        {/* Tag */}
        <div>
          <label className={labelClass}>Tag klanu * (2–3 znaki, wielkie litery)</label>
          <div className="flex items-center gap-3">
            <span className="text-white/40 font-mono text-lg">[</span>
            <input
              type="text"
              value={tag}
              onChange={e => handleTagChange(e.target.value)}
              placeholder="TAG"
              className={`${inputClass} font-mono text-center text-lg tracking-widest uppercase`}
              maxLength={3}
            />
            <span className="text-white/40 font-mono text-lg">]</span>
          </div>
          <p className="text-white/30 text-xs mt-1">Tag będzie wyświetlany przy nazwie klanu. Tylko litery A-Z i cyfry.</p>
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Opis klanu (opcjonalnie)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Opisz swój klan — czym się zajmujecie, kogo szukacie..."
            rows={4}
            className={`${inputClass} resize-none`}
            maxLength={300}
          />
          <p className="text-white/30 text-xs mt-1 text-right">{description.length}/300</p>
        </div>

        {/* Open / Closed toggle */}
        <div>
          <label className={labelClass}>Typ klanu</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all border flex items-center justify-center gap-2 ${
                isOpen
                  ? 'bg-green-500/20 border-green-500/40 text-green-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              }`}
            >
              <span>🔓</span>
              <span>Otwarty</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all border flex items-center justify-center gap-2 ${
                !isOpen
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              }`}
            >
              <span>🔒</span>
              <span>Zamknięty</span>
            </button>
          </div>
          <p className="text-white/30 text-xs mt-2">
            {isOpen ? 'Każdy może dołączyć do klanu bez zaproszenia.' : 'Dołączenie wymaga zaproszenia od lidera.'}
          </p>
        </div>

        {/* Preview */}
        {name && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-white/40 text-xs mb-2 uppercase tracking-wider">Podgląd</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              <span className="text-white font-bold">{name || 'Nazwa klanu'}</span>
              {tag && <span className="bg-white/10 text-white/60 text-sm px-2 py-0.5 rounded font-mono">[{tag}]</span>}
              {!isOpen && <span className="text-white/30 text-sm">🔒</span>}
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Tworzenie klanu...' : 'Utwórz klan 🛡️'}
        </button>
      </form>
    </div>
  );
}
