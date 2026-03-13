'use client';

const SUGGESTIONS = ['巴斯克蛋糕', '適合工作', '安靜一點', '我附近'] as const;

interface SuggestionChipsProps {
  onSelect: (suggestion: string) => void;
}

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto py-1">
      {SUGGESTIONS.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          className="flex-shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm whitespace-nowrap text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
