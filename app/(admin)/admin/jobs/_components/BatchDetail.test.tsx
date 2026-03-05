import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRouter } from '@/lib/test-utils/mocks';
import { BatchDetail } from './BatchDetail';

const mockRouter = createMockRouter();
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token-payload.signature';
const BATCH_ID = 'batch-abc123';

function makeBatchResponse(
  shops: Array<Record<string, unknown>> = [],
  overrides: Record<string, unknown> = {}
) {
  return {
    batch_id: BATCH_ID,
    shops,
    total: shops.length,
    status_summary: { live: 2, failed: 1 },
    ...overrides,
  };
}

function makeShopDetail(overrides: Record<string, unknown> = {}) {
  return {
    shop_id: 'shop-d4e5f6',
    name: '山小孩咖啡',
    processing_status: 'live',
    last_error: null,
    failed_at_stage: null,
    ...overrides,
  };
}

describe('BatchDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders shop list when the batch API returns data', async () => {
    const shops = [
      makeShopDetail({
        shop_id: 'shop-d4e5f6',
        name: '山小孩咖啡',
        processing_status: 'live',
      }),
      makeShopDetail({
        shop_id: 'shop-g7h8i9',
        name: '城市光廊咖啡',
        processing_status: 'failed',
        last_error: 'Scraping timeout',
        failed_at_stage: 'scraping',
      }),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeBatchResponse(shops)),
    });

    render(<BatchDetail batchId={BATCH_ID} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(screen.getByText('山小孩咖啡')).toBeInTheDocument();
    });

    expect(screen.getByText('城市光廊咖啡')).toBeInTheDocument();
    // 'live' and 'failed' appear in both the status summary bar and in shop rows
    expect(screen.getAllByText('live').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('failed').length).toBeGreaterThanOrEqual(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/admin/pipeline/batches/${BATCH_ID}`),
      expect.objectContaining({
        headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      })
    );
  });

  it('shows error message when the batch API returns a failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Unauthorized' }),
    });

    render(<BatchDetail batchId={BATCH_ID} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('navigates to the shop detail page when the admin clicks a shop row', async () => {
    const shops = [
      makeShopDetail({ shop_id: 'shop-d4e5f6', name: '山小孩咖啡' }),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeBatchResponse(shops)),
    });

    const user = userEvent.setup();
    render(<BatchDetail batchId={BATCH_ID} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(screen.getByText('山小孩咖啡')).toBeInTheDocument();
    });

    await user.click(screen.getByText('山小孩咖啡'));
    expect(mockRouter.push).toHaveBeenCalledWith('/admin/shops/shop-d4e5f6');
  });

  it('filters by status when a summary badge is clicked', async () => {
    const shops = [
      makeShopDetail({ name: '山小孩咖啡', processing_status: 'live' }),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          makeBatchResponse(shops, { status_summary: { live: 1, failed: 2 } })
        ),
    });

    const user = userEvent.setup();
    render(<BatchDetail batchId={BATCH_ID} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(screen.getByText('live: 1')).toBeInTheDocument();
    });

    const callsBefore = mockFetch.mock.calls.length;
    await user.click(screen.getByText('live: 1'));

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    const lastUrl = mockFetch.mock.calls[
      mockFetch.mock.calls.length - 1
    ][0] as string;
    expect(lastUrl).toContain('status=live');
  });

  it('shows empty state when no shops match the filter', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeBatchResponse([], { total: 0 })),
    });

    render(<BatchDetail batchId={BATCH_ID} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(
        screen.getByText('No shops match the current filter.')
      ).toBeInTheDocument();
    });
  });

  it('truncates long error messages in the shop row', async () => {
    const longError = 'A'.repeat(100);
    const shops = [
      makeShopDetail({
        shop_id: 'shop-d4e5f6',
        name: '品墨良行',
        processing_status: 'failed',
        last_error: longError,
        failed_at_stage: 'enriching',
      }),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeBatchResponse(shops)),
    });

    render(<BatchDetail batchId={BATCH_ID} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(screen.getByText('品墨良行')).toBeInTheDocument();
    });

    const errorCell = screen.getByText(/\[enriching\]/);
    expect(errorCell.textContent).toContain('…');
  });
});
