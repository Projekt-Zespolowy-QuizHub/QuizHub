'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthProvider';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';
import LanguageSwitcher from './LanguageSwitcher';
import { TranslationKey } from '@/lib/i18n';
import { getAvatarEmoji } from '@/lib/avatars';

/* ─── Nav structure ───────────────────────────────────────────── */

interface ItemDef {
  href: string;
  labelKey: TranslationKey;
}

interface GroupDef {
  key: string;
  labelKey: TranslationKey;
  items: ItemDef[];
}

const GROUP_DEFS: GroupDef[] = [
  {
    key: 'play',
    labelKey: 'nav_play',
    items: [
      { href: '/dashboard',   labelKey: 'nav_dashboard'   },
      { href: '/create',      labelKey: 'nav_create'      },
      { href: '/join',        labelKey: 'nav_join'        },
      { href: '/matchmaking', labelKey: 'nav_matchmaking' },
      { href: '/survival',    labelKey: 'nav_survival'    },
    ],
  },
  {
    key: 'community',
    labelKey: 'nav_community',
    items: [
      { href: '/friends',     labelKey: 'nav_friends'     },
      { href: '/clans',       labelKey: 'nav_clans'       },
      { href: '/tournaments', labelKey: 'nav_tournaments' },
      { href: '/ranking',     labelKey: 'nav_ranking'     },
    ],
  },
  {
    key: 'my',
    labelKey: 'nav_my',
    items: [
      { href: '/profile',      labelKey: 'nav_profile'      },
      { href: '/stats',        labelKey: 'nav_stats'        },
      { href: '/history',      labelKey: 'nav_history'      },
      { href: '/achievements', labelKey: 'nav_achievements' },
      { href: '/packs',        labelKey: 'nav_packs'        },
    ],
  },
];

/* ─── Desktop dropdown ────────────────────────────────────────── */

function DesktopDropdown({
  group,
  open,
  onToggle,
  onClose,
  pathname,
  pendingFriends,
  t,
}: {
  group: GroupDef;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  pathname: string | null;
  pendingFriends: number;
  t: (key: TranslationKey) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isGroupActive = group.items.some(i => pathname === i.href);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 text-sm py-1 px-2 rounded-lg transition-colors ${
          isGroupActive
            ? 'text-yellow-400 font-semibold'
            : 'text-white/70 hover:text-white hover:bg-white/5'
        }`}
      >
        {t(group.labelKey)}
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-52 rounded-xl bg-[#0d0d1a] border border-white/10 shadow-2xl shadow-black/60 py-1.5 z-50 animate-fade-in">
          {group.items.map(item => {
            const active = pathname === item.href;
            const hasBadge = item.href === '/friends' && pendingFriends > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                  active
                    ? 'text-yellow-400 bg-yellow-400/10 font-semibold'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {t(item.labelKey)}
                {hasBadge && (
                  <span className="bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                    {pendingFriends}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main Navbar ─────────────────────────────────────────────── */

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const { t } = useLocale();

  const [pendingCount, setPendingCount] = useState(0);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getPendingRequests()
      .then(p => setPendingCount(p.length))
      .catch(() => {});
  }, [user, pathname]);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
    setMobileExpanded(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  if (pathname?.includes('/room/')) return null;
  if (loading) return null;

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    router.push('/');
  };

  const toggleGroup = (key: string) =>
    setOpenGroup(prev => (prev === key ? null : key));

  /* ── Guest nav ── */
  if (!user) {
    return (
      <nav className="px-4 sm:px-8 py-4 flex items-center justify-between animate-fade-in">
        <Link href="/" className="text-yellow-400 font-bold text-xl">QuizHub</Link>
        <div className="flex items-center gap-4 text-sm">
          <LanguageSwitcher />
          <Link href="/login" className="text-white/80 hover:text-white transition-colors">{t('nav_login')}</Link>
          <Link href="/register" className="btn-primary text-sm py-1.5 px-4">{t('nav_register')}</Link>
        </div>
      </nav>
    );
  }

  /* ── Authenticated nav ── */
  return (
    <>
      <nav className="px-4 sm:px-8 py-3 animate-fade-in relative z-40">
        <div className="flex items-center justify-between gap-4">

          {/* Brand */}
          <Link href="/dashboard" className="text-yellow-400 font-bold text-xl shrink-0">
            QuizHub
          </Link>

          {/* Desktop groups */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 mx-2">
            {GROUP_DEFS.map(group => (
              <DesktopDropdown
                key={group.key}
                group={group}
                open={openGroup === group.key}
                onToggle={() => toggleGroup(group.key)}
                onClose={() => setOpenGroup(null)}
                pathname={pathname}
                pendingFriends={pendingCount}
                t={t}
              />
            ))}
            <Link
              href="/shop"
              className={`text-sm py-1 px-2 rounded-lg transition-colors ${
                pathname === '/shop'
                  ? 'text-yellow-400 font-semibold'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              {t('nav_shop')}
            </Link>
          </div>

          {/* Desktop right: lang + avatar + logout */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <LanguageSwitcher />
            <Link
              href="/profile"
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <span className="text-xl leading-none">{getAvatarEmoji(user.avatar)}</span>
              <span className="text-sm">{user.display_name}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-white/40 hover:text-white/80 transition-colors"
            >
              {t('nav_logout')}
            </button>
          </div>

          {/* Mobile: hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-white/70 hover:text-white p-1"
            aria-label="Otwórz menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Mobile full-screen overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col md:hidden animate-fade-in"
          style={{ background: 'rgba(10, 8, 22, 0.97)' }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="text-yellow-400 font-bold text-xl"
            >
              QuizHub
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="text-white/60 hover:text-white p-1"
              aria-label="Zamknij menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* User card */}
            <div className="flex items-center gap-3 px-3 py-3 mb-4 rounded-xl bg-white/5 border border-white/10">
              <span className="text-3xl leading-none shrink-0">{getAvatarEmoji(user.avatar)}</span>
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{user.display_name}</p>
                <p className="text-xs text-white/40 truncate">{user.email}</p>
              </div>
            </div>

            {/* Collapsible groups */}
            <div className="space-y-1">
              {GROUP_DEFS.map(group => {
                const isExpanded = mobileExpanded === group.key;
                const communityBadge = group.key === 'community' && pendingCount > 0;
                return (
                  <div key={group.key}>
                    <button
                      onClick={() => setMobileExpanded(isExpanded ? null : group.key)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/5 transition-colors"
                    >
                      <span className="font-medium flex items-center gap-2">
                        {t(group.labelKey)}
                        {communityBadge && (
                          <span className="bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                            {pendingCount}
                          </span>
                        )}
                      </span>
                      <svg
                        className={`w-4 h-4 transition-transform text-white/30 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="ml-3 mt-0.5 mb-1 border-l border-white/10 pl-3 space-y-0.5">
                        {group.items.map(item => {
                          const active = pathname === item.href;
                          const friendBadge = item.href === '/friends' && pendingCount > 0;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                active
                                  ? 'text-yellow-400 bg-yellow-400/10 font-semibold'
                                  : 'text-white/60 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {t(item.labelKey)}
                              {friendBadge && (
                                <span className="bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                                  {pendingCount}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Shop direct */}
              <Link
                href="/shop"
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2.5 rounded-lg font-medium transition-colors ${
                  pathname === '/shop'
                    ? 'text-yellow-400 bg-yellow-400/10'
                    : 'text-white/80 hover:bg-white/5'
                }`}
              >
                {t('nav_shop')}
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between shrink-0">
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              {t('nav_logout')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
