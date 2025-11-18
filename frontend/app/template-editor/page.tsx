"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, Save, Download, Loader2, X } from "lucide-react"
import { DocumentEditor } from "@/components/template-editor/document-editor"
import { FileUploadZone } from "@/components/template-editor/file-upload-zone"
import { API_CONFIG } from "@/lib/config"

// 暂时禁用复杂的验证函数，使用简单的内容处理
// function validateAndCleanProseMirrorContent(content: any): any { ... }

export default function TemplateEditorPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [prosemirrorJson, setProsemirrorJson] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fileName, setFileName] = useState<string>("")
  const { toast } = useToast()

  // 获取认证头
  const getAuthHeader = (): Record<string, string> => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""
      return token ? { Authorization: `Bearer ${token}` } : {}
    }
    return {}
  }

  // 处理文件上传
  const handleFileUpload = useCallback(async (file: File) => {
    // 验证文件类型
    if (!file.name.endsWith(".docx")) {
      toast({
        title: "文件格式错误",
        description: "请上传 .docx 格式的文件",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setUploadedFile(file)
    setFileName(file.name)

    try {
      // 创建 FormData
      const formData = new FormData()
      formData.append("file", file)

      // 调用后端 API 解析 docx
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/template-editor/parse`,
        {
          method: "POST",
          headers: getAuthHeader(),
          body: formData,
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "解析失败")
      }

      const result = await response.json()

      if (result.code === 200) {
        // 设置 ProseMirror JSON
        console.log("收到后端数据:", result.data)
        setProsemirrorJson(result.data)

        toast({
          title: "上传成功",
          description: "文档已加载到编辑器",
        })
      } else {
        throw new Error(result.message || "解析失败")
      }
    } catch (error: any) {
      console.error("文件解析失败:", error)
      toast({
        title: "解析失败",
        description: error.message || "无法解析文档，请检查文件格式",
        variant: "destructive",
      })
      setUploadedFile(null)
      setFileName("")
      setProsemirrorJson(null)
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // 处理内容更新
  const handleContentChange = useCallback((json: any) => {
    setProsemirrorJson(json)
  }, [])

  // 清除当前文档
  const handleClear = useCallback(() => {
    setUploadedFile(null)
    setFileName("")
    setProsemirrorJson(null)
    toast({
      title: "已清除",
      description: "文档已清除",
    })
  }, [toast])

  // 导出为 DOCX
  const handleExportDocx = useCallback(async () => {
    if (!prosemirrorJson) {
      toast({
        title: "无内容",
        description: "编辑器中没有内容可导出",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // 调用后端 API 导出 docx
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/template-editor/export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            prosemirror_json: prosemirrorJson,
            filename: fileName.replace(".docx", "_edited.docx") || "document.docx",
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || "导出失败")
      }

      // 获取文件 blob
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download =
        fileName.replace(".docx", "_edited.docx") || "document.docx"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "导出成功",
        description: "文档已导出为 DOCX",
      })
    } catch (error: any) {
      console.error("导出失败:", error)
      toast({
        title: "导出失败",
        description: error.message || "无法导出文档",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [prosemirrorJson, fileName, toast])

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">文书模板编辑器</h1>
        </div>
        <div className="flex items-center gap-2">
          {uploadedFile && (
            <>
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={isLoading}
              >
                <X className="mr-2 h-4 w-4" />
                清除
              </Button>
              <Button
                variant="outline"
                onClick={handleExportDocx}
                disabled={isLoading || !prosemirrorJson}
              >
                <Download className="mr-2 h-4 w-4" />
                导出为 DOCX
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* 文件上传区域 */}
        {!uploadedFile && (
          <Card>
            <CardHeader>
              <CardTitle>上传文档</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                onFileSelect={handleFileUpload}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        )}

        {/* 编辑器区域 */}
        {uploadedFile && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {fileName}
                </CardTitle>
                {isLoading && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <DocumentEditor
                initialContent={prosemirrorJson}
                onChange={handleContentChange}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

