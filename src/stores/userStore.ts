import { create } from "zustand";
import type { User as FirebaseUser } from "firebase/auth";

type UserState = {
  user: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  setAuthState: (user: FirebaseUser | null) => void;
  setAuthError: (error: string) => void;
  clearAuthError: () => void;
};

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isLoading: true,
  error: null,
  setAuthState: (user) => set({ user, isLoading: false, error: null }),
  setAuthError: (error) => set({ isLoading: false, error }),
  clearAuthError: () => set({ error: null }),
}));