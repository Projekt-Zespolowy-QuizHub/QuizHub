'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';

interface PendingRequestsContextValue {
  count: number;
  increment: () => void;
  decrement: () => void;
  refetch: () => Promise<void>;
}

const PendingRequestsContext = createContext<PendingRequestsContextValue | null>(null);

export function PendingRequestsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refetch = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const pending = await api.getPendingRequests();
      setCount(pending.length);
    } catch {
      // ignoruj — nie chcemy spamować błędami
    }
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => Math.max(0, c - 1)), []);

  return (
    <PendingRequestsContext.Provider value={{ count, increment, decrement, refetch }}>
      {children}
    </PendingRequestsContext.Provider>
  );
}

export function usePendingRequests() {
  const ctx = useContext(PendingRequestsContext);
  if (!ctx) throw new Error('usePendingRequests must be used within PendingRequestsProvider');
  return ctx;
}
