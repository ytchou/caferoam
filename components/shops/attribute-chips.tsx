interface Tag { id: string; label_zh?: string; labelZh?: string; label?: string }
interface AttributeChipsProps { tags: Tag[] }

export function AttributeChips({ tags }: AttributeChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {tags.map((tag) => (
        <span key={tag.id} className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-700">
          {tag.label_zh ?? tag.labelZh ?? tag.label ?? tag.id}
        </span>
      ))}
    </div>
  );
}
