"use client";
import { useEffect } from "react";
import { ShopHero } from "@/components/shops/shop-hero";
import { ShopIdentity } from "@/components/shops/shop-identity";
import { AttributeChips } from "@/components/shops/attribute-chips";
import { ShareButton } from "@/components/shops/share-button";
import { StickyCheckinBar } from "@/components/shops/sticky-checkin-bar";
import { useAnalytics } from "@/lib/posthog/use-analytics";

interface ShopData {
  id: string;
  name: string;
  slug?: string;
  rating?: number | null;
  review_count?: number;
  description?: string | null;
  photo_urls?: string[];
  photoUrls?: string[];
  taxonomy_tags?: Array<{ id: string; label_zh?: string; labelZh?: string; label?: string }>;
  tags?: Array<{ id: string; label_zh?: string; labelZh?: string; label?: string }>;
  mrt?: string;
}

interface ShopDetailPageProps {
  shop: ShopData;
}

export default function ShopDetailPage({ shop }: ShopDetailPageProps) {
  const { capture } = useAnalytics();
  const photos = shop.photo_urls ?? shop.photoUrls ?? [];
  const tags = shop.taxonomy_tags ?? shop.tags ?? [];

  useEffect(() => {
    capture("shop_detail_viewed", { shop_id: shop.id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id]);
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/shops/${shop.id}/${shop.slug ?? shop.id}`
    : `/shops/${shop.id}/${shop.slug ?? shop.id}`;

  return (
    <div className="min-h-screen bg-white pb-20">
      <ShopHero photoUrls={photos} shopName={shop.name} />
      <ShopIdentity
        name={shop.name}
        rating={shop.rating}
        reviewCount={shop.review_count}
        mrt={shop.mrt}
      />
      {tags.length > 0 && <AttributeChips tags={tags} />}
      {shop.description && (
        <p className="px-4 py-2 text-sm text-gray-600">{shop.description}</p>
      )}
      <div className="px-4 py-2">
        <ShareButton shopId={shop.id} shopName={shop.name} shareUrl={shareUrl} />
      </div>
      <StickyCheckinBar shopId={shop.id} returnTo={`/shops/${shop.id}/${shop.slug}`} />
    </div>
  );
}
