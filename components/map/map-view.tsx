'use client';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Shop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface MapViewProps {
  shops: Shop[];
  onPinClick: (shopId: string) => void;
  mapStyle?: string;
}

export function MapView({
  shops,
  onPinClick,
  mapStyle = 'mapbox://styles/mapbox/streets-v12',
}: MapViewProps) {
  return (
    <Map
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ longitude: 121.5654, latitude: 25.033, zoom: 13 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
    >
      {shops.map((shop) => (
        <Marker
          key={shop.id}
          longitude={shop.longitude}
          latitude={shop.latitude}
          onClick={() => onPinClick(shop.id)}
        >
          <button
            className="h-4 w-4 rounded-full border-2 border-white bg-[#E06B3F] shadow"
            aria-label={shop.name}
          />
        </Marker>
      ))}
    </Map>
  );
}
