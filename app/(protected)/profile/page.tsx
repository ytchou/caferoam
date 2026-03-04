'use client';

import { useUserStamps } from '@/lib/hooks/use-user-stamps';
import { StampPassport } from '@/components/stamps/stamp-passport';

export default function ProfilePage() {
  const { stamps, isLoading } = useUserStamps();

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Profile</h1>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        </div>
      ) : (
        <StampPassport stamps={stamps} />
      )}
    </main>
  );
}
