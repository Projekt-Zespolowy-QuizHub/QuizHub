'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
  style?: 'primary' | 'danger';
}

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  actions?: ToastAction[];
}

interface ToastContextValue {
  toasts: Toast[];
  show: (message: string, type?: ToastType, actions?: ToastAction[]) => number;
  hide: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const hide = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info', actions?: ToastAction[]) => {
    const id = ++counter;
    setToasts(prev => [...prev, { id, type, message, actions }]);
    if (!actions || actions.length === 0) {
      const timer = setTimeout(() => hide(id), 3000);
      timers.current.set(id, timer);
    }
    return id;
  }, [hide]);

  return (
    <ToastContext.Provider value={{ toasts, show, hide }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
