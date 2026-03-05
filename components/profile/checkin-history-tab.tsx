import Image from 'next/image';
import Link from 'next/link';
import type { CheckInData } from '@/lib/hooks/use-user-checkins';
import { formatRelativeTime } from '@/lib/utils';

interface CheckinHistoryTabProps {
  checkins: CheckInData[];
  isLoading: boolean;
}

export function CheckinHistoryTab({
  checkins,
  isLoading,
}: CheckinHistoryTabProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12" data-testid="loading-spinner">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <p>No check-ins yet — find a shop to visit</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {checkins.map((checkin) => (
        <CheckinCard key={checkin.id} checkin={checkin} />
      ))}
    </div>
  );
}

function CheckinCard({ checkin }: { checkin: CheckInData }) {
  const date = formatRelativeTime(checkin.created_at);

  return (
    <div className="flex gap-3 rounded-lg border p-3">
      {checkin.photo_urls[0] && (
        <Image
          src={checkin.photo_urls[0]}
          alt=""
          width={60}
          height={60}
          className="rounded-md object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={`/shop/${checkin.shop_id}`}
          className="font-medium hover:underline"
        >
          {checkin.shop_name ?? 'Unknown Shop'}
        </Link>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {checkin.stars != null && <StarDisplay count={checkin.stars} />}
          <span>{date}</span>
        </div>
        {checkin.shop_mrt && (
          <p className="text-muted-foreground text-xs">{checkin.shop_mrt}</p>
        )}
      </div>
    </div>
  );
}

function StarDisplay({ count }: { count: number }) {
  return (
    <span className="flex">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          data-testid={i < count ? 'star-filled' : 'star-empty'}
          className={i < count ? 'text-yellow-500' : 'text-gray-300'}
        >
          ★
        </span>
      ))}
    </span>
  );
}
