import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ShopDetailClient } from './shop-detail-client';
import { BACKEND_URL } from '@/lib/api/proxy';

interface Params {
  shopId: string;
  slug: string;
}

async function fetchShop(shopId: string) {
  const res = await fetch(`${BACKEND_URL}/shops/${shopId}`, {
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch shop: ${res.status}`);
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { shopId } = await params;
  const shop = await fetchShop(shopId);
  if (!shop) return { title: 'Shop not found' };

  const photo = shop.photoUrls?.[0];
  return {
    title: `${shop.name} — 啡遊`,
    description: shop.description ?? `探索 ${shop.name}，台灣精品咖啡廳。`,
    openGraph: {
      title: shop.name,
      description: shop.description ?? `探索 ${shop.name}，台灣精品咖啡廳。`,
      ...(photo ? { images: [{ url: photo, width: 1200, height: 630 }] } : {}),
    },
  };
}

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { shopId, slug } = await params;
  const shop = await fetchShop(shopId);

  if (!shop) {
    notFound();
  }

  // Canonical slug redirect — if URL slug doesn't match the stored slug, redirect
  if (shop.slug && slug !== shop.slug) {
    redirect(`/shops/${shopId}/${shop.slug}`);
  }

  return <ShopDetailClient shop={shop} />;
}
