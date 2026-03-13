'use client';
import { useState } from 'react';
import { Drawer } from 'vaul';
import { useAnalytics } from '@/lib/posthog/use-analytics';

const FILTER_DIMENSIONS = [
  {
    label: '功能',
    tags: [
      { id: 'wifi', label_zh: '有 Wi-Fi' },
      { id: 'outlet', label_zh: '有插座' },
      { id: 'work_friendly', label_zh: '適合工作' },
    ],
  },
  {
    label: '氛圍',
    tags: [
      { id: 'quiet', label_zh: '安靜' },
      { id: 'cozy', label_zh: '舒適' },
      { id: 'spacious', label_zh: '寬敞' },
    ],
  },
  {
    label: '時間',
    tags: [
      { id: 'open_late', label_zh: '營業到晚上' },
      { id: 'open_weekend', label_zh: '週末營業' },
    ],
  },
];

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  onApply: (selectedIds: string[]) => void;
  initialFilters: string[];
}

export function FilterSheet({
  open,
  onClose,
  onApply,
  initialFilters,
}: FilterSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialFilters)
  );
  const { capture } = useAnalytics();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClear = () => setSelected(new Set());
  const handleApply = () => {
    const selectedIds = Array.from(selected);
    capture('filter_applied', {
      filter_type: 'sheet',
      filter_value: selectedIds,
    });
    onApply(selectedIds);
    onClose();
  };

  return (
    <Drawer.Root open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="fixed right-0 bottom-0 left-0 max-h-[85vh] overflow-y-auto rounded-t-[10px] bg-white p-4">
          <Drawer.Handle />
          <Drawer.Title className="mb-4 text-lg font-semibold">
            篩選
          </Drawer.Title>
          <div className="space-y-6">
            {FILTER_DIMENSIONS.map((dim) => (
              <div key={dim.label}>
                <h3 className="mb-2 text-sm font-medium text-gray-500">
                  {dim.label}
                </h3>
                <div className="space-y-2">
                  {dim.tags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex cursor-pointer items-center gap-3"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(tag.id)}
                        onChange={() => toggle(tag.id)}
                        className="rounded border-gray-300 text-[#E06B3F] focus:ring-[#E06B3F]"
                      />
                      <span className="text-sm">{tag.label_zh}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3 border-t pt-4">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm text-gray-600"
            >
              清除
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 rounded-full bg-[#E06B3F] py-2.5 text-sm font-medium text-white"
            >
              套用
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
