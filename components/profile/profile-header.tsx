import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ProfileHeaderProps {
  displayName: string | null;
  avatarUrl: string | null;
  stampCount: number;
  checkinCount: number;
}

export function ProfileHeader({
  displayName,
  avatarUrl,
  stampCount,
  checkinCount,
}: ProfileHeaderProps) {
  const name = displayName || 'User';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-4 pb-6">
      <Avatar className="h-16 w-16">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="aspect-square size-full object-cover"
          />
        ) : (
          <AvatarFallback className="text-lg font-medium">{initial}</AvatarFallback>
        )}
      </Avatar>
      <div className="flex-1">
        <h1 className="text-xl font-bold">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {stampCount} stamps &middot; {checkinCount} check-ins
        </p>
        <Link
          href="/settings"
          className="text-sm text-primary hover:underline"
        >
          Edit Profile &rarr;
        </Link>
      </div>
    </div>
  );
}
