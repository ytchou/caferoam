'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SearchBar } from '@/components/discovery/search-bar';

interface HeaderNavProps {
  onSearch: (query: string) => void;
  variant?: 'solid' | 'glass';
}

export function HeaderNav({ onSearch, variant = 'solid' }: HeaderNavProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const bgClass =
    variant === 'glass'
      ? 'bg-white/80 backdrop-blur-md supports-[not(backdrop-filter)]:bg-white/90'
      : 'bg-white border-b border-gray-100';

  return (
    <header className={`fixed top-0 right-0 left-0 z-40 ${bgClass}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex-shrink-0 text-xl font-bold text-[#E06B3F]"
        >
          啡遊
        </Link>
        <div className="max-w-xl flex-1">
          <SearchBar onSubmit={onSearch} />
        </div>
        <nav className="flex flex-shrink-0 items-center gap-4">
          <Link
            href="/map"
            className="text-sm text-gray-600 transition-colors hover:text-[#E06B3F]"
          >
            地圖
          </Link>
          <Link
            href="/lists"
            className="text-sm text-gray-600 transition-colors hover:text-[#E06B3F]"
          >
            收藏
          </Link>
          {isLoggedIn ? (
            <Link
              href="/profile"
              className="rounded-full bg-[#E06B3F] px-4 py-2 text-sm text-white transition-colors hover:bg-[#d05a2e]"
            >
              我的
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[#E06B3F] px-4 py-2 text-sm text-white transition-colors hover:bg-[#d05a2e]"
            >
              登入
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
