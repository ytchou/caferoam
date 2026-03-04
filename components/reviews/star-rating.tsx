'use client';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

function Star({ filled, size }: { filled: boolean; size: string }) {
  return (
    <svg
      role="img"
      aria-hidden="true"
      data-filled={filled}
      viewBox="0 0 20 20"
      className={`${size} ${filled ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`}
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const sizeClass = SIZES[size];
  const interactive = !!onChange;

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) =>
        interactive ? (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? 0 : star)}
            className="focus:outline-none"
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            <Star filled={star <= value} size={sizeClass} />
          </button>
        ) : (
          <Star key={star} filled={star <= value} size={sizeClass} />
        ),
      )}
    </div>
  );
}
