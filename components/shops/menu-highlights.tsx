interface MenuItem {
  name: string;
  emoji: string;
  price: string;
}

interface MenuHighlightsProps {
  items: MenuItem[];
}

export function MenuHighlights({ items }: MenuHighlightsProps) {
  if (items.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <h3 className="mb-2 text-sm font-medium text-gray-900">推薦餐點</h3>
      <div className="space-y-1.5">
        {items.slice(0, 3).map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between text-sm"
          >
            <span>
              {item.emoji} {item.name}
            </span>
            <span className="text-gray-500">{item.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
