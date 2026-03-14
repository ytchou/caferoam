'use client';
import { useEffect } from 'react';
import type { TaxonomyTag } from '@/lib/types';
import { ShopHero } from '@/components/shops/shop-hero';
import { ShopIdentity } from '@/components/shops/shop-identity';
import { AttributeChips } from '@/components/shops/attribute-chips';
import { ShareButton } from '@/components/shops/share-button';
import { StickyCheckinBar } from '@/components/shops/sticky-checkin-bar';
import { ShopDescription } from '@/components/shops/shop-description';
import { MenuHighlights } from '@/components/shops/menu-highlights';
import { RecentCheckinsStrip } from '@/components/shops/recent-checkins-strip';
import { ShopMapThumbnail } from '@/components/shops/shop-map-thumbnail';
import { useAnalytics } from '@/lib/posthog/use-analytics';

interface ShopData {
  id: string;
  name: string;
  slug?: string;
  rating?: number | null;
  reviewCount?: number;
  description?: string | null;
  photoUrls?: string[];
  taxonomyTags?: Array<{
    id: string;
    dimension: string;
    label: string;
    labelZh: string;
  }>;
  mrt?: string;
  menuHighlights?: Array<{ name: string; emoji: string; price: string }>;
  latitude?: number;
  longitude?: number;
  checkinPreview?: { count: number; previewPhotoUrl: string | null };
  recentCheckins?: Array<{ id: string; displayName: string | null; photoUrl: string; createdAt: string }>;
}

interface ShopDetailClientProps {
  shop: ShopData;
}

export function ShopDetailClient({ shop }: ShopDetailClientProps) {
  const { capture } = useAnalytics();
  const photos = shop.photoUrls ?? [];
  const tags = shop.taxonomyTags ?? [];
  const shopPath = `/shops/${shop.id}/${shop.slug ?? shop.id}`;

  useEffect(() => {
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    const lastQuery =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('last_search_query')
        : null;
    capture('shop_detail_viewed', {
      shop_id: shop.id,
      referrer,
      session_search_query: lastQuery,
    });
  }, [capture, shop.id]);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${shopPath}`
      : shopPath;

  return (
    <div className="min-h-screen bg-white pb-20">
      <ShopHero photoUrls={photos} shopName={shop.name} />
      <ShopIdentity
        name={shop.name}
        rating={shop.rating}
        reviewCount={shop.reviewCount}
        mrt={shop.mrt}
      />
      {tags.length > 0 && <AttributeChips tags={tags as TaxonomyTag[]} />}
      {shop.description && <ShopDescription text={shop.description} />}
      {shop.menuHighlights && <MenuHighlights items={shop.menuHighlights} />}
      {shop.latitude != null && shop.longitude != null && (
        <ShopMapThumbnail latitude={shop.latitude} longitude={shop.longitude} shopName={shop.name} />
      )}
      {shop.checkinPreview && (
        <RecentCheckinsStrip
          preview={shop.checkinPreview}
          checkins={shop.recentCheckins ?? []}
        />
      )}
      <div className="px-4 py-2">
        <ShareButton
          shopId={shop.id}
          shopName={shop.name}
          shareUrl={shareUrl}
        />
      </div>
      <StickyCheckinBar
        shopId={shop.id}
        returnTo={shopPath}
      />
    </div>
  );
}
