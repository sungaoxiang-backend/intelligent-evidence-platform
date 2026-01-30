"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Rss, RefreshCw, AlertCircle, CheckCircle2, Database, Shield, Globe, Clock, FileText, ArrowRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function WeChatRssPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [serviceStatus, setServiceStatus] = useState<"checking" | "online" | "offline">("checking")
  const [feedsCount, setFeedsCount] = useState<number | null>(null)
  
  // RSS 服务配置
  const RSS_SERVICE_URL = "https://rss.yixuninc.cn"
  const AUTH_CODE = "huifalv"

  useEffect(() => {
    checkServiceStatus()
  }, [])

  const checkServiceStatus = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      // 尝试获取 feeds 列表来验证服务状态
      const response = await fetch(`${RSS_SERVICE_URL}/feeds/all.atom`, { 
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

  const handleOpenService = () => {
    // 打开服务页面，带上 auth code
    window.open(`${RSS_SERVICE_URL}?auth=${AUTH_CODE}`, "_blank")
  }

  const handleRefresh = () => {
    setIsLoading(true)
    setServiceStatus("checking")
    checkServiceStatus()
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col pt-12 overflow-auto">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* 头部 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <Rss className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">微信RSS</h1>
              <p className="text-sm text-muted-foreground">
                更优雅的微信公众号订阅方式，基于微信读书实现公众号RSS生成
              </p>
            </div>
          </div>
        </div>

        {/* 状态提示 */}
        {serviceStatus === "offline" && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>RSS服务暂时无法连接</span>
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
          <Alert className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>RSS服务运行正常</span>
                <Badge variant="secondary" className="text-xs">已配置</Badge>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 主操作卡片 */}
        <Card className="mb-6 border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">访问RSS管理后台</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              由于浏览器安全限制，微信RSS需要在独立页面中打开以确保认证状态正常保存。
            </p>
            <Button 
              size="lg" 
              onClick={handleOpenService}
              className="px-8"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              打开RSS管理后台
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              认证码: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{AUTH_CODE}</code>
            </p>
          </CardContent>
        </Card>

        {/* 功能介绍网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <Database className="w-5 h-5 text-blue-500 mb-2" />
              <CardTitle className="text-sm">公众号订阅</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                添加微信读书账号，扫码登录后订阅任意微信公众号
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <Clock className="w-5 h-5 text-green-500 mb-2" />
              <CardTitle className="text-sm">自动更新</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                后台自动定时更新订阅内容，获取最新文章推送
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <FileText className="w-5 h-5 text-purple-500 mb-2" />
              <CardTitle className="text-sm">多格式导出</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                支持 RSS 2.0、ATOM 1.0、JSON Feed 格式订阅链接
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <Shield className="w-5 h-5 text-amber-500 mb-2" />
              <CardTitle className="text-sm">全文输出</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                支持全文内容输出，让阅读无障碍，一键导出OPML
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">快速开始</CardTitle>
            <CardDescription>三步开始使用微信RSS订阅</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">1</span>
                </div>
                <div>
                  <h4 className="font-medium text-sm">添加账号</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    点击"打开RSS管理后台"，使用认证码 <code className="bg-muted px-1 rounded">{AUTH_CODE}</code> 登录。
                    进入账号管理，扫码登录微信读书账号（不要勾选24小时后自动退出）。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">2</span>
                </div>
                <div>
                  <h4 className="font-medium text-sm">订阅公众号</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    进入公众号源页面，点击添加，通过提交微信公众号分享链接来订阅。
                    注意：添加频率过高容易被封控，等24小时解封。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">3</span>
                </div>
                <div>
                  <h4 className="font-medium text-sm">获取RSS链接</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    订阅成功后，每个公众号都会生成对应的RSS/ATOM链接，
                    可以在任何RSS阅读器中订阅使用。
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
