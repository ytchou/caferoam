'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/use-user-profile';
import { fetchWithAuth } from '@/lib/api/fetch';

export default function SettingsPage() {
  const router = useRouter();
  const { profile, mutate: mutateProfile } = useUserProfile();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const profileInitialized = useRef(false);

  useEffect(() => {
    if (profile && !profileInitialized.current) {
      setDisplayName(profile.display_name ?? '');
      setAvatarUrl(profile.avatar_url ?? null);
      profileInitialized.current = true;
    }
  }, [profile]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  async function handleDeleteAccount() {
    if (confirmText !== 'DELETE') return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to request account deletion');
      }

      await supabase.auth.signOut();
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      await fetchWithAuth('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName || null,
          avatar_url: avatarUrl || null,
        }),
      });
      setProfileSuccess(true);
      mutateProfile();
    } catch {
      setProfileError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    if (file.size > 1024 * 1024) {
      setProfileError('Image must be under 1MB');
      return;
    }
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${session.user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setProfileError('Failed to upload avatar');
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(publicUrl);
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-2xl font-bold">Settings (設定)</h1>

        <section className="space-y-4 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div>
            <label
              htmlFor="display-name"
              className="block text-sm font-medium mb-1"
            >
              Display name
            </label>
            <input
              id="display-name"
              type="text"
              maxLength={30}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Enter your display name"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {displayName.length}/30
            </p>
          </div>
          <div>
            <p className="block text-sm font-medium mb-2">Avatar</p>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-medium text-muted-foreground">
                    {displayName.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <label className="cursor-pointer">
                <span className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
                  Upload photo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                  }}
                />
              </label>
            </div>
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {profileError && (
            <p className="text-sm text-red-600">{profileError}</p>
          )}
          {profileSuccess && (
            <p className="text-sm text-green-600">Profile updated!</p>
          )}
        </section>

        <section className="space-y-4">
          <button
            onClick={handleLogout}
            className="w-full rounded-md bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
          >
            Logout (登出)
          </button>
        </section>

        <hr className="border-gray-200" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          <p className="text-sm text-gray-600">
            Deleting your account starts a 30-day grace period. During this
            time, you can recover your account. After 30 days, all your data
            will be permanently removed.
          </p>

          {!showDeleteDialog ? (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="w-full rounded-md border border-red-600 px-4 py-2 text-red-600 hover:bg-red-50"
            >
              Delete Account (刪除帳號)
            </button>
          ) : (
            <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                Type <strong>DELETE</strong> to confirm account deletion:
              </p>
              <label htmlFor="confirm-delete" className="sr-only">
                Type DELETE to confirm
              </label>
              <input
                id="confirm-delete"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full rounded-md border border-red-300 px-3 py-2 text-sm"
              />
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setConfirmText('');
                    setError(null);
                  }}
                  className="flex-1 rounded-md bg-gray-200 px-3 py-2 text-sm text-gray-800 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== 'DELETE' || loading}
                  className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
