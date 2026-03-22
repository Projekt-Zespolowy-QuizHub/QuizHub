'use client';

import { useToast } from '@/lib/ToastContext';
import { ToastItem } from './Toast';

export function ToastContainer() {
  const { toasts, hide } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-xs sm:max-w-sm px-4 sm:px-0">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={hide} />
      ))}
    </div>
  );
}
