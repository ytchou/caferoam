import { describe, it, expect } from 'vitest';
import { createMockSupabaseAuth, createMockRouter } from '../mocks';

describe('mock helpers', () => {
  it('createMockSupabaseAuth returns all auth methods as mock fns', () => {
    const auth = createMockSupabaseAuth();
    expect(auth.signInWithPassword).toBeDefined();
    expect(auth.signInWithOAuth).toBeDefined();
    expect(auth.signUp).toBeDefined();
    expect(auth.signOut).toBeDefined();
    expect(auth.getSession).toBeDefined();
    expect(auth.exchangeCodeForSession).toBeDefined();
    // Verify they're actual mock fns
    auth.signOut();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('createMockRouter returns push, replace, back as mock fns', () => {
    const router = createMockRouter();
    expect(router.push).toBeDefined();
    expect(router.replace).toBeDefined();
    expect(router.back).toBeDefined();
    router.push('/test');
    expect(router.push).toHaveBeenCalledWith('/test');
  });
});
