import type { ReactNode } from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { RootApp } from "@/components/root-app"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <title>汇法律 智能证物平台</title>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body className={inter.className}>
        <RootApp>{children}</RootApp>
      </body>
    </html>
  )
}

