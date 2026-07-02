'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import AnnouncementBar from './AnnouncementBar';

interface MobileNavProps {
  currentPage?: 'home' | 'events' | 'leaderboard' | 'venues' | 'dashboard' | 'faq' | 'puzzle' | 'blog' | 'store';
}

type NavItem = {
  href: string;
  label: string;
  key?: string;
  external?: boolean;
  broken?: boolean; // link not live yet
};

export default function MobileNav({ currentPage }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, logout } = useAuth();

  // Close any open dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (groupRef.current && !groupRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock page scroll while the mobile menu is open so swipes scroll the menu
  // itself (it has its own scrollbar) instead of the page behind it.
  useEffect(() => {
    if (isOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [isOpen]);

  // Top-level links shown directly in the bar.
  const topLinks: NavItem[] = [
    { href: '/leaderboard', label: 'Leaderboard', key: 'leaderboard' },
    { href: '/store', label: 'Store', key: 'store' },
  ];

  // Grouped dropdown menus to reduce clutter.
  // "Sign Up" only makes sense for logged-out visitors.
  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Find A Game',
      items: [
        ...(!isAuthenticated ? [{ href: '/register', label: 'Sign Up' }] : []),
        { href: '/events', label: 'Events', key: 'events' },
        { href: '/puzzle', label: '🧩 Daily Puzzle', key: 'puzzle' },
        { href: 'https://btcpokerchamp.com', label: 'BTC Poker Champ August', external: true },
      ],
    },
    {
      title: 'About',
      items: [
        { href: '/faq', label: 'FAQ', key: 'faq' },
        { href: '/blog', label: 'Blog', key: 'blog' },
        { href: '/venues', label: 'Venues', key: 'venues' },
        { href: 'https://btcpokerchamp.com/why-bitcoin', label: 'Why Bitcoin', external: true, broken: true },
        { href: 'https://btcpokerchamp.com/rules', label: "Hold'em Rules", external: true, broken: true },
      ],
    },
  ];

  return (
    <>
    <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-white">
            <Image src="/logo.png" alt="RBBP" width={28} height={28} />
            Roatan Bitcoin Bar Poker
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4" ref={groupRef}>
            {/* Grouped dropdowns: Find A Game, About */}
            {groups.map((group) => (
              <div key={group.title} className="relative">
                <button
                  onClick={() => setOpenGroup(openGroup === group.title ? null : group.title)}
                  className="flex items-center gap-1 text-white/80 hover:text-white transition"
                >
                  {group.title}
                  <svg className={`w-3 h-3 transition-transform ${openGroup === group.title ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openGroup === group.title && (
                  <div className="absolute left-0 mt-2 w-56 bg-gray-900 border border-blue-700/50 rounded-lg shadow-xl z-50 py-1">
                    {group.items.map((item) =>
                      item.external ? (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setOpenGroup(null)}
                          className="block px-4 py-2 text-white/80 hover:bg-blue-900/50 transition"
                        >
                          {item.label}{item.broken ? ' ↗' : ' ↗'}
                        </a>
                      ) : (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenGroup(null)}
                          className={`block px-4 py-2 transition hover:bg-blue-900/50 ${
                            currentPage === item.key ? 'text-blue-300 font-medium' : 'text-white/80'
                          }`}
                        >
                          {item.label}
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
            {/* Top-level links */}
            {topLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className={`${
                  currentPage === link.key
                    ? 'text-blue-300 font-medium'
                    : 'text-white/80 hover:text-white'
                } transition`}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {user?.name || 'Account'}
                  <svg className={`w-3 h-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-blue-700/50 rounded-lg shadow-xl z-50 py-1">
                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-blue-300 hover:bg-blue-900/50 transition"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-white/80 hover:bg-blue-900/50 transition"
                    >
                      Profile
                    </Link>
                    {user?.role === 'ADMIN' && (
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-yellow-400 hover:bg-blue-900/50 transition"
                      >
                        Admin
                      </Link>
                    )}
                    <div className="border-t border-blue-700/50 my-1" />
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-red-400 hover:bg-blue-900/50 transition"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Sign In
              </Link>
            )}
          </nav>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu — scrolls within itself (capped below the header) so
            Logout is always reachable without scrolling the page behind. */}
        {isOpen && (
          <nav className="md:hidden mt-4 pb-4 border-t border-blue-700/50 pt-4 max-h-[calc(100dvh-96px)] overflow-y-auto overscroll-contain">
            <div className="flex flex-col space-y-3">
              {/* Home */}
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className={`${currentPage === 'home' ? 'text-blue-300 font-medium' : 'text-white/80'} py-2 text-lg`}
              >
                Home
              </Link>

              {/* Grouped sections */}
              {groups.map((group) => (
                <div key={group.title} className="border-t border-blue-700/50 pt-3 mt-1">
                  <p className="text-sm uppercase tracking-wide text-white/50 mb-1">{group.title}</p>
                  {group.items.map((item) =>
                    item.external ? (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsOpen(false)}
                        className="block py-2 text-lg text-white/80"
                      >
                        {item.label} ↗
                      </a>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`block py-2 text-lg ${currentPage === item.key ? 'text-blue-300 font-medium' : 'text-white/80'}`}
                      >
                        {item.label}
                      </Link>
                    )
                  )}
                </div>
              ))}

              {/* Top-level links */}
              <div className="border-t border-blue-700/50 pt-3 mt-1">
                {topLinks.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`block py-2 text-lg ${currentPage === link.key ? 'text-blue-300 font-medium' : 'text-white/80'}`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              
              <div className="border-t border-blue-700/50 pt-3 mt-2">
                {isAuthenticated ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="block py-2 text-lg text-blue-300 font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setIsOpen(false)}
                      className="block py-2 text-lg text-white/80"
                    >
                      Profile
                    </Link>
                    {user?.role === 'ADMIN' && (
                      <Link
                        href="/admin"
                        onClick={() => setIsOpen(false)}
                        className="block py-2 text-lg text-yellow-400"
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      className="block py-2 text-lg text-red-400 w-full text-left"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsOpen(false)}
                      className="block py-2 text-lg text-white/80"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsOpen(false)}
                      className="block py-2 text-lg text-blue-300 font-medium"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
    <AnnouncementBar />
    </>
  );
}
