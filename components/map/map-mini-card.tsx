'use client';
import { useRouter } from 'next/navigation';

interface Shop {
  id: string;
  name: string;
  slug?: string;
  rating?: number | null;
}

interface MapMiniCardProps {
  shop: Shop;
  onDismiss: () => void;
}

export function MapMiniCard({ shop, onDismiss }: MapMiniCardProps) {
  const router = useRouter();
  return (
    <div className="absolute right-4 bottom-4 left-4 z-10 max-h-[30vh] rounded-xl bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">{shop.name}</h3>
          {shop.rating != null && (
            <p className="mt-0.5 text-xs text-gray-500">
              ★ {shop.rating.toFixed(1)}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="dismiss"
          className="text-lg leading-none text-gray-400"
        >
          ×
        </button>
      </div>
      <button
        onClick={() => router.push(`/shops/${shop.id}/${shop.slug ?? shop.id}`)}
        className="mt-3 w-full rounded-full bg-[#E06B3F] py-2 text-center text-sm text-white"
      >
        查看詳情
      </button>
    </div>
  );
}
