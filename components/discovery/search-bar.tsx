"use client";
import { useState } from "react";
import { useAnalytics } from "@/lib/posthog/use-analytics";

interface SearchBarProps {
  onSubmit: (query: string) => void;
  defaultQuery?: string;
  autoFocus?: boolean;
}

export function SearchBar({ onSubmit, defaultQuery = "", autoFocus }: SearchBarProps) {
  const [value, setValue] = useState(defaultQuery);
  const { capture } = useAnalytics();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    capture("search_submitted", { query_text: value.trim() });
    onSubmit(value.trim());
  };

  return (
    <form role="search" onSubmit={handleSubmit} className="relative flex items-center">
      {/* Sparkle icon */}
      <span className="absolute left-3 pointer-events-none text-[#E06B3F]">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23E06B3F' stroke-width='2'%3E%3Cpath d='M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z'/%3E%3C/svg%3E"
          alt="search"
          width={20}
          height={20}
          aria-label="search"
        />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="找間有巴斯克蛋糕的咖啡廳…"
        autoFocus={autoFocus}
        className="w-full min-h-[48px] pl-10 pr-4 rounded-full border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E06B3F]"
      />
    </form>
  );
}
