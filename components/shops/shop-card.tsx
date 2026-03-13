"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Shop } from "@/lib/types";

type ShopCardData = Pick<Shop, "id" | "name" | "rating"> & {
  slug?: string;
  mrt?: string;
  photoUrls?: string[];
  photo_urls?: string[];
};

interface ShopCardProps {
  shop: ShopCardData;
}

export function ShopCard({ shop }: ShopCardProps) {
  const router = useRouter();

  const handleClick = () => {
    const slug = shop.slug ?? shop.id;
    router.push(`/shops/${shop.id}/${slug}`);
  };

  const locationLabel = shop.mrt ?? "";

  const photoUrl =
    (shop.photo_urls ?? shop.photoUrls)?.[0] ?? "/placeholder-cafe.jpg";

  return (
    <article
      role="article"
      onClick={handleClick}
      className="cursor-pointer rounded-xl overflow-hidden bg-white border border-gray-100 hover:shadow-md transition-shadow"
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
        <h3 className="font-semibold text-sm text-gray-900 truncate">{shop.name}</h3>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[#E06B3F] text-xs">★</span>
          <span className="text-xs text-gray-600">{shop.rating?.toFixed(1)}</span>
          {locationLabel && (
            <>
              <span className="text-gray-300 text-xs">·</span>
              <span className="text-xs text-gray-500 truncate">{locationLabel}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
