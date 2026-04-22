'use client';

import { useState } from 'react';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';

type ShopTab = 'avatars' | 'powerups' | 'themes';

interface Avatar {
  id: string;
  emoji: string;
  name: string;
  price: number;
  owned: boolean;
}

interface PowerUp {
  id: string;
  emoji: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
}

interface Theme {
  id: string;
  name: string;
  description: string;
  price: number;
  owned: boolean;
  preview: string;
}

const MOCK_BALANCE = 350;

const INITIAL_AVATARS: Avatar[] = [
  { id: 'fox', emoji: '🦊', name: 'Lis', price: 0, owned: true },
  { id: 'robot', emoji: '🤖', name: 'Robot', price: 0, owned: true },
  { id: 'dragon', emoji: '🐉', name: 'Smok', price: 200, owned: false },
  { id: 'wizard', emoji: '🧙', name: 'Czarodziej', price: 350, owned: false },
  { id: 'ninja', emoji: '🥷', name: 'Ninja', price: 500, owned: false },
  { id: 'viking', emoji: '⚔️', name: 'Wiking', price: 400, owned: false },
  { id: 'astronaut', emoji: '🚀', name: 'Astronauta', price: 600, owned: false },
  { id: 'alien', emoji: '👽', name: 'Kosmita', price: 999, owned: false },
];

const INITIAL_POWERUPS: PowerUp[] = [
  { id: 'fifty', emoji: '5️⃣0️⃣', name: '50/50', description: 'Eliminuje dwie złe odpowiedzi', price: 50, quantity: 3 },
  { id: 'time', emoji: '⏱️', name: '+15 sekund', description: 'Dodaje 15 sekund do licznika', price: 75, quantity: 1 },
  { id: 'double', emoji: '✖️2️⃣', name: 'x2 Punkty', description: 'Podwaja punkty za pytanie', price: 100, quantity: 0 },
];

const INITIAL_THEMES: Theme[] = [
  { id: 'default', name: 'Ciemny (domyślny)', description: 'Klasyczny ciemny motyw QuizHub', price: 0, owned: true, preview: 'from-[#1a1a2e] to-[#16213e]' },
  { id: 'galaxy', name: 'Galaktyczny', description: 'Głęboka przestrzeń z gwiazdami', price: 300, owned: false, preview: 'from-[#0d0d1a] to-[#1a0d2e]' },
  { id: 'ocean', name: 'Oceaniczny', description: 'Głębiny oceanu w odcieniach błękitu', price: 250, owned: false, preview: 'from-[#0a1628] to-[#0d2b45]' },
  { id: 'forest', name: 'Leśny', description: 'Tajemnicza leśna mgła', price: 200, owned: false, preview: 'from-[#0d1f0d] to-[#142814]' },
];

