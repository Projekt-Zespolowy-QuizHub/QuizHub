'use client';

import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useToast } from '@/lib/ToastContext';
import { api } from '@/lib/api';

interface ShopItem {
  id: number;
  name: string;
  description: string;
  item_type: string;
  price: number;
  emoji_icon: string;
  avatar_key: string | null;
  owned: boolean;
}

export default function ShopPage() {
  useRequireAuth();
  const { show } = useToast();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    Promise.all([api.getShopItems(), api.getCoins()])
      .then(([shopItems, coinsData]) => {
        setItems(shopItems);
        setCoins(coinsData.coins);
      })
      .catch(() => show('Nie udało się załadować sklepu', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const byType = (type: string) => items.filter(i => i.item_type === type);

  async function handleBuy(item: ShopItem) {
    if (item.owned) return;
    if (coins !== null && coins < item.price) {
      show('Za mało monet!', 'error');
      return;
    }
    setConfirmItem(item);
  }

  async function confirmBuy() {
    if (!confirmItem) return;
    setBuying(true);
    try {
      const res = await api.buyShopItem(confirmItem.id);
      setCoins(res.coins);
      setItems(prev => prev.map(i => i.id === confirmItem.id ? { ...i, owned: true } : i));
      show(`Zakupiono ${confirmItem.name}!`, 'success');
      setConfirmItem(null);
    } catch (e: any) {
      show(e.message ?? 'Błąd zakupu', 'error');
    } finally {
      setBuying(false);
    }
  }

  function ItemCard({ item }: { item: ShopItem }) {
    const canAfford = coins !== null && coins >= item.price;
    return (
      <div className="glass-card p-5 flex items-center gap-4">
        <div className="text-4xl flex-shrink-0">{item.emoji_icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold mb-0.5">{item.name}</div>
          <div className="text-white/50 text-sm">{item.description}</div>
        </div>
        <div className="flex-shrink-0">
          {item.owned ? (
            <span className="text-sm px-3 py-1.5 rounded-xl bg-green-500/20 text-green-300 border border-green-500/30">
              ✓ Posiadasz
            </span>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <div className="text-yellow-400 font-bold text-sm">🪙 {item.price}</div>
              <button
                onClick={() => handleBuy(item)}
                disabled={!canAfford}
                className="text-sm px-4 py-1.5 rounded-xl bg-[#6C63FF] hover:bg-[#5a52e0] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Kup
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const SECTIONS = [
    { type: 'avatar', label: '🎭 Avatary' },
    { type: 'profile_frame', label: '🖼️ Ramki profilu' },
    { type: 'confetti_effect', label: '🎆 Efekty' },
    { type: 'title', label: '👑 Tytuły' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Sklep</h1>
          <p className="text-white/50 text-sm">Personalizuj swój profil i zdobywaj przewagę</p>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <span className="text-yellow-400 text-lg">🪙</span>
          <span className="text-yellow-400 font-bold text-lg">{coins ?? '...'}</span>
          <span className="text-white/50 text-sm">monet</span>
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-12">Ładowanie...</div>
      ) : (
        <div className="space-y-8">
          {SECTIONS.map(({ type, label }) => {
            const sectionItems = byType(type);
            if (sectionItems.length === 0) return null;
            return (
              <div key={type}>
                <h2 className="text-white font-semibold mb-3">{label}</h2>
                <div className="space-y-3">
                  {sectionItems.map(item => <ItemCard key={item.id} item={item} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">{confirmItem.emoji_icon}</div>
            <h3 className="text-white text-xl font-bold mb-2">Potwierdzenie zakupu</h3>
            <p className="text-white/60 mb-1">Kupujesz: <span className="text-white font-semibold">{confirmItem.name}</span></p>
            <p className="text-yellow-400 font-bold text-lg mb-6">🪙 {confirmItem.price} monet</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmItem(null)}
                disabled={buying}
                className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 hover:text-white transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmBuy}
                disabled={buying}
                className="flex-1 btn-primary py-2.5"
              >
                {buying ? 'Kupowanie...' : 'Kup teraz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
