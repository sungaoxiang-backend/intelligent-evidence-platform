"use client"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // 只设置 defaultTheme="dark"，不要依赖 useTheme 的 theme 状态做切换按钮（按钮已在其它组件实现）
  return (
    <NextThemesProvider defaultTheme="light" attribute="class" {...props}>
      {children}
    </NextThemesProvider>
  )
}
