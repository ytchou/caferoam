import type { TaxonomyTag } from '@/lib/types';

interface AttributeChipsProps {
  tags: TaxonomyTag[];
}

export function AttributeChips({ tags }: AttributeChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
        >
          {tag.labelZh}
        </span>
      ))}
    </div>
  );
}
