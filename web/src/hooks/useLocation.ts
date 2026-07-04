import { useState, useCallback, useEffect, useRef } from 'react';
import { isTelegramWebApp } from '@/lib/telegram';

export type LocationCoords = { latitude: number; longitude: number };

const MINSK_CENTER: LocationCoords = { latitude: 53.9, longitude: 27.5667 };

function getBrowserLocation(): Promise<LocationCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  });
}

function getTelegramLocation(): Promise<LocationCoords> {
  return new Promise((resolve, reject) => {
    const lm = window.Telegram?.WebApp?.LocationManager;
    if (!lm) {
      reject(new Error('No Telegram LocationManager'));
      return;
    }
    try {
      lm.init(() => {
        lm.getLocation((location: { latitude: number; longitude: number } | null) => {
          if (location && typeof location.latitude === 'number') {
            resolve({ latitude: location.latitude, longitude: location.longitude });
          } else {
            reject(new Error('Location access denied'));
          }
        });
      });
    } catch {
      reject(new Error('LocationManager error'));
    }
  });
}

const STORAGE_KEY = 'mb_last_location';

function loadCached(): LocationCoords | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocationCoords) : null;
  } catch {
    return null;
  }
}

function saveCache(loc: LocationCoords) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch { /* noop */ }
}

export function useLocation() {
  const [location, setLocation] = useState<LocationCoords>(loadCached() ?? MINSK_CENTER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const requestLocation = useCallback(async () => {
    if (requested.current) return;
    requested.current = true;
    setLoading(true);
    setError(null);

    try {
      let loc: LocationCoords;

      if (isTelegramWebApp()) {
        try {
          loc = await getTelegramLocation();
        } catch {
          loc = await getBrowserLocation();
        }
      } else {
        loc = await getBrowserLocation();
      }

      setLocation(loc);
      saveCache(loc);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Location unavailable';
      setError(msg);
      const cached = loadCached();
      if (cached) {
        setLocation(cached);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!requested.current) {
      void requestLocation();
    }
  }, [requestLocation]);

  return { location, loading, error, requestLocation, isCached: !!loadCached() };
}
