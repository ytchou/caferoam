"use client";
import { useAnalytics } from "@/lib/posthog/use-analytics";

const QUICK_FILTERS = [
  { key: "distance", label: "距離" },
  { key: "open_now", label: "現正營業" },
  { key: "outlet", label: "有插座" },
  { key: "rating", label: "評分" },
] as const;

interface FilterPillsProps {
  activeFilters: string[];
  onToggle: (filter: string) => void;
  onOpenSheet: () => void;
}

export function FilterPills({ activeFilters, onToggle, onOpenSheet }: FilterPillsProps) {
  const { capture } = useAnalytics();

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
      {QUICK_FILTERS.map(({ key, label }) => {
        const isActive = activeFilters.includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              capture("filter_applied", { filter_type: "quick", filter_value: key });
              onToggle(key);
            }}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition-colors flex-shrink-0 ${
              isActive
                ? "bg-[#E06B3F] text-white border-[#E06B3F]"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenSheet}
        className="whitespace-nowrap px-3 py-1.5 rounded-full text-sm border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 flex-shrink-0 flex items-center gap-1"
      >
        篩選
      </button>
    </div>
  );
}
