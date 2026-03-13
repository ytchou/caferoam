"use client";
import { useRouter } from "next/navigation";

interface Shop {
  id: string;
  name: string;
  slug?: string;
  rating?: number;
}

interface MapMiniCardProps {
  shop: Shop;
  onDismiss: () => void;
}

export function MapMiniCard({ shop, onDismiss }: MapMiniCardProps) {
  const router = useRouter();
  return (
    <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg p-4 max-h-[30vh] z-10">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-sm">{shop.name}</h3>
          {shop.rating != null && (
            <p className="text-xs text-gray-500 mt-0.5">★ {shop.rating.toFixed(1)}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="dismiss"
          className="text-gray-400 text-lg leading-none"
        >
          ×
        </button>
      </div>
      <button
        onClick={() => router.push(`/shops/${shop.id}/${shop.slug ?? shop.id}`)}
        className="mt-3 w-full py-2 text-sm text-center bg-[#E06B3F] text-white rounded-full"
      >
        查看詳情
      </button>
    </div>
  );
}
