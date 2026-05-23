'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ShopItem } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';
import { useAuth } from '@/lib/AuthProvider';
import { getThemePreview } from '@/lib/themes';

type ShopTab = 'avatars' | 'powerups' | 'themes';
type PendingAction = { item: ShopItem; action: 'buy' | 'equip' } | null;

export default function ShopPage() {
  useRequireAuth();
  const { show } = useToast();
  const { refresh } = useAuth();

  const [tab, setTab] = useState<ShopTab>('avatars');
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [balance, setBalance] = useState(0);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [confirmAction, setConfirmAction] = useState<PendingAction>(null);

  const tabs: { key: ShopTab; label: string; icon: string }[] = [
    { key: 'avatars', label: 'Avatary', icon: '🎭' },
    { key: 'powerups', label: 'Power-upy', icon: '⚡' },
    { key: 'themes', label: 'Motywy', icon: '🎨' },
  ];

  const avatars = items.filter((item) => item.item_type === 'avatar');
  const powerups = items.filter((item) => item.item_type === 'powerup');
  const themes = items.filter((item) => item.item_type === 'theme');
  const activeAvatar = avatars.find((item) => item.is_equipped);
  const activeTheme = themes.find((item) => item.is_equipped);

  const loadShop = useCallback(async () => {
    const [shopItems, coinData] = await Promise.all([
      api.getShopItems(),
      api.getShopCoins(),
    ]);
    setItems(shopItems);
    setBalance(coinData.coins);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadShop()
      .catch(() => show('Nie udało się załadować sklepu', 'error'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadShop, show]);

  async function runAction(action: 'buy' | 'equip', item: ShopItem) {
    setBusyItemId(item.id);
    try {
      if (action === 'buy') {
        await api.buyShopItem(item.id);
        if (item.item_type === 'avatar' || item.item_type === 'theme') {
          await api.equipShopItem(item.id);
        }
      } else {
        await api.equipShopItem(item.id);
      }

      await Promise.all([loadShop(), refresh()]);

      if (action === 'buy' && item.item_type === 'powerup') {
        show(`Kupiono ${item.name}.`, 'success');
      } else if (action === 'buy') {
        show(`Kupiono i aktywowano ${item.name}.`, 'success');
      } else {
        show(`Aktywowano ${item.name}.`, 'success');
      }
    } catch (error) {
      show(error instanceof Error ? error.message : 'Wystąpił błąd', 'error');
    } finally {
      setBusyItemId(null);
      setConfirmAction(null);
    }
  }

  function handleAvatarClick(item: ShopItem) {
    if (item.is_equipped) {
      show(`Avatar ${item.name} jest już aktywny.`, 'info');
      return;
    }
    if (item.owned) {
      runAction('equip', item);
      return;
    }
    if (balance < item.price) {
      show('Nie masz wystarczająco monet!', 'error');
      return;
    }
    setConfirmAction({ item, action: 'buy' });
  }

  function handlePowerupBuy(item: ShopItem) {
    if (balance < item.price) {
      show('Nie masz wystarczająco monet!', 'error');
      return;
    }
    setConfirmAction({ item, action: 'buy' });
  }

  function handleThemeClick(item: ShopItem) {
    if (item.is_equipped) {
      show(`Motyw ${item.name} jest już aktywny.`, 'info');
      return;
    }
    if (item.owned) {
      runAction('equip', item);
      return;
    }
    if (balance < item.price) {
      show('Nie masz wystarczająco monet!', 'error');
      return;
    }
    setConfirmAction({ item, action: 'buy' });
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Sklep</h1>
        <div className="glass-card p-6 text-white/60">Ładowanie sklepu...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Sklep</h1>
          <p className="text-white/50 text-sm">Kupuj avatary, power-upy i motywy na swoje konto.</p>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <span className="text-yellow-400 text-lg">🪙</span>
          <span className="text-yellow-400 font-bold text-lg">{balance}</span>
          <span className="text-white/50 text-sm">monet</span>
        </div>
      </div>

      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              tab === item.key
                ? 'bg-white/15 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {tab === 'avatars' && (
        <div>
          <p className="text-white/40 text-sm mb-4">
            Aktywny avatar:{' '}
            <span className="text-white">
              {activeAvatar?.emoji_icon} {activeAvatar?.name ?? 'Brak'}
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {avatars.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => handleAvatarClick(avatar)}
                disabled={busyItemId === avatar.id}
                className={`glass-card p-5 text-center transition-all border ${
                  avatar.is_equipped
                    ? 'border-yellow-400/50 bg-yellow-400/5'
                    : 'border-white/5 hover:border-white/20'
                } ${busyItemId === avatar.id ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
              >
                <div className="text-5xl mb-3">{avatar.emoji_icon}</div>
                <div className="text-white text-sm font-semibold mb-2">{avatar.name}</div>
                {avatar.is_equipped ? (
                  <div className="text-xs px-2 py-1 rounded-full bg-yellow-400/20 text-yellow-400">
                    ✓ Aktywny
                  </div>
                ) : avatar.owned ? (
                  <div className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">
                    Posiadasz
                  </div>
                ) : (
                  <div className={`text-xs px-2 py-1 rounded-full border ${
                    balance >= avatar.price
                      ? 'bg-white/5 border-white/20 text-white/60'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    🪙 {avatar.price}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'powerups' && (
        <div className="space-y-4">
          {powerups.map((powerup) => (
            <div key={powerup.id} className="glass-card p-5 flex items-center gap-4">
              <div className="text-4xl flex-shrink-0">{powerup.emoji_icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold mb-0.5">{powerup.name}</div>
                <div className="text-white/50 text-sm">{powerup.description}</div>
                <div className="text-white/30 text-xs mt-1">Posiadasz: {powerup.quantity} szt.</div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="text-yellow-400 font-bold">🪙 {powerup.price}</div>
                <button
                  type="button"
                  onClick={() => handlePowerupBuy(powerup)}
                  disabled={busyItemId === powerup.id || balance < powerup.price}
                  className="text-sm px-4 py-1.5 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Kup
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'themes' && (
        <div>
          <p className="text-white/40 text-sm mb-4">
            Aktywny motyw:{' '}
            <span className="text-white">{activeTheme?.name ?? 'Klasyczny'}</span>
          </p>
          <div className="space-y-4">
            {themes.map((theme) => (
              <div key={theme.id} className="glass-card p-5 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getThemePreview(theme.code)} border border-white/10 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold mb-0.5">{theme.name}</div>
                  <div className="text-white/50 text-sm">{theme.description}</div>
                </div>
                <div className="flex-shrink-0">
                  {theme.is_equipped ? (
                    <span className="text-sm px-3 py-1.5 rounded-xl bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                      Aktywny
                    </span>
                  ) : theme.owned ? (
                    <button
                      type="button"
                      onClick={() => handleThemeClick(theme)}
                      disabled={busyItemId === theme.id}
                      className="text-sm px-4 py-1.5 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Ustaw
                    </button>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-yellow-400 font-bold text-sm">🪙 {theme.price}</div>
                      <button
                        type="button"
                        onClick={() => handleThemeClick(theme)}
                        disabled={busyItemId === theme.id || balance < theme.price}
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
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">🛒</div>
            <h3 className="text-white text-xl font-bold mb-2">Potwierdzenie zakupu</h3>
            <p className="text-white/60 mb-1">
              Kupujesz: <span className="text-white font-semibold">{confirmAction.item.name}</span>
            </p>
            <p className="text-yellow-400 font-bold text-lg mb-6">🪙 {confirmAction.item.price} monet</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white transition-colors"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => runAction(confirmAction.action, confirmAction.item)}
                disabled={busyItemId === confirmAction.item.id}
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
