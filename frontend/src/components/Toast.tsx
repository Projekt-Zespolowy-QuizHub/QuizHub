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
  const hasActions = !!toast.actions && toast.actions.length > 0;
  return (
    <div
      className={clsx(
        'flex flex-col gap-2 px-4 py-3 rounded-xl border text-white text-sm font-medium',
        'shadow-lg animate-fade-in-up backdrop-blur-sm max-w-sm',
        STYLES[toast.type],
      )}
    >
      <div className="flex items-center gap-3">
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
      {hasActions && (
        <div className="flex gap-2 justify-end">
          {toast.actions!.map((action, i) => (
            <button
              key={i}
              onClick={() => { action.onClick(); onClose(toast.id); }}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-semibold transition-colors',
                action.style === 'danger'
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white text-black hover:bg-white/90',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
