/**
 * Shared test data factories. Realistic Taiwan-based defaults, all overridable.
 */

const TS = '2026-01-15T10:00:00.000Z';

export function makeUser(overrides: Record<string, unknown> = {}) {
  const defaults = {
    id: 'user-a1b2c3',
    email: 'lin.mei@gmail.com',
    user_metadata: {
      pdpa_consented: true,
    },
    app_metadata: {
      pdpa_consented: true,
      deletion_requested: false,
    },
  };
  return {
    ...defaults,
    ...overrides,
    app_metadata: {
      ...defaults.app_metadata,
      ...(overrides.app_metadata as Record<string, unknown> | undefined),
    },
    user_metadata: {
      ...defaults.user_metadata,
      ...(overrides.user_metadata as Record<string, unknown> | undefined),
    },
  };
}

export function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token-payload.signature',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: makeUser(),
    ...overrides,
  };
}

export function makeShop(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shop-d4e5f6',
    name: '山小孩咖啡',
    address: '台北市大安區溫州街74巷5弄2號',
    latitude: 25.0216,
    longitude: 121.5312,
    mrt: '台電大樓',
    phone: '02-2364-0088',
    rating: 4.6,
    review_count: 287,
    price_range: '$$',
    slug: 'shan-xiao-hai-ka-fei',
    description: '安靜適合工作的獨立咖啡店',
    photo_urls: [
      'https://example.supabase.co/storage/v1/object/public/shop-photos/d4e5f6/exterior.jpg',
    ],
    ...overrides,
  };
}

export function makeList(overrides: Record<string, unknown> = {}) {
  return {
    id: 'list-g7h8i9',
    user_id: 'user-a1b2c3',
    name: '適合工作的咖啡店',
    items: [],
    created_at: TS,
    updated_at: TS,
    ...overrides,
  };
}

export function makeListItem(overrides: Record<string, unknown> = {}) {
  return {
    shop_id: 'shop-d4e5f6',
    added_at: TS,
    ...overrides,
  };
}

export function makeCheckIn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ci-j0k1l2',
    user_id: 'user-a1b2c3',
    shop_id: 'shop-d4e5f6',
    photo_urls: [
      'https://example.supabase.co/storage/v1/object/public/checkin-photos/user-a1b2c3/photo1.jpg',
    ],
    menu_photo_url: null,
    note: null,
    created_at: TS,
    ...overrides,
  };
}

export function makeStamp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stamp-m3n4o5',
    user_id: 'user-a1b2c3',
    shop_id: 'shop-d4e5f6',
    check_in_id: 'ci-j0k1l2',
    design_url:
      'https://example.supabase.co/storage/v1/object/public/stamps/d4e5f6.png',
    earned_at: TS,
    shop_name: '咖啡廳 Coffee Lab',
    ...overrides,
  };
}
