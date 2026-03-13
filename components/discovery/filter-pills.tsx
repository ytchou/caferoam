'use client';
import { useAnalytics } from '@/lib/posthog/use-analytics';

const QUICK_FILTERS = [
  { key: 'distance', label: '距離' },
  { key: 'open_now', label: '現正營業' },
  { key: 'outlet', label: '有插座' },
  { key: 'rating', label: '評分' },
] as const;

interface FilterPillsProps {
  activeFilters: string[];
  onToggle: (filter: string) => void;
  onOpenSheet: () => void;
}

export function FilterPills({
  activeFilters,
  onToggle,
  onOpenSheet,
}: FilterPillsProps) {
  const { capture } = useAnalytics();

  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto py-1">
      {QUICK_FILTERS.map(({ key, label }) => {
        const isActive = activeFilters.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              capture('filter_applied', {
                filter_type: 'quick',
                filter_value: key,
              });
              onToggle(key);
            }}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
              isActive
                ? 'border-[#E06B3F] bg-[#E06B3F] text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenSheet}
        className="flex flex-shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm whitespace-nowrap text-gray-700 hover:bg-gray-50"
      >
        篩選
      </button>
    </div>
  );
}
