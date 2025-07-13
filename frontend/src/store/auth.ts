import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Staff } from '@/types';
import { apiClient } from '@/lib/api';

interface AuthState {
  user: Staff | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: Staff) => void;
  getCurrentUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      login: async (username: string, password: string) => {
        try {
          const response = await apiClient.login({ username, password });
          
          // 设置 cookie 以便中间件可以读取
          document.cookie = `access_token=${response.access_token}; path=/; max-age=86400`;
          
          // 获取当前用户信息
          await get().getCurrentUser();
        } catch (error) {
          throw error;
        }
      },
      logout: () => {
        apiClient.clearToken();
        // 清除 cookie
        document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
        set({ user: null, isAuthenticated: false });
      },
      setUser: (user: Staff) => {
        set({ user, isAuthenticated: true });
      },
      getCurrentUser: async () => {
        try {
          const user = await apiClient.getCurrentUser();
          set({ user, isAuthenticated: true });
        } catch (error) {
          // 如果获取用户信息失败，清除认证状态
          set({ user: null, isAuthenticated: false });
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);