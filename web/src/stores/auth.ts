import { create } from 'zustand';

export type UserProfile = {
  id: string;
  telegram_id: number;
  username: string | null;
  full_name: string | null;
  role: 'client' | 'master';
  is_npd: boolean;
  avatar_url: string | null;
  phone: string | null;
  is_master: boolean;
  current_role: 'customer' | 'master';
  master_status: 'none' | 'pending' | 'approved' | 'rejected' | 'blocked';
  description: string | null;
  avg_rating: number | null;
  review_count: number;
};

type AuthState = {
  profile: UserProfile | null;
  jwt: string | null;
  isAuthed: boolean;
  isAuthenticating: boolean;
  setProfile: (p: UserProfile, jwt?: string) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  jwt: null,
  isAuthed: false,
  isAuthenticating: true,
  setProfile: (p, jwt) => set((state) => ({ profile: p, jwt: jwt ?? state.jwt, isAuthed: true, isAuthenticating: false })),
  clear: () => set({ profile: null, jwt: null, isAuthed: false, isAuthenticating: false }),
}));
