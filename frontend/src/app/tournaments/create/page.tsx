'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';
import { api } from '@/lib/api';

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
const ICON_OPTIONS = ['🏆', '🥇', '⚔️', '🎯', '🔥', '⭐', '🚀', '👑'];

export default function CreateTournamentPage() {
  useRequireAuth();
  const router = useRouter();
  const { show } = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(32);
  const [prizeCoins, setPrizeCoins] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🏆');
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!name.trim()) return 'Podaj nazwę turnieju';
    if (name.trim().length < 3) return 'Nazwa turnieju musi mieć co najmniej 3 znaki';
    if (!category) return 'Wybierz kategorię';
    if (!startDate) return 'Podaj datę rozpoczęcia';
    if (!endDate) return 'Podaj datę zakończenia';
    if (new Date(endDate) <= new Date(startDate)) return 'Data zakończenia musi być po dacie rozpoczęcia';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { show(err, 'error'); return; }

    setLoading(true);
    try {
      const tournament = await api.createTournament({
        name: name.trim(),
        category,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        max_participants: maxParticipants,
        prize_coins: prizeCoins,
        description: description.trim(),
        icon,
        is_open: isOpen,
      });
      show('Turniej został utworzony!', 'success');
      router.push(`/tournaments/${tournament.id}`);
    } catch (e: any) {
      show(e.message ?? 'Nie udało się utworzyć turnieju', 'error');
      setLoading(false);
    }
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

        {/* Icon */}
        <div>
          <label className={labelClass}>Ikona turnieju</label>
          <div className="grid grid-cols-8 gap-2">
            {ICON_OPTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`text-2xl py-2 rounded-xl border transition-all ${
                  icon === emoji
                    ? 'bg-[#6C63FF]/30 border-[#6C63FF]/60'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
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
              type="datetime-local"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label className={labelClass}>Data zakończenia *</label>
            <input
              type="datetime-local"
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

        {/* Open / Closed */}
        <div>
          <label className={labelClass}>Typ turnieju</label>
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
        </div>

        {/* Prize */}
        <div>
          <label className={labelClass}>Nagroda (monety)</label>
          <input
            type="number"
            value={prizeCoins}
            onChange={e => setPrizeCoins(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0"
            min={0}
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
