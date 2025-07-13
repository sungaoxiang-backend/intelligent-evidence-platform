'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { checkAuthStatus, logout } = useAuthStore();

  useEffect(() => {
    // 页面加载时检查认证状态
    const verifyAuth = async () => {
      const isValid = await checkAuthStatus();
      if (!isValid) {
        logout();
      }
    };

    verifyAuth();
  }, []);

  return <>{children}</>;
}