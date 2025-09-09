"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Loader2, Eye, CheckCircle, XCircle } from "lucide-react"
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

interface GeneratedDocument {
  template_id: string
  template_name: string
  template_type: string
  file_path: string
  filename: string
  success: boolean
}

interface DocumentGeneratorProps {
  caseId: number
  onClose: () => void
}

export function DocumentGeneratorNew({ caseId, onClose }: DocumentGeneratorProps) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState<string>("")
  const [previewMode, setPreviewMode] = useState(false)
  const { toast } = useToast()

  // 获取模板列表
  useEffect(() => {
    fetchTemplates()
  }, [])

  // 当模板加载完成后，默认选择第一个模板
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].template_id)
    }
  }, [templates, selectedTemplateId])

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

  const generateAllDocuments = async () => {
    try {
      setGenerating(true)
      
      // 调用 generate-all-by-case API
      const result = await documentApi.generateAllDocumentsByCase(caseId)
      
      if (result.data && result.data.successful_documents) {
        setGeneratedDocuments(result.data.successful_documents)
        
        if (result.data.failed_documents && result.data.failed_documents.length > 0) {
          toast({
            title: "部分文书生成失败",
            description: `${result.data.success_count} 个成功，${result.data.failure_count} 个失败`,
            variant: "destructive"
          })
        } else {
          toast({
            title: "文书生成成功",
            description: `成功生成 ${result.data.success_count} 个文书`
          })
        }
      }
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

  const downloadDocument = async (doc: GeneratedDocument) => {
    try {
      setDownloading(doc.template_id)
      
      const blob = await documentApi.downloadDocument(doc.filename)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "下载成功",
        description: `${doc.template_name} 已下载`
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: `${doc.template_name} 下载失败`,
        variant: "destructive"
      })
    } finally {
      setDownloading("")
    }
  }

  const downloadAllDocuments = async () => {
    if (generatedDocuments.length === 0) {
      toast({
        title: "没有可下载的文书",
        description: "请先生成文书",
        variant: "destructive"
      })
      return
    }

    for (const document of generatedDocuments) {
      await downloadDocument(document)
    }
  }

  const getSelectedTemplate = () => {
    return templates.find(t => t.template_id === selectedTemplateId)
  }

  const getDocumentPreviewUrl = (document: GeneratedDocument) => {
    // For now, we'll use a placeholder. In a real implementation, 
    // you would need to implement a preview endpoint that converts 
    // the Word document to a viewable format (like PDF or HTML)
    return null
  }

  const getGeneratedDocumentForTemplate = (templateId: string) => {
    return generatedDocuments.find(d => d.template_id === templateId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <div className="text-muted-foreground">加载模板中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <h2 className="text-lg font-semibold">文书生成</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="w-4 h-4 mr-1" />
            {previewMode ? "列表模式" : "预览模式"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            关闭
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧模板列表 */}
        <div className="w-80 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">文书模板</h3>
              <Badge variant="secondary">{templates.length}</Badge>
            </div>
            
            <div className="space-y-2">
              {templates.map((template) => {
                const generatedDoc = getGeneratedDocumentForTemplate(template.template_id)
                const isSelected = selectedTemplateId === template.template_id
                
                return (
                  <div
                    key={template.template_id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                    onClick={() => setSelectedTemplateId(template.template_id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {template.name}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {template.description}
                        </p>
                        {generatedDoc && (
                          <div className="flex items-center mt-2">
                            <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                            <span className="text-xs text-green-600">已生成</span>
                          </div>
                        )}
                      </div>
                      {generatedDoc && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadDocument(generatedDoc)
                          }}
                          disabled={downloading === template.template_id}
                        >
                          {downloading === template.template_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 右侧预览区域 */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedTemplateId && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                {(() => {
                  const template = getSelectedTemplate()
                  const generatedDoc = template ? getGeneratedDocumentForTemplate(template.template_id) : null
                  
                  if (!template) return null
                  
                  return (
                    <div className="space-y-6">
                      {/* 模板信息 */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span>{template.name}</span>
                            <Badge variant="outline">{template.type}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-600 mb-4">
                            {template.description}
                          </p>
                          
                          {generatedDoc ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center mb-2">
                                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                                <span className="text-sm font-medium text-green-800">
                                  文书已生成
                                </span>
                              </div>
                              <div className="text-sm text-green-700">
                                <p>文件名: {generatedDoc.filename}</p>
                                <p>模板类型: {generatedDoc.template_type}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <div className="flex items-center">
                                <FileText className="w-4 h-4 text-yellow-600 mr-2" />
                                <span className="text-sm text-yellow-800">
                                  该模板尚未生成文书
                                </span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* 预览区域 */}
                      {generatedDoc ? (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <span>文档预览</span>
                              <Badge variant="secondary">预览</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-sm text-gray-600 mb-2">
                                文档预览功能开发中
                              </p>
                              <p className="text-xs text-gray-500">
                                请下载文档后查看完整内容
                              </p>
                              <div className="mt-4">
                                <Button
                                  size="sm"
                                  onClick={() => downloadDocument(generatedDoc)}
                                  disabled={downloading === generatedDoc.template_id}
                                >
                                  {downloading === generatedDoc.template_id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      下载中...
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3 h-3 mr-1" />
                                      下载查看
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card>
                          <CardHeader>
                            <CardTitle>模板信息</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">模板描述</h4>
                                <p className="text-sm text-gray-600">{template.description}</p>
                              </div>
                              
                              {template.variables && template.variables.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">模板变量</h4>
                                  <div className="space-y-2">
                                    {template.variables.map((variable: any, index: number) => (
                                      <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                                        <span className="text-sm font-medium">{variable.name}</span>
                                        <Badge variant="secondary" className="text-xs">
                                          {variable.type}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* 底部操作栏 */}
          <div className="border-t p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {generatedDocuments.length > 0 && (
                  <span>已生成 {generatedDocuments.length} 个文书</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={generateAllDocuments}
                  disabled={generating || templates.length === 0}
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      生成全部文书
                    </>
                  )}
                </Button>
                {generatedDocuments.length > 0 && (
                  <Button
                    onClick={downloadAllDocuments}
                    disabled={generating}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    一键下载全部
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}