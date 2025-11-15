"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, FileText } from "lucide-react"
import { GenerateHistory } from "@/components/lex-docx/GenerateHistory"

export default function GenerateHistoryPage() {
  const router = useRouter()

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">生成记录</h1>
            <p className="text-muted-foreground mt-1">
              查看所有文档生成记录
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/lex-docx/generate")}
            >
              <FileText className="h-4 w-4 mr-2" />
              生成文档
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/lex-docx")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回模板管理
            </Button>
          </div>
        </div>
      </div>

      {/* 生成记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>所有生成记录</CardTitle>
          <CardDescription>
            查看、筛选和下载已生成的文档
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[calc(100vh-20rem)]">
            <GenerateHistory />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

