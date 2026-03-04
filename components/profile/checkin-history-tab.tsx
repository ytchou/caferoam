import Link from 'next/link';
import type { CheckInData } from '@/lib/hooks/use-user-checkins';
import { formatDate } from '@/lib/utils';

interface CheckinHistoryTabProps {
  checkins: CheckInData[];
  isLoading: boolean;
}

export function CheckinHistoryTab({ checkins, isLoading }: CheckinHistoryTabProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12" data-testid="loading-spinner">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
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
  const date = formatDate(checkin.created_at);

  return (
    <div className="flex gap-3 rounded-lg border p-3">
      {checkin.photo_urls[0] && (
        <img
          src={checkin.photo_urls[0]}
          alt=""
          className="h-[60px] w-[60px] rounded-md object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <Link
          href={`/shop/${checkin.shop_id}`}
          className="font-medium hover:underline"
        >
          {checkin.shop_name}
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {checkin.stars != null && <StarDisplay count={checkin.stars} />}
          <span>{date}</span>
        </div>
        {checkin.shop_mrt && (
          <p className="text-xs text-muted-foreground">{checkin.shop_mrt}</p>
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
