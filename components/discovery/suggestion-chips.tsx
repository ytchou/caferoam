"use client";

const SUGGESTIONS = ["巴斯克蛋糕", "適合工作", "安靜一點", "我附近"] as const;

interface SuggestionChipsProps {
  onSelect: (suggestion: string) => void;
}

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
      {SUGGESTIONS.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          className="whitespace-nowrap px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors flex-shrink-0"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
