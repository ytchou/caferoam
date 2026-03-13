interface ShopIdentityProps {
  name: string;
  rating?: number | null;
  reviewCount?: number;
  mrt?: string;
}

export function ShopIdentity({ name, rating, reviewCount, mrt }: ShopIdentityProps) {
  return (
    <div className="px-4 py-3">
      <h1 className="text-xl font-bold text-gray-900">{name}</h1>
      {rating != null && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[#E06B3F]">★</span>
          <span className="text-sm text-gray-700">{rating.toFixed(1)}</span>
          {reviewCount != null && (
            <span className="text-xs text-gray-400">({reviewCount})</span>
          )}
          {mrt && <span className="text-xs text-gray-400 ml-1">· {mrt}</span>}
        </div>
      )}
    </div>
  );
}
