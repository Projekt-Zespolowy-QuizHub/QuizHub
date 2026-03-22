'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthProvider';
import { useLocale } from '@/lib/LocaleContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch {
      setError(t('error_generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <form onSubmit={handleSubmit} className="glass-card p-8 w-full max-w-sm">
        <h2 className="text-2xl font-bold text-yellow-400 mb-6">{t('login_title')}</h2>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <label className="block text-white/70 text-sm mb-1">{t('login_email')}</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full bg-white rounded-lg px-4 py-2 text-black mb-4" required />
        <label className="block text-white/70 text-sm mb-1">{t('login_password')}</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full bg-white rounded-lg px-4 py-2 text-black mb-6" required />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('login_loading') : t('login_btn')}
        </button>
        <p className="text-white/50 text-sm mt-4 text-center">
          {t('login_no_account')} <Link href="/register" className="text-yellow-400 hover:underline">{t('login_register_link')}</Link>
        </p>
      </form>
    </div>
  );
}
