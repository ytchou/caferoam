'use client';
import { useState, useCallback } from 'react';

interface Coords {
  latitude: number;
  longitude: number;
}

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
  requestLocation: () => Promise<Coords | null>;
}

export function useGeolocation(): GeolocationState {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(async (): Promise<Coords | null> => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return null;
    }

    setLoading(true);
    setError(null);

    return new Promise<Coords | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLatitude(coords.latitude);
          setLongitude(coords.longitude);
          setLoading(false);
          resolve(coords);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });
  }, []);

  return { latitude, longitude, error, loading, requestLocation };
}
