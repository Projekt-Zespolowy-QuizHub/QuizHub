'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useGameSocket } from '@/lib/useGameSocket';
import { useAuth } from '@/lib/AuthProvider';
import { getAvatarEmoji } from '@/lib/avatars';
import { StatusBanner } from '@/components/StatusBanner';
import { useLocale } from '@/lib/LocaleContext';

interface Player {
  nickname: string;
  score: number;
  is_host: boolean;
  avatar?: string;
}

interface ChatMessage {
  nickname: string;
  text: string;
}

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();

  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [myNick, setMyNick] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const myAvatar = user?.avatar ?? 'fox';

  const { send, status } = useGameSocket(code, useCallback((msg) => {
    if (msg.type === 'player_joined') {
      setPlayers(prev => {
        if (prev.find(p => p.nickname === msg.nickname)) return prev;
        return [...prev, { nickname: msg.nickname, score: 0, is_host: false, avatar: msg.avatar }];
      });
    }
    if (msg.type === 'player_left') {
      setPlayers(prev => prev.filter(p => p.nickname !== msg.nickname));
    }
    if (msg.type === 'game_start') {
      router.push(`/room/${code}/game`);
    }
    if (msg.type === 'chat_message') {
      setChatMessages(prev => [...prev, { nickname: msg.nickname, text: msg.text }]);
    }
  }, [code, router]));

  useEffect(() => {
    if (status === 'connected' && myNick) {
      send({ type: 'rejoin', nickname: myNick });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const nick = sessionStorage.getItem(`nick_${code}`) ?? '';
    setMyNick(nick);

    api.getRoom(code).then(room => {
      setPlayers(room.players);
      const me = room.players.find(p => p.nickname === nick);
      setIsHost(me?.is_host ?? false);
      setLoading(false);
      send({ type: 'join', nickname: nick, avatar: myAvatar });
    });
  }, [code, send, myAvatar]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    send({ type: 'chat_message', text });
    setChatInput('');
  };

  const handleStart = () => {
    send({ type: 'start_game' });
    router.push(`/room/${code}/game`);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="h-8 w-32 mx-auto bg-white/10 rounded-lg animate-pulse" />
        <div className="glass-card p-5 text-center">
          <div className="h-3 w-20 mx-auto bg-white/10 rounded animate-pulse mb-3" />
          <div className="h-10 w-40 mx-auto bg-white/10 rounded-lg animate-pulse" />
        </div>
        <div className="glass-card p-5">
          <div className="h-3 w-28 bg-white/10 rounded animate-pulse mb-4" />
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
                <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <StatusBanner status={status} />

      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-yellow-400 text-center animate-fade-in">{t('lobby_title')}</h1>

        <div className="glass-card p-5 text-center">
          <p className="text-white/50 text-sm mb-1">{t('lobby_room_code')}</p>
          <p className="text-3xl sm:text-4xl font-black tracking-widest font-mono text-white select-all">{code}</p>
          <p className="text-white/30 text-xs mt-1">{t('lobby_click_copy')}</p>
        </div>

        <div className="glass-card p-5">
          <p className="text-white/50 text-sm mb-3">{t('lobby_players')} ({players.length})</p>
          <div className="space-y-2 stagger-children">
            {players.map((p) => (
              <div
                key={p.nickname}
                className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3 animate-slide-in-left"
              >
                <div className="avatar text-xl">
                  {p.avatar ? getAvatarEmoji(p.avatar) : p.nickname[0].toUpperCase()}
                </div>
                <span className="text-white font-medium truncate">{p.nickname}</span>
                {p.is_host && (
                  <span className="ml-auto text-xs text-yellow-400 flex-shrink-0">{t('lobby_host')}</span>
                )}
                {p.nickname === myNick && !p.is_host && (
                  <span className="ml-auto text-xs text-white/30 flex-shrink-0">{t('lobby_you')}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button onClick={handleStart} disabled={players.length < 1} className="btn-primary w-full py-4 text-lg animate-pulse-glow">
            {t('lobby_start_game')}
          </button>
        ) : (
          <div className="text-center text-white/40 text-sm py-4 animate-pulse">
            {t('lobby_waiting_host')}
          </div>
        )}

        <div className="glass-card p-4 flex flex-col gap-2">
          <p className="text-white/50 text-sm">{t('lobby_chat')}</p>
          <div className="h-32 overflow-y-auto space-y-1 text-sm">
            {chatMessages.map((m, i) => (
              <div key={i} className="text-white/80">
                <span className="text-yellow-400 font-semibold">{m.nickname}: </span>
                {m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              maxLength={200}
              placeholder={t('lobby_chat_placeholder')}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#6C63FF]/50"
            />
            <button
              onClick={sendChat}
              className="px-4 py-2 bg-[#6C63FF] hover:bg-[#5a52e0] rounded-lg text-sm font-semibold transition-colors"
            >
              {t('lobby_send')}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
