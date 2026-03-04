'use client';

import type { TaxonomyTag } from '@/lib/types';

interface TagConfirmationProps {
  tags: TaxonomyTag[];
  confirmedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagConfirmation({
  tags,
  confirmedIds,
  onChange,
}: TagConfirmationProps) {
  if (tags.length === 0) return null;

  const toggle = (tagId: string) => {
    const next = confirmedIds.includes(tagId)
      ? confirmedIds.filter((id) => id !== tagId)
      : [...confirmedIds, tagId];
    onChange(next);
  };

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        Confirm what you experienced:
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isConfirmed = confirmedIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              data-confirmed={isConfirmed}
              onClick={() => toggle(tag.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                isConfirmed
                  ? 'border-amber-400 bg-amber-50 text-amber-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {tag.labelZh}
            </button>
          );
        })}
      </div>
    </div>
  );
}
