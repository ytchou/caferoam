'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/reviews/star-rating';
import { TagConfirmation } from '@/components/reviews/tag-confirmation';
import type { TaxonomyTag } from '@/lib/types';

interface ReviewData {
  stars: number;
  review_text: string | null;
  confirmed_tags: string[];
}

interface ReviewFormProps {
  shopTags: TaxonomyTag[];
  onSubmit: (data: ReviewData) => void;
  initialStars?: number;
  initialText?: string;
  initialTags?: string[];
}

export function ReviewForm({
  shopTags,
  onSubmit,
  initialStars = 0,
  initialText = '',
  initialTags = [],
}: ReviewFormProps) {
  const [stars, setStars] = useState(initialStars);
  const [reviewText, setReviewText] = useState(initialText);
  const [confirmedTags, setConfirmedTags] = useState<string[]>(initialTags);

  const showDetails = stars > 0;

  const handleSubmit = () => {
    if (stars === 0) return;
    onSubmit({
      stars,
      review_text: reviewText.trim() || null,
      confirmed_tags: confirmedTags,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Rate your visit <span className="text-gray-400">(optional)</span>
        </label>
        <StarRating value={stars} onChange={setStars} size="lg" />
      </div>

      {showDetails && (
        <>
          {shopTags.length > 0 && (
            <TagConfirmation
              tags={shopTags}
              confirmedIds={confirmedTags}
              onChange={setConfirmedTags}
            />
          )}

          <div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="How was your visit? 這次體驗如何？"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            variant="secondary"
            className="w-full"
          >
            Save Review
          </Button>
        </>
      )}
    </div>
  );
}
