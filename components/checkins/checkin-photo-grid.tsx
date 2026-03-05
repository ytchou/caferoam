'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import { fetchWithAuth } from '@/lib/api/fetch';

interface CheckInSummary {
  id: string;
  user_id: string;
  display_name: string | null;
  photo_url: string;
  note: string | null;
  stars: number | null;
  review_text: string | null;
  confirmed_tags: string[] | null;
  reviewed_at: string | null;
  created_at: string;
}

interface CheckInPreview {
  count: number;
  preview_photo_url: string | null;
}

interface CheckInPhotoGridProps {
  shopId: string;
  isAuthenticated: boolean;
}

function CheckInHeader({ count }: { count: number }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-semibold">Recent Check-ins</h3>
      <span className="text-sm text-gray-500">{count} visits</span>
    </div>
  );
}

export function CheckInPhotoGrid({
  shopId,
  isAuthenticated,
}: CheckInPhotoGridProps) {
  const apiUrl = `/api/shops/${shopId}/checkins`;
  const swrKey = `${isAuthenticated ? 'auth' : 'anon'}:${apiUrl}`;
  const fetcher = useCallback(
    () =>
      isAuthenticated
        ? fetchWithAuth(apiUrl)
        : fetch(apiUrl).then((r) => r.json()),
    [isAuthenticated, apiUrl]
  );
  const { data } = useSWR(swrKey, fetcher);

  if (!data) return null;

  // Authenticated: data is CheckInSummary[]
  if (isAuthenticated && Array.isArray(data)) {
    if (data.length === 0) return null;

    return (
      <section>
        <CheckInHeader count={data.length} />
        <div className="grid grid-cols-3 gap-1">
          {data.slice(0, 9).map((checkin: CheckInSummary) => (
            <div key={checkin.id} className="relative aspect-square w-full">
              <Image
                src={checkin.photo_url}
                alt={`Check-in by ${checkin.display_name ?? 'user'}`}
                fill
                className="rounded object-cover"
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Unauthenticated: data is CheckInPreview
  const preview = data as CheckInPreview;
  if (preview.count === 0) return null;

  return (
    <section>
      <CheckInHeader count={preview.count} />
      <div className="relative h-32 overflow-hidden rounded-lg">
        {preview.preview_photo_url && (
          <Image
            src={preview.preview_photo_url}
            alt="Recent check-in"
            fill
            className="object-cover blur-sm brightness-75"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <a
            href="/login"
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-gray-800 shadow"
          >
            Log in to see all check-ins
          </a>
        </div>
      </div>
    </section>
  );
}
