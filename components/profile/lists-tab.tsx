import Image from 'next/image';
import Link from 'next/link';
import type { ListSummaryData } from '@/lib/hooks/use-list-summaries';

interface ListsTabProps {
  lists: ListSummaryData[];
  isLoading: boolean;
}

export function ListsTab({ lists, isLoading }: ListsTabProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12" data-testid="loading-spinner">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <p>No lists yet — save shops to organise your favourites</p>
        <Link
          href="/lists"
          className="text-primary mt-2 inline-block text-sm hover:underline"
        >
          Create a list →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lists.map((list) => (
        <ListCard key={list.id} list={list} />
      ))}
    </div>
  );
}

function ListCard({ list }: { list: ListSummaryData }) {
  const extraCount = list.shop_count - list.preview_photos.length;

  return (
    <Link
      href={`/lists/${list.id}`}
      className="hover:bg-accent/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
    >
      <div>
        <p className="font-medium">{list.name}</p>
        <p className="text-muted-foreground text-sm">{list.shop_count} shops</p>
      </div>
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {list.preview_photos.map((url, i) => (
            <Image
              key={i}
              src={url}
              alt={`${list.name} shop preview ${i + 1}`}
              width={40}
              height={40}
              className="border-background rounded-full border-2 object-cover"
            />
          ))}
        </div>
        {extraCount > 0 && (
          <span className="text-muted-foreground ml-1 text-xs">
            +{extraCount}
          </span>
        )}
      </div>
    </Link>
  );
}
