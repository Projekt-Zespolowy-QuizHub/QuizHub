'use client';

import { ConnectionStatus } from '@/lib/useGameSocket';
import { useLocale } from '@/lib/LocaleContext';

interface Props {
  status: ConnectionStatus;
}

export function StatusBanner({ status }: Props) {
  const { t } = useLocale();
  if (status === 'connected') return null;

  if (status === 'reconnecting') {
    return (
      <div className="fixed top-0 inset-x-0 z-50 bg-yellow-500/90 text-black text-center text-sm font-semibold py-2 animate-pulse">
        {t('game_reconnecting')}
      </div>
    );
  }

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-red-600/90 text-white text-center text-sm font-semibold py-2">
      {t('status_disconnected')}
    </div>
  );
}
