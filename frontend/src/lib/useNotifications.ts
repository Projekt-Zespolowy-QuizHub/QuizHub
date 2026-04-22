'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface ChallengeNotification {
  type: 'challenge_received';
  challenge_id: number;
  room_code: string;
  from_display_name: string;
}

export interface FriendRequestReceivedNotification {
  type: 'friend_request_received';
  request_id: number;
  from_display_name: string;
  from_user_id: number;
}

export interface FriendRequestAcceptedNotification {
  type: 'friend_request_accepted';
  by_display_name: string;
}

export type NotificationMessage =
  | ChallengeNotification
  | FriendRequestReceivedNotification
  | FriendRequestAcceptedNotification;

type OnMessageFn = (msg: NotificationMessage) => void;

/**
 * Hook łączący się z WS powiadomień (/ws/notifications/).
 * Wywołuj tylko gdy użytkownik jest zalogowany.
 */
export function useNotifications(onMessage: OnMessageFn) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = process.env.NEXT_PUBLIC_WS_HOST ?? 'localhost:8000';
    const ws = new WebSocket(`${proto}://${host}/ws/notifications/`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as NotificationMessage;
        onMessageRef.current(msg);
      } catch {
        // ignoruj
      }
    };

    ws.onclose = (e) => {
      // reconnect po 3s jeśli nie było zamknięcia celowego
      if (e.code !== 1000) {
        setTimeout(connect, 3000);
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close(1000);
    };
  }, [connect]);
}
