"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, Rss, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function WeChatRssPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [serviceStatus, setServiceStatus] = useState<"checking" | "online" | "offline">("checking")
  const RSS_SERVICE_URL = "http://localhost:4000/dash"

  useEffect(() => {
    checkServiceStatus()
  }, [])

  const checkServiceStatus = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      await fetch("http://localhost:4000", { 
        method: "HEAD",
        signal: controller.signal,
        mode: "no-cors"
      })
      
      clearTimeout(timeoutId)
      setServiceStatus("online")
    } catch {
      setServiceStatus("offline")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenInNewTab = () => {
    window.open(RSS_SERVICE_URL, "_blank")
  }

  const handleRefresh = () => {
    setIsLoading(true)
    setServiceStatus("checking")
    checkServiceStatus()
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col pt-12">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <Rss className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">微信RSS</h1>
              <p className="text-sm text-muted-foreground">
                更优雅的微信公众号订阅方式，基于微信读书实现公众号RSS生成
              </p>
            </div>
          </div>
        </div>

        {serviceStatus === "offline" && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              本地RSS服务未启动（端口4000）。请先启动 WeWe RSS 服务。
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                重试
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {serviceStatus === "online" && (
          <Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-900/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="flex items-center justify-between">
              <span>本地RSS服务运行正常</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleOpenInNewTab}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                在新标签页打开
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="flex-1 min-h-[calc(100vh-16rem)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">RSS管理面板</CardTitle>
            <CardDescription>
              管理微信公众号订阅源，生成RSS/ATOM格式的订阅链接
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 h-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            ) : serviceStatus === "offline" ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">服务未连接</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  无法连接到本地 WeWe RSS 服务。请确保服务已启动：
                </p>
                <code className="bg-muted px-3 py-2 rounded text-sm font-mono mb-4">
                  docker run -d -p 4000:4000 cooderl/wewe-rss:latest
                </code>
                <Button onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重新检测
                </Button>
              </div>
            ) : (
              <iframe
                src={RSS_SERVICE_URL}
                className="w-full h-[calc(100vh-18rem)] border-0"
                title="WeWe RSS Dashboard"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            )}
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">功能说明</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• 添加微信读书账号（扫码登录）</li>
                <li>• 订阅微信公众号（通过分享链接）</li>
                <li>• 自动获取公众号历史文章</li>
                <li>• 定时后台更新订阅内容</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">订阅格式</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• 支持 RSS 2.0 格式</li>
                <li>• 支持 ATOM 1.0 格式</li>
                <li>• 支持 JSON Feed 格式</li>
                <li>• 支持全文内容输出</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">高级功能</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• 标题关键词过滤</li>
                <li>• OPML 批量导出</li>
                <li>• 手动触发更新</li>
                <li>• 多账号管理</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
