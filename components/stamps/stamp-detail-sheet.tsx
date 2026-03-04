'use client';

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
    shop_name: string;
    design_url: string;
    earned_at: string;
  };
  onClose: () => void;
}

export function StampDetailSheet({ stamp, onClose }: StampDetailSheetProps) {
  const earnedDate = formatDate(stamp.earned_at);

  return (
    <Drawer open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        <DrawerHeader className="flex flex-col items-center gap-3 pb-6">
          <img
            src={stamp.design_url}
            alt={`${stamp.shop_name} stamp`}
            className="h-24 w-24"
          />
          <DrawerTitle>{stamp.shop_name}</DrawerTitle>
          <p className="text-sm text-muted-foreground">Earned {earnedDate}</p>
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
