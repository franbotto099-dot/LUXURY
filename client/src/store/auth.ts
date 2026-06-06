import { create } from 'zustand';

interface AuthState {
  token: string | null;
  username: string | null;
  setAuth: (token: string, username: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('luxury_token'),
  username: localStorage.getItem('luxury_user'),
  setAuth: (token, username) => {
    localStorage.setItem('luxury_token', token);
    localStorage.setItem('luxury_user', username);
    set({ token, username });
  },
  logout: () => {
    localStorage.removeItem('luxury_token');
    localStorage.removeItem('luxury_user');
    set({ token: null, username: null });
  },
}));
