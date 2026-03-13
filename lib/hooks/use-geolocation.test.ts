import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGeolocation } from './use-geolocation';

describe('useGeolocation', () => {
  const mockGetCurrentPosition = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: mockGetCurrentPosition },
    });
  });

  it('returns coordinates when geolocation succeeds', async () => {
    mockGetCurrentPosition.mockImplementation((success) => {
      success({ coords: { latitude: 25.033, longitude: 121.565 } });
    });

    const { result } = renderHook(() => useGeolocation());
    await act(async () => {
      await result.current.requestLocation();
    });

    expect(result.current.latitude).toBe(25.033);
    expect(result.current.longitude).toBe(121.565);
    expect(result.current.error).toBeNull();
  });

  it('returns error when geolocation is denied', async () => {
    mockGetCurrentPosition.mockImplementation((_, error) => {
      error({ code: 1, message: 'User denied' });
    });

    const { result } = renderHook(() => useGeolocation());
    await act(async () => {
      await result.current.requestLocation();
    });

    expect(result.current.latitude).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
