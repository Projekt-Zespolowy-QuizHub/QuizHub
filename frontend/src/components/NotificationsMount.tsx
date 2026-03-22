'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthProvider';
import { useToast } from '@/lib/ToastContext';
import { useNotifications, ChallengeNotification } from '@/lib/useNotifications';
import { api } from '@/lib/api';

/**
 * Montuje WS powiadomień i obsługuje przychodzące wyzwania.
 * Renderuj tylko gdy user jest zalogowany.
 */
function NotificationsListener() {
  const router = useRouter();
  const { show } = useToast();

  const handleMessage = useCallback(async (msg: ChallengeNotification) => {
    if (msg.type !== 'challenge_received') return;

    const { challenge_id, from_display_name } = msg;

    // Pokaż toast z przyciskami akcji — używamy confirm jako fallback
    const accepted = window.confirm(
      `${from_display_name} wyzwał(a) Cię na pojedynek! Zaakceptować wyzwanie?`
    );

    try {
      const res = await api.respondChallenge(challenge_id, accepted ? 'accept' : 'decline');
      if (accepted && res.room_code) {
        show('Wyzwanie zaakceptowane! Dołączasz do pokoju...', 'success');
        const nickname = (await api.me()).display_name;
        sessionStorage.setItem(`nick_${res.room_code}`, nickname);
        router.push(`/room/${res.room_code}/lobby`);
      } else {
        show('Wyzwanie odrzucone', 'info');
      }
    } catch {
      show('Błąd odpowiedzi na wyzwanie', 'error');
    }
  }, [router, show]);

  useNotifications(handleMessage);
  return null;
}

export default function NotificationsMount() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <NotificationsListener />;
}
