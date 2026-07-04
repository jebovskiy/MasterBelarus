import { useEffect, useRef, useCallback } from 'react';
import { apiPost } from '@/lib/api';
import { initTelegramSDK } from '@/lib/telegram';
import { useAuthStore, type UserProfile } from '@/stores/auth';

type LoginResponse = {
  profile: UserProfile;
  jwt: string;
  publicWebUrl: string;
};

export function useTelegramAuth() {
  const { isAuthed, isAuthenticating, setProfile, clear } = useAuthStore();
  const attempted = useRef(false);

  const authenticate = useCallback(async () => {
    if (attempted.current) return;
    attempted.current = true;

    initTelegramSDK();

    try {
      const result = await apiPost<LoginResponse>('/auth/telegram');

      if ('error' in result) {
        clear();
        console.warn('[auth] failed:', result.error);
        return;
      }

      setProfile(result.data.profile, result.data.jwt);
    } catch (err) {
      console.warn('[auth] network error:', err);
      clear();
    }
  }, [setProfile, clear]);

  useEffect(() => {
    void authenticate();
  }, [authenticate]);

  return { isAuthed, isAuthenticating, profile: useAuthStore((s) => s.profile) };
}
