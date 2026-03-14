import { useMemo } from 'react';
import { ShopCard } from '@/components/shops/shop-card';
import type { Shop } from '@/lib/types';

interface MapListViewProps {
  shops: Shop[];
  userLat: number | null;
  userLng: number | null;
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function MapListView({ shops, userLat, userLng }: MapListViewProps) {
  const sorted = useMemo(() => {
    if (userLat != null && userLng != null) {
      return [...shops]
        .map((shop) => ({
          shop,
          dist: haversineDistance(
            userLat,
            userLng,
            shop.latitude,
            shop.longitude
          ),
        }))
        .sort((a, b) => a.dist - b.dist)
        .map(({ shop }) => shop);
    }
    return [...shops].sort((a, b) => a.name.localeCompare(b.name));
  }, [shops, userLat, userLng]);

  if (sorted.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        No shops found
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((shop) => (
          <ShopCard key={shop.id} shop={shop} />
        ))}
      </div>
    </div>
  );
}
