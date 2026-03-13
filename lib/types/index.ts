export interface Shop {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  mrt: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string[] | null;
  rating: number | null;
  reviewCount: number;
  priceRange: string | null;
  description: string | null;
  photoUrls: string[];
  menuUrl: string | null;
  taxonomyTags: TaxonomyTag[];
  cafenomadId: string | null;
  googlePlaceId: string | null;
  createdAt: string;
  updatedAt: string;
  slug?: string;
}

export interface ShopDetail extends Shop {
  modeScores?: {
    work: number;
    rest: number;
    social: number;
  };
}

export interface TaxonomyTag {
  id: string;
  dimension: TaxonomyDimension;
  label: string;
  labelZh: string;
}

export type TaxonomyDimension = 'functionality' | 'time' | 'ambience' | 'mode';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  pdpaConsentAt: string;
  createdAt: string;
}

export interface ListItem {
  shop_id: string;
  added_at: string;
}

export interface List {
  id: string;
  user_id: string;
  name: string;
  items: ListItem[];
  created_at: string;
  updated_at: string;
}

export interface ListPin {
  list_id: string;
  shop_id: string;
  lat: number;
  lng: number;
}

export interface CheckIn {
  id: string;
  userId: string;
  shopId: string;
  photoUrls: [string, ...string[]];
  menuPhotoUrl: string | null;
  note: string | null;
  stars: number | null;
  reviewText: string | null;
  confirmedTags: string[] | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ShopReview {
  id: string;
  user_id: string;
  display_name: string | null;
  stars: number;
  review_text: string | null;
  confirmed_tags: string[] | null;
  reviewed_at: string;
}

export interface ShopReviewsResponse {
  reviews: ShopReview[];
  total_count: number;
  average_rating: number;
}

export interface Stamp {
  id: string;
  userId: string;
  shopId: string;
  checkInId: string;
  designUrl: string;
  earnedAt: string;
  shopName: string | null;
}

export interface SearchResult {
  shop: Shop;
  similarityScore: number;
  taxonomyBoost: number;
  totalScore: number;
}

export interface SearchQuery {
  text: string;
  filters?: {
    dimensions?: Partial<Record<TaxonomyDimension, string[]>>;
    nearLatitude?: number;
    nearLongitude?: number;
    radiusKm?: number;
  };
  limit?: number;
}
