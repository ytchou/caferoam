'use client';
import { useRouter } from 'next/navigation';

interface MapDesktopShop {
  id: string;
  name: string;
  slug?: string;
  rating?: number | null;
  mrt?: string | null;
  photoUrls?: string[];
  taxonomyTags?: Array<{
    id: string;
    labelZh: string;
  }>;
}

interface MapDesktopCardProps {
  shop: MapDesktopShop;
}

export function MapDesktopCard({ shop }: MapDesktopCardProps) {
  const router = useRouter();
  const photos = shop.photoUrls ?? [];
  const tags = shop.taxonomyTags ?? [];

  return (
    <div className="absolute bottom-4 left-4 z-10 w-[340px] rounded-xl bg-white p-4 shadow-lg transition-transform">
      {photos.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {photos.slice(0, 3).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${shop.name} photo ${i + 1}`}
              className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      <h3 className="text-sm font-semibold">{shop.name}</h3>
      {shop.mrt && <p className="mt-0.5 text-xs text-gray-500">{shop.mrt}</p>}
      {shop.rating != null && (
        <p className="mt-0.5 text-xs text-gray-500">
          ★ {shop.rating.toFixed(1)}
        </p>
      )}

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 5).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {tag.labelZh}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() =>
            router.push(`/shops/${shop.id}/${shop.slug ?? shop.id}`)
          }
          className="flex-1 rounded-full bg-[#E06B3F] py-2 text-center text-sm font-medium text-white"
        >
          查看詳情
        </button>
        <button
          onClick={() => router.push(`/checkin/${shop.id}`)}
          className="flex-1 rounded-full border border-gray-200 py-2 text-center text-sm text-gray-700"
        >
          打卡記錄
        </button>
      </div>
    </div>
  );
}
