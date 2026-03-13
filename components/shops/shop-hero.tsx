"use client";
import Image from "next/image";

interface ShopHeroProps {
  photoUrls: string[];
  shopName: string;
}

export function ShopHero({ photoUrls, shopName }: ShopHeroProps) {
  const primary = photoUrls[0] ?? "/placeholder-cafe.jpg";
  return (
    <div className="relative aspect-video w-full bg-gray-100">
      <Image src={primary} alt={shopName} fill className="object-cover" priority />
    </div>
  );
}
