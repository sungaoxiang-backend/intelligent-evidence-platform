"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, FileText } from "lucide-react"
import { TemplateSelector } from "@/components/lex-docx/TemplateSelector"
import { DynamicForm } from "@/components/lex-docx/DynamicForm"
import { GenerateHistory } from "@/components/lex-docx/GenerateHistory"
import { type DocumentTemplate, type PlaceholderMetadata } from "@/lib/api/lex-docx"
import { lexDocxApi } from "@/lib/api/lex-docx"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Step = "select" | "fill" | "result"

export default function GeneratePage() {
  const router = useRouter()
  const { toast } = useToast()

  // 步骤管理
  const [currentStep, setCurrentStep] = useState<Step>("select")
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedDocumentUrl, setGeneratedDocumentUrl] = useState<string | null>(null)
  const [generatedDocumentFilename, setGeneratedDocumentFilename] = useState<string | null>(null)

  // 处理模板选择
  const handleTemplateSelect = (template: DocumentTemplate) => {
    setSelectedTemplate(template)
    setCurrentStep("fill")
  }

  // 处理表单提交和文档生成
  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (!selectedTemplate) {
      toast({
        title: "错误",
        description: "请先选择模板",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const result = await lexDocxApi.generateDocument({
        template_id: selectedTemplate.id,
        form_data: formData,
      })

      setGeneratedDocumentUrl(result.document_url)
      setGeneratedDocumentFilename(result.document_filename)
      setCurrentStep("result")

      toast({
        title: "生成成功",
        description: "文档已生成",
      })
    } catch (error) {
      toast({
        title: "生成失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // 处理下载
  const handleDownload = () => {
    if (generatedDocumentUrl && generatedDocumentFilename) {
      const link = document.createElement("a")
      link.href = generatedDocumentUrl
      link.download = generatedDocumentFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "下载成功",
        description: "文档已开始下载",
      })
    }
  }

  // 处理重新生成
  const handleRegenerate = () => {
    setCurrentStep("fill")
    setGeneratedDocumentUrl(null)
    setGeneratedDocumentFilename(null)
  }

  // 处理返回
  const handleBack = () => {
    if (currentStep === "fill") {
      setCurrentStep("select")
      setSelectedTemplate(null)
    } else if (currentStep === "result") {
      setCurrentStep("fill")
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">文书生成</h1>
            <p className="text-muted-foreground mt-1">
              选择模板并填写表单，生成文档
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/lex-docx")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回模板管理
          </Button>
        </div>
      </div>

      {/* 步骤指示器 */}
      <div className="mb-6">
        <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
          {/* 步骤 1: 选择模板 */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-semibold",
                currentStep === "select"
                  ? "bg-primary text-primary-foreground"
                  : currentStep === "fill" || currentStep === "result"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {currentStep === "select" ? "1" : <CheckCircle2 className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                currentStep === "select" || currentStep === "fill" || currentStep === "result"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              选择模板
            </span>
          </div>

          <div className="w-8 sm:w-16 h-px bg-border" />

          {/* 步骤 2: 填写表单 */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-semibold",
                currentStep === "fill"
                  ? "bg-primary text-primary-foreground"
                  : currentStep === "result"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {currentStep === "result" ? <CheckCircle2 className="h-4 w-4" /> : "2"}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                currentStep === "fill" || currentStep === "result"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              填写表单
            </span>
          </div>

          <div className="w-8 sm:w-16 h-px bg-border" />

          {/* 步骤 3: 生成结果 */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-semibold",
                currentStep === "result"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              3
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                currentStep === "result"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              生成结果
            </span>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主内容区 */}
        <div className="lg:col-span-2">
          {currentStep === "select" && (
            <Card>
              <CardHeader>
                <CardTitle>选择模板</CardTitle>
                <CardDescription>
                  从已发布的模板中选择一个模板用于生成文档
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[600px]">
                  <TemplateSelector
                    onTemplateSelect={handleTemplateSelect}
                    selectedTemplateId={selectedTemplate?.id}
                    showPreview={false}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === "fill" && selectedTemplate && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>填写表单</CardTitle>
                    <CardDescription>
                      模板: {selectedTemplate.name}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    返回选择模板
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {selectedTemplate.placeholder_metadata &&
                Object.keys(selectedTemplate.placeholder_metadata).length > 0 ? (
                  <DynamicForm
                    placeholderMetadata={selectedTemplate.placeholder_metadata}
                    onSubmit={handleFormSubmit}
                    templateId={selectedTemplate.id}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>该模板没有占位符，无需填写表单</p>
                    <Button
                      className="mt-4"
                      onClick={() => handleFormSubmit({})}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        "生成文档"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === "result" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>生成成功</CardTitle>
                    <CardDescription>
                      文档已成功生成，可以下载或重新生成
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    返回表单
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <h3 className="text-xl font-semibold mb-2">文档生成成功</h3>
                  <p className="text-muted-foreground mb-6">
                    {generatedDocumentFilename}
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <Button onClick={handleDownload} size="lg">
                      <FileText className="h-4 w-4 mr-2" />
                      下载文档
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRegenerate}
                      size="lg"
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      重新生成
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 侧边栏：生成历史 */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>生成历史</CardTitle>
              <CardDescription>
                查看最近的生成记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[600px]">
                <GenerateHistory
                  templateId={selectedTemplate?.id}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

