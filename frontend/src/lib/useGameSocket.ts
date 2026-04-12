import { useEffect, useRef, useCallback, useState } from 'react';

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 10_000;
const MAX_RETRIES = 5;

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export type WSMessage =
  | { type: 'player_joined'; nickname: string; avatar?: string }
  | { type: 'player_left'; nickname: string }
  | { type: 'game_start'; total_rounds: number; categories: string[] }
  | { type: 'question'; round_number: number; total_rounds: number; question: string; options: string[] }
  | { type: 'answer_result'; is_correct: boolean; correct_answer: string; explanation: string; points_earned: number; total_score: number }
  | { type: 'game_over'; leaderboard: { nickname: string; score: number }[] }
  | { type: 'game_state'; room_status: string; current_round: number; total_rounds: number; score: number; current_question: { round_number: number; total_rounds: number; question: string; options: string[] } | null }
  | { type: 'powerup_result'; powerup: 'fifty_fifty'; removed_options: string[] }
  | { type: 'powerup_result'; powerup: 'extra_time'; extra_seconds: number }
  | { type: 'powerup_result'; powerup: 'double_points' }
  | { type: 'chat_message'; nickname: string; text: string };

export function useGameSocket(
  roomCode: string,
  onMessage: (msg: WSMessage) => void,
  onReconnect?: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const isFirstConnectRef = useRef(true);

  onMessageRef.current = onMessage;
  onReconnectRef.current = onReconnect;

  const [status, setStatus] = useState<ConnectionStatus>('reconnecting');

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    intentionalCloseRef.current = false;
    retryCountRef.current = 0;
    isFirstConnectRef.current = true;

    function doConnect() {
      const wsBase =
        process.env.NEXT_PUBLIC_WS_URL ??
        (typeof window !== 'undefined'
          ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
          : 'ws://localhost:8000');
      const ws = new WebSocket(`${wsBase}/ws/room/${roomCode}/`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to room', roomCode);
        retryCountRef.current = 0;
        setStatus('connected');
        if (!isFirstConnectRef.current) {
          onReconnectRef.current?.();
        }
        isFirstConnectRef.current = false;
      };

      ws.onclose = () => {
        if (intentionalCloseRef.current) return;
        const attempt = retryCountRef.current;
        if (attempt >= MAX_RETRIES) {
          console.error('[WS] Max retries reached, giving up');
          setStatus('disconnected');
          return;
        }
        const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
        console.log(`[WS] Disconnected, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
        setStatus('reconnecting');
        retryCountRef.current += 1;
        retryTimeoutRef.current = setTimeout(doConnect, delay);
      };

      ws.onerror = (e) => console.error('[WS] Error', e);

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as WSMessage;
          onMessageRef.current(msg);
        } catch {
          console.warn('[WS] Bad message', e.data);
        }
      };
    }

    doConnect();

    return () => {
      intentionalCloseRef.current = true;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [roomCode]);

  return { send, status };
}
