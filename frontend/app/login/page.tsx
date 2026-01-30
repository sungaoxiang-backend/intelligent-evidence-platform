"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginPage as LoginComponent } from "@/components/login-page";
import { authService } from "@/lib/auth";

export default function LoginRoute() {
  const router = useRouter();

  // 如果用户已登录，自动跳转到工作台
  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = authService.isAuthenticated();
      if (isAuthenticated) {
        const userInfo = await authService.getCurrentUser();
        if (userInfo.success && userInfo.user) {
          router.push("/");
        }
      }
    };
    checkAuth();
  }, [router]);

  const handleLoginSuccess = () => {
    // 登录成功后跳转到工作台首页
    window.location.href = "/";
  };

  return <LoginComponent onLoginSuccess={handleLoginSuccess} />;
}
