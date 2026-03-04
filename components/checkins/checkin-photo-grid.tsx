'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { fetchWithAuth } from '@/lib/api/fetch';

interface CheckInSummary {
  id: string;
  user_id: string;
  display_name: string | null;
  photo_url: string;
  note: string | null;
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
            <img
              key={checkin.id}
              src={checkin.photo_url}
              alt={`Check-in by ${checkin.display_name ?? 'user'}`}
              className="aspect-square w-full rounded object-cover"
            />
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
      <div className="relative overflow-hidden rounded-lg">
        {preview.preview_photo_url && (
          <img
            src={preview.preview_photo_url}
            alt="Recent check-in"
            className="h-32 w-full object-cover blur-sm brightness-75"
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
