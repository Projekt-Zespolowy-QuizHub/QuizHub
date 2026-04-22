'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthProvider';
import { useToast } from '@/lib/ToastContext';
import {
  useNotifications,
  NotificationMessage,
} from '@/lib/useNotifications';
import { usePendingRequests } from '@/lib/PendingRequestsContext';
import { api } from '@/lib/api';

function NotificationsListener() {
  const router = useRouter();
  const { show } = useToast();
  const { increment, decrement } = usePendingRequests();

  const handleMessage = useCallback(async (msg: NotificationMessage) => {
    if (msg.type === 'challenge_received') {
      const { challenge_id, from_display_name } = msg;
      show(
        `${from_display_name} wyzwał(a) Cię na pojedynek!`,
        'info',
        [
          {
            label: 'Akceptuj',
            style: 'primary',
            onClick: async () => {
              try {
                const res = await api.respondChallenge(challenge_id, 'accept');
                if (res.room_code) {
                  const me = await api.me();
                  sessionStorage.setItem(`nick_${res.room_code}`, me.display_name);
                  router.push(`/room/${res.room_code}/lobby`);
                }
              } catch {
                show('Błąd odpowiedzi na wyzwanie', 'error');
              }
            },
          },
          {
            label: 'Odrzuć',
            style: 'danger',
            onClick: async () => {
              try {
                await api.respondChallenge(challenge_id, 'decline');
                show('Wyzwanie odrzucone', 'info');
              } catch {
                show('Błąd odpowiedzi na wyzwanie', 'error');
              }
            },
          },
        ],
      );
      return;
    }

    if (msg.type === 'friend_request_received') {
      const { request_id, from_display_name } = msg;
      increment();
      show(
        `${from_display_name} chce dodać Cię do znajomych`,
        'info',
        [
          {
            label: 'Akceptuj',
            style: 'primary',
            onClick: async () => {
              try {
                await api.respondFriendRequest(request_id, 'accept');
                decrement();
                show('Zaproszenie zaakceptowane', 'success');
              } catch {
                show('Błąd akceptacji zaproszenia', 'error');
              }
            },
          },
          {
            label: 'Odrzuć',
            style: 'danger',
            onClick: async () => {
              try {
                await api.respondFriendRequest(request_id, 'reject');
                decrement();
                show('Zaproszenie odrzucone', 'info');
              } catch {
                show('Błąd odrzucenia zaproszenia', 'error');
              }
            },
          },
        ],
      );
      return;
    }

    if (msg.type === 'friend_request_accepted') {
      show(`${msg.by_display_name} zaakceptował(a) Twoje zaproszenie`, 'success');
      return;
    }
  }, [router, show, increment, decrement]);

  useNotifications(handleMessage);
  return null;
}

export default function NotificationsMount() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <NotificationsListener />;
}
