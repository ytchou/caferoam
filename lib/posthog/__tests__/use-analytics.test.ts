import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockCapture = vi.fn();
vi.mock('posthog-js', () => ({
  default: {
    capture: mockCapture,
  },
}));

describe('useAnalytics', () => {
  beforeEach(() => {
    mockCapture.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('captures an event when PostHog key is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test123');
    const { useAnalytics } = await import('../use-analytics');
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.capture('test_event', { foo: 'bar' });
    });

    expect(mockCapture).toHaveBeenCalledWith('test_event', { foo: 'bar' });
  });

  it('no-ops when PostHog key is not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
    vi.resetModules();
    const { useAnalytics } = await import('../use-analytics');
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.capture('test_event', { foo: 'bar' });
    });

    expect(mockCapture).not.toHaveBeenCalled();
  });
});
