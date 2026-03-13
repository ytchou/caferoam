'use client';
import dynamic from 'next/dynamic';
import { useIsDesktop } from '@/lib/hooks/use-media-query';

const InteractiveMap = dynamic(
  () => import('react-map-gl/mapbox').then((m) => ({ default: m.default })),
  { ssr: false }
);
const MapMarker = dynamic(
  () => import('react-map-gl/mapbox').then((m) => ({ default: m.Marker })),
  { ssr: false }
);

interface ShopMapThumbnailProps {
  latitude: number;
  longitude: number;
  shopName: string;
}

export function ShopMapThumbnail({ latitude, longitude, shopName }: ShopMapThumbnailProps) {
  const isDesktop = useIsDesktop();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (isDesktop) {
    return (
      <div className="h-[200px] overflow-hidden rounded-xl">
        <InteractiveMap
          mapboxAccessToken={token}
          initialViewState={{ longitude, latitude, zoom: 15 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          interactive={false}
        >
          <MapMarker longitude={longitude} latitude={latitude}>
            <div className="h-4 w-4 rounded-full border-2 border-white bg-[#E06B3F] shadow" />
          </MapMarker>
        </InteractiveMap>
      </div>
    );
  }

  const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+E06B3F(${longitude},${latitude})/${longitude},${latitude},15,0/400x200@2x?access_token=${token}`;

  return (
    <div className="px-4 py-2">
      <img
        src={staticUrl}
        alt={`Map showing ${shopName}`}
        className="w-full rounded-xl"
        loading="lazy"
      />
    </div>
  );
}
