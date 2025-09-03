"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Loader2 } from "lucide-react"
import { documentApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface DocumentTemplate {
  template_id: string
  name: string
  type: string
  description: string
  file_path: string
  variables: any[]
}

interface DocumentTemplateSelectorProps {
  caseId: number
  isOpen: boolean
  onClose: () => void
}

export function DocumentTemplateSelector({ caseId, isOpen, onClose }: DocumentTemplateSelectorProps) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const { toast } = useToast()

  // 获取模板列表
  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
    }
  }, [isOpen])

  // 当模板加载完成后，默认选择第一个模板
  useEffect(() => {
    if (templates.length > 0 && selectedTemplates.length === 0) {
      setSelectedTemplates([templates[0].template_id])
    }
  }, [templates])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const result = await documentApi.getTemplates()
      setTemplates(result.data)
    } catch (error: any) {
      toast({
        title: "获取模板失败",
        description: error.message || "请稍后重试",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    )
  }

  const handleGenerate = async () => {
    if (selectedTemplates.length === 0) {
      toast({
        title: "请选择模板",
        description: "请至少选择一个文书模板",
        variant: "destructive"
      })
      return
    }

    try {
      setGenerating(true)
      
      // 生成所有选中的模板
      const promises = selectedTemplates.map(async (templateId) => {
        const result = await documentApi.generateDocument(templateId, caseId)
        return {
          templateId,
          filename: result.data.filename,
          filePath: result.data.file_path
        }
      })

      const results = await Promise.all(promises)
      
      // 下载所有生成的文档
      for (const result of results) {
        try {
          const blob = await documentApi.downloadDocument(result.filename)
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = result.filename
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        } catch (error) {
          console.error(`下载 ${result.filename} 失败:`, error)
        }
      }

      toast({
        title: "文书生成成功",
        description: `已生成并下载 ${results.length} 个文书文档`
      })

      onClose()
    } catch (error: any) {
      toast({
        title: "生成文书失败",
        description: error.message || "请稍后重试",
        variant: "destructive"
      })
    } finally {
      setGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            选择文书模板
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>加载模板中...</span>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  请选择要生成的文书模板，系统将自动填充案件信息并生成对应的Word文档。
                </p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {templates.map((template) => (
                  <div
                    key={template.template_id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedTemplates.includes(template.template_id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleTemplateToggle(template.template_id)}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedTemplates.includes(template.template_id)}
                        onChange={() => handleTemplateToggle(template.template_id)}
                      />
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">
                          {template.name}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {templates.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无可用模板</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  已选择 {selectedTemplates.length} 个模板
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={generating}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={selectedTemplates.length === 0 || generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        生成并下载
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
