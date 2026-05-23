'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthProvider';

export default function ThemeMount() {
  const { user } = useAuth();

  useEffect(() => {
    document.body.dataset.theme = user?.theme ?? 'default';
  }, [user?.theme]);

  return null;
}
