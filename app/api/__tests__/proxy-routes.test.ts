import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock proxyToBackend before importing route handlers
vi.mock('@/lib/api/proxy', () => ({
  proxyToBackend: vi.fn(),
}));

import { proxyToBackend } from '@/lib/api/proxy';
import { POST as authPOST } from '../auth/route';
// Admin proxy routes
import { POST as approvePOST } from '../admin/pipeline/approve/[id]/route';
import { GET as pipelineJobsGET } from '../admin/pipeline/jobs/route';
import { POST as cancelJobPOST } from '../admin/pipeline/jobs/[id]/cancel/route';
import { GET as pipelineOverviewGET } from '../admin/pipeline/overview/route';
import { POST as rejectPOST } from '../admin/pipeline/reject/[id]/route';
import { POST as retryPOST } from '../admin/pipeline/retry/[id]/route';
import { GET as adminShopsGET, POST as adminShopsPOST } from '../admin/shops/route';
import {
  GET as adminShopGET,
  PUT as adminShopPUT,
} from '../admin/shops/[id]/route';
import { POST as enqueuePOST } from '../admin/shops/[id]/enqueue/route';
import { GET as searchRankGET } from '../admin/shops/[id]/search-rank/route';
import { GET as taxonomyStatsGET } from '../admin/taxonomy/stats/route';
import { POST as consentPOST } from '../auth/consent/route';
import { POST as cancelDeletionPOST } from '../auth/cancel-deletion/route';
import { DELETE as accountDELETE } from '../auth/account/route';
import { GET as checkinsGET, POST as checkinsPOST } from '../checkins/route';
import { DELETE as listShopDELETE } from '../lists/[listId]/shops/[shopId]/route';
import { POST as listShopsPOST } from '../lists/[listId]/shops/route';
import { DELETE as listDELETE } from '../lists/[listId]/route';
import { GET as listsGET, POST as listsPOST } from '../lists/route';
import { GET as searchGET } from '../search/route';
import { GET as shopGET } from '../shops/[id]/route';
import { GET as shopsGET } from '../shops/route';
import { GET as stampsGET } from '../stamps/route';

const mockProxy = vi.mocked(proxyToBackend);
const mockResponse = new Response('{}', { status: 200 });

function makeRequest(url = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  mockProxy.mockResolvedValue(mockResponse);
});

