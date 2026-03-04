import { StarRating } from '@/components/reviews/star-rating';
import type { ShopReview } from '@/lib/types';

interface ReviewCardProps {
  review: ShopReview;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const date = new Date(review.reviewed_at).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <div className="mb-1 flex items-center gap-2">
        <StarRating value={review.stars} size="sm" />
        <span className="text-sm text-gray-500">{date}</span>
      </div>
      <p className="text-sm font-medium text-gray-700">
        {review.display_name ?? 'Anonymous'}
      </p>
      {review.review_text && (
        <p className="mt-1 text-sm text-gray-600">{review.review_text}</p>
      )}
      {review.confirmed_tags && review.confirmed_tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {review.confirmed_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
