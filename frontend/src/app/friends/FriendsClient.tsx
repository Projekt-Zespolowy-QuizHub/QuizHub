'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Friend, PendingRequest, SearchResult } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useAuth } from '@/lib/AuthProvider';
import { useLocale } from '@/lib/LocaleContext';

interface Props {
  initialFriends: Friend[];
  initialPending: PendingRequest[];
}

export default function FriendsClient({ initialFriends, initialPending }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const { user } = useAuth();
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [friends, setFriends] = useState(initialFriends);
  const [pending, setPending] = useState(initialPending);
  const [challengingId, setChallengingId] = useState<number | null>(null);

  const friendIds = new Set(friends.map(f => f.id));

  function isAlreadyFriend(result: SearchResult): boolean {
    // Używamy flagi z backendu jeśli dostępna, fallback na lokalny stan
    if (result.is_friend !== undefined) return result.is_friend;
    return friendIds.has(result.id);
  }

  async function handleSearch() {
    if (search.length < 2) return;
    try {
      const results = await api.searchUsers(search);
      setSearchResults(results);
      if (results.length === 0) show(t('friends_not_found'), 'info');
    } catch {
      show(t('friends_search_error'), 'error');
    }
  }

  async function handleSendRequest(userId: number) {
    try {
      await api.sendFriendRequest(userId);
      setSearchResults(prev => prev.filter(r => r.id !== userId));
      show(t('friends_invite_sent'), 'success');
    } catch {
      show(t('friends_invite_error'), 'error');
    }
  }

  async function handleChallenge(friendId: number) {
    setChallengingId(friendId);
    try {
      const data = await api.challengeFriend(friendId, ['Historia', 'Nauka'], 10);
      show(t('friends_challenge_sent'), 'success');
      const nickname = user?.display_name ?? 'Host';
      sessionStorage.setItem(`nick_${data.room_code}`, nickname);
      router.push(`/room/${data.room_code}/lobby`);
    } catch (e: any) {
      show(e?.message ?? t('friends_challenge_error'), 'error');
    } finally {
      setChallengingId(null);
    }
  }

  async function handleRespond(requestId: number, action: 'accept' | 'reject') {
    try {
      await api.respondFriendRequest(requestId, action);
      setPending(prev => prev.filter(r => r.id !== requestId));
      if (action === 'accept') {
        show(t('friends_invite_accepted'), 'success');
        const updated = await api.getFriends();
        setFriends(updated);
        router.refresh();
      } else {
        show(t('friends_invite_rejected'), 'info');
      }
    } catch {
      show(t('error_generic'), 'error');
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">{t('friends_title')}</h1>

      {/* Search */}
      <div className="glass-card p-6 mb-6">
        <div className="flex gap-3">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('friends_search_hint')}
            className="flex-1 bg-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn-primary text-sm">{t('friends_search_btn')}</button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map(r => {
              return (
                <div key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div className="avatar">{r.display_name.charAt(0).toUpperCase()}</div>
                    <span className="text-white">{r.display_name}</span>
                  </div>
                  {isAlreadyFriend(r) ? (
                    <span className="text-green-400 text-sm">{t('friends_already_friend')}</span>
                  ) : (
                    <button onClick={() => handleSendRequest(r.id)} className="text-yellow-400 text-sm hover:underline">
                      {t('friends_add_btn')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="glass-card p-6 mb-6">
          <h3 className="text-white font-bold mb-4">{t('friends_pending')} ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map(p => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 bg-white/5 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar flex-shrink-0">{p.from_display_name.charAt(0).toUpperCase()}</div>
                  <span className="text-white truncate">{p.from_display_name}</span>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleRespond(p.id, 'accept')} className="btn-primary text-xs py-2 px-3 min-h-[36px]">{t('friends_accept')}</button>
                  <button onClick={() => handleRespond(p.id, 'reject')} className="text-red-400 text-xs hover:underline px-2 min-h-[36px]">{t('friends_reject')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="glass-card p-6">
        <h3 className="text-white font-bold mb-4">{t('friends_list')}</h3>
        {friends.length === 0 ? (
          <p className="text-white/50 text-sm">{t('friends_no_friends_hint')}</p>
        ) : (
          <div className="space-y-2">
            {friends.map(f => (
              <div key={f.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3">
                <div className="avatar">{f.display_name.charAt(0).toUpperCase()}</div>
                <span className="text-white flex-1">{f.display_name}</span>
                <span className="text-white/50 text-sm mr-2">{f.total_score} pkt</span>
                <button
                  onClick={() => handleChallenge(f.id)}
                  disabled={challengingId === f.id}
                  className="btn-primary text-xs py-1 px-3"
                >
                  {challengingId === f.id ? '...' : '⚔️ Wyzwij'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
