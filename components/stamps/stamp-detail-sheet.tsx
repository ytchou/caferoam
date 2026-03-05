'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface StampDetailSheetProps {
  stamp: {
    id: string;
    shop_id: string;
    shop_name: string | null;
    design_url: string;
    earned_at: string;
  };
  onClose: () => void;
}

export function StampDetailSheet({ stamp, onClose }: StampDetailSheetProps) {
  const earnedDate = formatDate(stamp.earned_at);
  const shopName = stamp.shop_name ?? 'Unknown Shop';

  return (
    <Drawer open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        <DrawerHeader className="flex flex-col items-center gap-3 pb-6">
          <Image
            src={stamp.design_url}
            alt={`${shopName} stamp`}
            width={96}
            height={96}
          />
          <DrawerTitle>{shopName}</DrawerTitle>
          <p className="text-muted-foreground text-sm">Earned {earnedDate}</p>
          <Link href={`/shop/${stamp.shop_id}`}>
            <Button variant="outline" size="sm">
              Visit Again →
            </Button>
          </Link>
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  );
}
