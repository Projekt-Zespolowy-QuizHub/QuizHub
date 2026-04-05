'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';

const CATEGORIES = [
  'Ogólna wiedza',
  'Historia',
  'Nauka',
  'Sport',
  'Film i muzyka',
  'Technologia',
  'Kultura',
  'Mieszana',
];

const MAX_PARTICIPANTS_OPTIONS = [8, 16, 32, 64];

export default function CreateTournamentPage() {
  useRequireAuth();
  const router = useRouter();
  const { show } = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(32);
  const [prize, setPrize] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!name.trim()) return 'Podaj nazwę turnieju';
    if (!category) return 'Wybierz kategorię';
    if (!startDate) return 'Podaj datę rozpoczęcia';
    if (!endDate) return 'Podaj datę zakończenia';
    if (endDate <= startDate) return 'Data zakończenia musi być po dacie rozpoczęcia';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { show(err, 'error'); return; }

    setLoading(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 800));
    show('Turniej został utworzony!', 'success');
    router.push('/tournaments');
  }

  const inputClass = 'w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#6C63FF]/50 transition-colors';
  const labelClass = 'block text-white/80 text-sm font-medium mb-1.5';

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <Link href="/tournaments" className="text-white/50 hover:text-white text-sm transition-colors">← Wróć</Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Utwórz turniej</h1>
          <p className="text-white/40 text-sm">Wypełnij formularz aby stworzyć nowy turniej</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        {/* Name */}
        <div>
          <label className={labelClass}>Nazwa turnieju *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Np. Mistrzostwa Wiedzy 2026"
            className={inputClass}
            maxLength={80}
          />
        </div>

        {/* Category */}
        <div>
          <label className={labelClass}>Kategoria *</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="" className="bg-[#1a1a2e] text-white/50">Wybierz kategorię...</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c} className="bg-[#1a1a2e] text-white">{c}</option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data rozpoczęcia *</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label className={labelClass}>Data zakończenia *</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate || undefined}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
        </div>

        {/* Max participants */}
        <div>
          <label className={labelClass}>Maks. uczestników</label>
          <div className="flex gap-2">
            {MAX_PARTICIPANTS_OPTIONS.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxParticipants(n)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  maxParticipants === n
                    ? 'bg-[#6C63FF] border-[#6C63FF] text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Prize */}
        <div>
          <label className={labelClass}>Nagroda (opcjonalnie)</label>
          <input
            type="text"
            value={prize}
            onChange={e => setPrize(e.target.value)}
            placeholder="Np. 1000 monet"
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Opis (opcjonalnie)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Krótki opis turnieju, zasady, dodatkowe informacje..."
            rows={3}
            className={`${inputClass} resize-none`}
            maxLength={500}
          />
          <p className="text-white/30 text-xs mt-1 text-right">{description.length}/500</p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Tworzenie turnieju...' : 'Utwórz turniej 🏆'}
        </button>
      </form>
    </div>
  );
}
