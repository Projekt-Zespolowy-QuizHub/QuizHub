'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthProvider';
import { useLocale } from '@/lib/LocaleContext';

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== password2) { setError(t('error_generic')); return; }
    setLoading(true);
    try {
      await register(email, password, displayName);
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
        <h2 className="text-2xl font-bold text-yellow-400 mb-6">{t('register_title')}</h2>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <label className="block text-white/70 text-sm mb-1">{t('register_display_name')}</label>
        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
          placeholder={t('register_display_name')} className="w-full bg-white rounded-lg px-4 py-2 text-black mb-4" required />
        <label className="block text-white/70 text-sm mb-1">{t('register_email')}</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={t('register_email')} className="w-full bg-white rounded-lg px-4 py-2 text-black mb-4" required />
        <label className="block text-white/70 text-sm mb-1">{t('register_password')}</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder={t('register_password')} className="w-full bg-white rounded-lg px-4 py-2 text-black mb-4" required minLength={6} />
        <label className="block text-white/70 text-sm mb-1">{t('register_password')}</label>
        <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
          placeholder={t('register_password')} className="w-full bg-white rounded-lg px-4 py-2 text-black mb-6" required />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('register_loading') : t('register_btn')}
        </button>
        <p className="text-white/50 text-sm mt-4 text-center">
          {t('register_has_account')} <Link href="/login" className="text-yellow-400 hover:underline">{t('register_login_link')}</Link>
        </p>
      </form>
    </div>
  );
}
