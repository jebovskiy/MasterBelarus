import { create } from 'zustand';

export type UserProfile = {
  id: string;
  telegram_id: number;
  username: string | null;
  full_name: string | null;
  role: 'client' | 'master';
  is_npd: boolean;
  avatar_url: string | null;
  avg_rating: number | null;
  review_count: number;
};

type AuthState = {
  profile: UserProfile | null;
  isAuthed: boolean;
  isAuthenticating: boolean;
  setProfile: (p: UserProfile) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  isAuthed: false,
  isAuthenticating: true,
  setProfile: (p) => set({ profile: p, isAuthed: true, isAuthenticating: false }),
  clear: () => set({ profile: null, isAuthed: false, isAuthenticating: false }),
}));
