'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Shop } from '@/lib/types';

type ShopCardData = Pick<Shop, 'id' | 'name' | 'rating'> & {
  slug?: string;
  mrt?: string | null;
  photoUrls?: string[];
  photo_urls?: string[];
};

interface ShopCardProps {
  shop: ShopCardData;
}

export function ShopCard({ shop }: ShopCardProps) {
  const router = useRouter();

  function handleClick() {
    router.push(`/shops/${shop.id}/${shop.slug ?? shop.id}`);
  }

  const locationLabel = shop.mrt ?? '';
  const photoUrl =
    (shop.photo_urls ?? shop.photoUrls)?.[0] ?? '/placeholder-cafe.jpg';

  return (
    <article
      role="article"
      onClick={handleClick}
      className="cursor-pointer overflow-hidden rounded-xl border border-gray-100 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-video">
        <Image
          src={photoUrl}
          alt={shop.name}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 33vw, 100vw"
        />
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold text-gray-900">
          {shop.name}
        </h3>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs text-[#E06B3F]">★</span>
          <span className="text-xs text-gray-600">
            {shop.rating?.toFixed(1)}
          </span>
          {locationLabel && (
            <>
              <span className="text-xs text-gray-300">·</span>
              <span className="truncate text-xs text-gray-500">
                {locationLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
