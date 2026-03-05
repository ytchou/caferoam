'use client';

import { useState, useEffect, useRef } from 'react';
import { useUserStamps } from '@/lib/hooks/use-user-stamps';
import { useUserProfile } from '@/lib/hooks/use-user-profile';
import { useUserCheckins } from '@/lib/hooks/use-user-checkins';
import { useListSummaries } from '@/lib/hooks/use-list-summaries';
import { useAnalytics } from '@/lib/posthog/use-analytics';
import { StampPassport } from '@/components/stamps/stamp-passport';
import { StampDetailSheet } from '@/components/stamps/stamp-detail-sheet';
import { ProfileHeader } from '@/components/profile/profile-header';
import { CheckinHistoryTab } from '@/components/profile/checkin-history-tab';
import { ListsTab } from '@/components/profile/lists-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { StampData } from '@/lib/hooks/use-user-stamps';

export default function ProfilePage() {
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { stamps, isLoading: stampsLoading } = useUserStamps();
  const { checkins, isLoading: checkinsLoading } = useUserCheckins();
  const { lists, isLoading: listsLoading } = useListSummaries();
  const [selectedStamp, setSelectedStamp] = useState<StampData | null>(null);
  const { capture } = useAnalytics();
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!stampsLoading && !hasFiredRef.current) {
      hasFiredRef.current = true;
      capture('profile_stamps_viewed', { stamp_count: stamps.length });
    }
  }, [stampsLoading, stamps.length, capture]);

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      {profileLoading ? (
        <div className="flex justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        </div>
      ) : (
        <ProfileHeader
          displayName={profile?.display_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          stampCount={profile?.stamp_count ?? 0}
          checkinCount={profile?.checkin_count ?? 0}
        />
      )}

      <section className="mb-6">
        {stampsLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          </div>
        ) : (
          <StampPassport
            stamps={stamps}
            onStampClick={(stamp) => setSelectedStamp(stamp)}
          />
        )}
      </section>

      <Tabs defaultValue="checkins">
        <TabsList className="w-full">
          <TabsTrigger value="checkins" className="flex-1">
            Check-ins
          </TabsTrigger>
          <TabsTrigger value="lists" className="flex-1">
            Lists
          </TabsTrigger>
        </TabsList>
        <TabsContent value="checkins">
          <CheckinHistoryTab checkins={checkins} isLoading={checkinsLoading} />
        </TabsContent>
        <TabsContent value="lists">
          <ListsTab lists={lists} isLoading={listsLoading} />
        </TabsContent>
      </Tabs>

      {selectedStamp && (
        <StampDetailSheet
          stamp={selectedStamp}
          onClose={() => setSelectedStamp(null)}
        />
      )}
    </main>
  );
}
