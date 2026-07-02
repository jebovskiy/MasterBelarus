import { retrieveLaunchParams, init as initTma } from '@telegram-apps/sdk';

let initialized = false;

export function initTelegramSDK(): void {
  if (initialized) return;

  try {
    initTma();
    initialized = true;
  } catch {
    // Running outside Telegram (dev mode) — safe to ignore
  }
}

export function getTelegramInitData(): string {
  try {
    const lp = retrieveLaunchParams();
    return (lp as unknown as { initDataRaw?: string }).initDataRaw ?? '';
  } catch {
    return '';
  }
}

export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: Record<string, unknown>;
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: { show: () => void; hide: () => void; setText: (t: string) => void; onClick: (fn: () => void) => void };
        BackButton: { show: () => void; hide: () => void; onClick: (fn: () => void) => void };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        };
        LocationManager?: {
          init: (callback?: () => void) => void;
          getLocation: (callback: (location: { latitude: number; longitude: number } | null) => void) => void;
          openSettings: () => void;
        };
        locationManager?: {
          init: (callback?: () => void) => void;
          getLocation: (callback: (location: { latitude: number; longitude: number } | null) => void) => void;
          openSettings: () => void;
        };
        showPopup: (params: { title?: string; message: string; buttons?: Array<{ type: string; text?: string; id?: string }> }) => void;
        showAlert: (message: string, callback?: () => void) => void;
      };
    };
  }
}
