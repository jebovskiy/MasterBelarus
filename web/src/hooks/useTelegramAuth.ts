import { useEffect, useRef, useCallback } from 'react';
import { apiPost } from '@/lib/api';
import { initTelegramSDK } from '@/lib/telegram';
import { useAuthStore, type UserProfile } from '@/stores/auth';

export function useTelegramAuth() {
  const { isAuthed, isAuthenticating, setProfile, clear } = useAuthStore();
  const attempted = useRef(false);

  const authenticate = useCallback(async () => {
    if (attempted.current) return;
    attempted.current = true;

    initTelegramSDK();

    const result = await apiPost<{ profile: UserProfile }>('/auth/telegram');

    if ('error' in result) {
      clear();
      console.warn('[auth] failed:', result.error, result.detail);
      return;
    }

    setProfile(result.data.profile);
  }, [setProfile, clear]);

  useEffect(() => {
    void authenticate();
  }, [authenticate]);

  return { isAuthed, isAuthenticating, profile: useAuthStore((s) => s.profile) };
}