export default function ShopPage() {
  useRequireAuth();
  const { show } = useToast();

  const [tab, setTab] = useState<ShopTab>('avatars');
  const [balance, setBalance] = useState(MOCK_BALANCE);
  const [avatars, setAvatars] = useState<Avatar[]>(INITIAL_AVATARS);
  const [powerups, setPowerups] = useState<PowerUp[]>(INITIAL_POWERUPS);
  const [themes, setThemes] = useState<Theme[]>(INITIAL_THEMES);
  const [selectedAvatar, setSelectedAvatar] = useState('fox');
  const [confirmItem, setConfirmItem] = useState<{ name: string; price: number; action: () => void } | null>(null);

  const tabs: { key: ShopTab; label: string; icon: string }[] = [
    { key: 'avatars', label: 'Avatary', icon: '🎭' },
    { key: 'powerups', label: 'Power-upy', icon: '⚡' },
    { key: 'themes', label: 'Motywy', icon: '🎨' },
  ];

  function buyAvatar(avatar: Avatar) {
    if (avatar.owned) { setSelectedAvatar(avatar.id); show(`Wybrano avatar ${avatar.name}!`, 'success'); return; }
    if (balance < avatar.price) { show('Nie masz wystarczająco monet!', 'error'); return; }
    setConfirmItem({
      name: avatar.name,
      price: avatar.price,
      action: () => {
        setBalance(prev => prev - avatar.price);
        setAvatars(prev => prev.map(a => a.id === avatar.id ? { ...a, owned: true } : a));
        setSelectedAvatar(avatar.id);
        show(`Kupiono avatar ${avatar.name}!`, 'success');
        setConfirmItem(null);
      }
    });
  }

  function buyPowerup(pu: PowerUp) {
    if (balance < pu.price) { show('Nie masz wystarczająco monet!', 'error'); return; }
    setConfirmItem({
      name: pu.name,
      price: pu.price,
      action: () => {
        setBalance(prev => prev - pu.price);
        setPowerups(prev => prev.map(p => p.id === pu.id ? { ...p, quantity: p.quantity + 1 } : p));
        show(`Kupiono ${pu.name}!`, 'success');
        setConfirmItem(null);
      }
    });
  }

  function buyTheme(theme: Theme) {
    if (theme.owned) { show(`Motyw ${theme.name} jest już aktywny!`, 'info'); return; }
    if (balance < theme.price) { show('Nie masz wystarczająco monet!', 'error'); return; }
    setConfirmItem({
      name: theme.name,
      price: theme.price,
      action: () => {
        setBalance(prev => prev - theme.price);
        setThemes(prev => prev.map(t => t.id === theme.id ? { ...t, owned: true } : t));
        show(`Kupiono motyw ${theme.name}!`, 'success');
        setConfirmItem(null);
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Sklep</h1>
          <p className="text-white/50 text-sm">Personalizuj swój profil i zdobywaj przewagę</p>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <span className="text-yellow-400 text-lg">🪙</span>
          <span className="text-yellow-400 font-bold text-lg">{balance}</span>
          <span className="text-white/50 text-sm">monet</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              tab === t.key
                ? 'bg-white/15 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Avatars tab */}
      {tab === 'avatars' && (
        <div>
          <p className="text-white/40 text-sm mb-4">Aktywny avatar: <span className="text-white">{avatars.find(a => a.id === selectedAvatar)?.emoji} {avatars.find(a => a.id === selectedAvatar)?.name}</span></p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {avatars.map(avatar => (
              <div
                key={avatar.id}
                className={`glass-card p-5 text-center cursor-pointer transition-all border ${
                  selectedAvatar === avatar.id
                    ? 'border-yellow-400/50 bg-yellow-400/5'
                    : 'border-white/5 hover:border-white/20'
                }`}
                onClick={() => buyAvatar(avatar)}
              >
                <div className="text-5xl mb-3">{avatar.emoji}</div>
                <div className="text-white text-sm font-semibold mb-2">{avatar.name}</div>
                {avatar.owned ? (
                  <div className={`text-xs px-2 py-1 rounded-full ${selectedAvatar === avatar.id ? 'bg-yellow-400/20 text-yellow-400' : 'bg-green-500/20 text-green-300'}`}>
                    {selectedAvatar === avatar.id ? '✓ Aktywny' : 'Posiadasz'}
                  </div>
                ) : (
                  <div className={`text-xs px-2 py-1 rounded-full border ${balance >= avatar.price ? 'bg-white/5 border-white/20 text-white/60' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    🪙 {avatar.price}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Power-ups tab */}
      {tab === 'powerups' && (
        <div className="space-y-4">
          {powerups.map(pu => (
            <div key={pu.id} className="glass-card p-5 flex items-center gap-4">
              <div className="text-4xl flex-shrink-0">{pu.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold mb-0.5">{pu.name}</div>
                <div className="text-white/50 text-sm">{pu.description}</div>
                <div className="text-white/30 text-xs mt-1">Posiadasz: {pu.quantity} szt.</div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="text-yellow-400 font-bold">🪙 {pu.price}</div>
                <button
                  onClick={() => buyPowerup(pu)}
                  disabled={balance < pu.price}
                  className="text-sm px-4 py-1.5 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Kup
                </button>
              </div>
            </div>
          ))}
          <div className="glass-card p-4 bg-white/3 border-dashed border-white/10 text-center">
            <p className="text-white/30 text-sm">Więcej power-upów pojawi się wkrótce...</p>
          </div>
        </div>
      )}

      {/* Themes tab */}
      {tab === 'themes' && (
        <div className="space-y-4">
          {themes.map(theme => (
            <div key={theme.id} className="glass-card p-5 flex items-center gap-4">
              {/* Preview swatch */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${theme.preview} border border-white/10 flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold mb-0.5">{theme.name}</div>
                <div className="text-white/50 text-sm">{theme.description}</div>
              </div>
              <div className="flex-shrink-0">
                {theme.owned ? (
                  <span className="text-sm px-3 py-1.5 rounded-xl bg-green-500/20 text-green-300 border border-green-500/30">
                    Posiadasz
                  </span>
                ) : (
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-yellow-400 font-bold text-sm">🪙 {theme.price}</div>
                    <button
                      onClick={() => buyTheme(theme)}
                      disabled={balance < theme.price}
                      className="text-sm px-4 py-1.5 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Kup
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      {confirmItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">🛒</div>
            <h3 className="text-white text-xl font-bold mb-2">Potwierdzenie zakupu</h3>
            <p className="text-white/60 mb-1">Kupujesz: <span className="text-white font-semibold">{confirmItem.name}</span></p>
            <p className="text-yellow-400 font-bold text-lg mb-6">🪙 {confirmItem.price} monet</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmItem.action}
                className="flex-1 btn-primary py-2.5"
              >
                Kup teraz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
