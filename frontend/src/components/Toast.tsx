'use client';

import clsx from 'clsx';
import { Toast as ToastData } from '@/lib/ToastContext';

const STYLES: Record<ToastData['type'], string> = {
  success: 'bg-green-600/90 border-green-500/50',
  error:   'bg-red-600/90 border-red-500/50',
  info:    'bg-blue-600/90 border-blue-500/50',
  warning: 'bg-yellow-500/90 border-yellow-400/50 text-black',
};

const ICONS: Record<ToastData['type'], string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

interface Props {
  toast: ToastData;
  onClose: (id: number) => void;
}

export function ToastItem({ toast, onClose }: Props) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-white text-sm font-medium',
        'shadow-lg animate-fade-in-up backdrop-blur-sm',
        STYLES[toast.type],
      )}
    >
      <span className="flex-shrink-0 font-bold">{ICONS[toast.type]}</span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1 text-base leading-none"
        aria-label="Zamknij"
      >
        ✕
      </button>
    </div>
  );
}
