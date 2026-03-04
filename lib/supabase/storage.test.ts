import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import { uploadCheckInPhoto, uploadMenuPhoto } from './storage';

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

beforeEach(() => {
  vi.mocked(createClient).mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-abc' } } },
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  mockUpload.mockReset();
  mockGetPublicUrl.mockReset();
});

describe('uploadCheckInPhoto', () => {
  it('uploads file to checkin-photos bucket under user path and returns public URL', async () => {
    mockUpload.mockResolvedValue({
      data: { path: 'user-abc/test.webp' },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          'https://example.supabase.co/storage/v1/object/public/checkin-photos/user-abc/test.webp',
      },
    });

    const file = new File(['photo'], 'latte.jpg', { type: 'image/jpeg' });
    const url = await uploadCheckInPhoto(file);

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-abc\/[a-f0-9-]+\.\w+$/),
      file,
      { contentType: 'image/jpeg' }
    );
    expect(url).toContain('checkin-photos');
  });

  it('throws when upload fails', async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { message: 'Bucket not found' },
    });

    const file = new File(['photo'], 'latte.jpg', { type: 'image/jpeg' });
    await expect(uploadCheckInPhoto(file)).rejects.toThrow('Bucket not found');
  });
});

describe('uploadMenuPhoto', () => {
  it('uploads to menu-photos bucket', async () => {
    mockUpload.mockResolvedValue({
      data: { path: 'user-abc/menu.webp' },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          'https://example.supabase.co/storage/v1/object/public/menu-photos/user-abc/menu.webp',
      },
    });

    const file = new File(['photo'], 'menu.jpg', { type: 'image/jpeg' });
    const url = await uploadMenuPhoto(file);

    expect(url).toContain('menu-photos');
  });
});
