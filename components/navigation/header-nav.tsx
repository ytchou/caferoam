"use client";
import Link from "next/link";
import { SearchBar } from "@/components/discovery/search-bar";

interface HeaderNavProps {
  onSearch: (query: string) => void;
  variant?: "solid" | "glass";
}

export function HeaderNav({ onSearch, variant = "solid" }: HeaderNavProps) {
  const bgClass =
    variant === "glass"
      ? "bg-white/80 backdrop-blur-md supports-[not(backdrop-filter)]:bg-white/90"
      : "bg-white border-b border-gray-100";

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 ${bgClass}`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-[#E06B3F] flex-shrink-0">
          啡遊
        </Link>

        {/* Search bar (center) */}
        <div className="flex-1 max-w-xl">
          <SearchBar onSubmit={onSearch} />
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-4 flex-shrink-0">
          <Link href="/map" className="text-sm text-gray-600 hover:text-[#E06B3F] transition-colors">
            地圖
          </Link>
          <Link href="/lists" className="text-sm text-gray-600 hover:text-[#E06B3F] transition-colors">
            收藏
          </Link>
          <Link
            href="/login"
            className="text-sm px-4 py-2 rounded-full bg-[#E06B3F] text-white hover:bg-[#d05a2e] transition-colors"
          >
            登入
          </Link>
        </nav>
      </div>
    </header>
  );
}
