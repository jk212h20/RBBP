'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

interface MobileNavProps {
  currentPage?: 'home' | 'events' | 'leaderboard' | 'venues' | 'dashboard' | 'faq' | 'puzzle';
}

export default function MobileNav({ currentPage }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, logout } = useAuth();

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { href: '/', label: 'Home', key: 'home' },
    { href: '/events', label: 'Events', key: 'events' },
    { href: '/leaderboard', label: 'Leaderboard', key: 'leaderboard' },
    { href: '/venues', label: 'Venues', key: 'venues' },
    { href: '/faq', label: 'FAQ', key: 'faq' },
    { href: '/puzzle', label: '🧩 Daily Puzzle', key: 'puzzle' },
  ];

  const externalLinks = [
    { href: 'https://btcpokerchamp.com/why-bitcoin', label: 'Why Bitcoin' },
    { href: 'https://btcpokerchamp.com/rules', label: "Hold'em Rules" },
    { href: 'https://btcpokerchamp.com', label: 'BTC Poker Champ' },
  ];

  return (
    <header className="bg-black/30 backdrop-blur-sm border-b border-blue-700/50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-white">
            <Image src="/logo.png" alt="RBBP" width={28} height={28} />
            Roatan Bitcoin Bar Poker
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            {navLinks.slice(1).map((link) => (
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
            {externalLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white transition"
              >
                {link.label}
              </a>
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

        {/* Mobile Menu */}
        {isOpen && (
          <nav className="md:hidden mt-4 pb-4 border-t border-blue-700/50 pt-4">
            <div className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`${
                    currentPage === link.key
                      ? 'text-blue-300 font-medium'
                      : 'text-white/80'
                  } py-2 text-lg`}
                >
                  {link.label}
                </Link>
              ))}

              {/* External Links */}
              <div className="border-t border-blue-700/50 pt-3 mt-2">
                {externalLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-lg text-white/80"
                  >
                    {link.label} ↗
                  </a>
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
  );
}