describe('auth route', () => {
  it('POST proxies to /auth', async () => {
    await authPOST(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(expect.any(NextRequest), '/auth');
  });
});

describe('auth/consent route', () => {
  it('POST proxies to /auth/consent', async () => {
    await consentPOST(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/auth/consent'
    );
  });
});

describe('auth/cancel-deletion route', () => {
  it('POST proxies to /auth/cancel-deletion', async () => {
    await cancelDeletionPOST(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/auth/cancel-deletion'
    );
  });
});

describe('auth/account route', () => {
  it('DELETE proxies to /auth/account', async () => {
    await accountDELETE(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/auth/account'
    );
  });
});

describe('search route', () => {
  it('GET proxies to /search', async () => {
    await searchGET(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(expect.any(NextRequest), '/search');
  });
});

describe('checkins route', () => {
  it('GET proxies to /checkins', async () => {
    await checkinsGET(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/checkins'
    );
  });

  it('POST proxies to /checkins', async () => {
    await checkinsPOST(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/checkins'
    );
  });
});

describe('shops route', () => {
  it('GET proxies to /shops', async () => {
    await shopsGET(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(expect.any(NextRequest), '/shops');
  });
});

describe('shops/[id] route', () => {
  it('GET proxies to /shops/:id', async () => {
    await shopGET(makeRequest(), { params: Promise.resolve({ id: 'shop-1' }) });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/shops/shop-1'
    );
  });
});

describe('stamps route', () => {
  it('GET proxies to /stamps', async () => {
    await stampsGET(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(expect.any(NextRequest), '/stamps');
  });
});

describe('lists route', () => {
  it('GET proxies to /lists', async () => {
    await listsGET(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(expect.any(NextRequest), '/lists');
  });

  it('POST proxies to /lists', async () => {
    await listsPOST(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(expect.any(NextRequest), '/lists');
  });
});

describe('lists/[listId] route', () => {
  it('DELETE proxies to /lists/:listId', async () => {
    await listDELETE(makeRequest(), {
      params: Promise.resolve({ listId: 'list-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/lists/list-1'
    );
  });
});

describe('lists/[listId]/shops route', () => {
  it('POST proxies to /lists/:listId/shops', async () => {
    await listShopsPOST(makeRequest(), {
      params: Promise.resolve({ listId: 'list-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/lists/list-1/shops'
    );
  });
});

describe('lists/[listId]/shops/[shopId] route', () => {
  it('DELETE proxies to /lists/:listId/shops/:shopId', async () => {
    await listShopDELETE(makeRequest(), {
      params: Promise.resolve({ listId: 'list-1', shopId: 'shop-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/lists/list-1/shops/shop-1'
    );
  });
});

describe('admin/pipeline/overview route', () => {
  it('GET proxies to /admin/pipeline/overview', async () => {
    await pipelineOverviewGET(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/pipeline/overview'
    );
  });
});

describe('admin/pipeline/jobs route', () => {
  it('GET proxies to /admin/pipeline/jobs', async () => {
    await pipelineJobsGET(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/pipeline/jobs'
    );
  });
});

describe('admin/pipeline/jobs/[id]/cancel route', () => {
  it('POST proxies to /admin/pipeline/jobs/:id/cancel', async () => {
    await cancelJobPOST(makeRequest(), {
      params: Promise.resolve({ id: 'job-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/pipeline/jobs/job-1/cancel'
    );
  });
});

describe('admin/pipeline/approve/[id] route', () => {
  it('POST proxies to /admin/pipeline/approve/:id', async () => {
    await approvePOST(makeRequest(), {
      params: Promise.resolve({ id: 'sub-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/pipeline/approve/sub-1'
    );
  });
});

describe('admin/pipeline/reject/[id] route', () => {
  it('POST proxies to /admin/pipeline/reject/:id', async () => {
    await rejectPOST(makeRequest(), {
      params: Promise.resolve({ id: 'sub-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/pipeline/reject/sub-1'
    );
  });
});

describe('admin/pipeline/retry/[id] route', () => {
  it('POST proxies to /admin/pipeline/retry/:id', async () => {
    await retryPOST(makeRequest(), {
      params: Promise.resolve({ id: 'job-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/pipeline/retry/job-1'
    );
  });
});

describe('admin/shops route', () => {
  it('GET proxies to /admin/shops', async () => {
    await adminShopsGET(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/shops'
    );
  });

  it('POST proxies to /admin/shops', async () => {
    await adminShopsPOST(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/shops'
    );
  });
});

describe('admin/shops/[id] route', () => {
  it('GET proxies to /admin/shops/:id', async () => {
    await adminShopGET(makeRequest(), {
      params: Promise.resolve({ id: 'shop-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/shops/shop-1'
    );
  });

  it('PUT proxies to /admin/shops/:id', async () => {
    await adminShopPUT(makeRequest(), {
      params: Promise.resolve({ id: 'shop-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/shops/shop-1'
    );
  });
});

describe('admin/shops/[id]/enqueue route', () => {
  it('POST proxies to /admin/shops/:id/enqueue', async () => {
    await enqueuePOST(makeRequest(), {
      params: Promise.resolve({ id: 'shop-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/shops/shop-1/enqueue'
    );
  });
});

describe('admin/shops/[id]/search-rank route', () => {
  it('GET proxies to /admin/shops/:id/search-rank', async () => {
    await searchRankGET(makeRequest(), {
      params: Promise.resolve({ id: 'shop-1' }),
    });
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/shops/shop-1/search-rank'
    );
  });
});

describe('admin/taxonomy/stats route', () => {
  it('GET proxies to /admin/taxonomy/stats', async () => {
    await taxonomyStatsGET(makeRequest());
    expect(mockProxy).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/admin/taxonomy/stats'
    );
  });
});
