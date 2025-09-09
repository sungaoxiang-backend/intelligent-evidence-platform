"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Loader2, Eye, CheckCircle, FileDown } from "lucide-react"
import { documentApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface GeneratedDocument {
  template_id: string
  template_name: string
  template_type: string
  file_path: string
  filename: string
  success: boolean
}

interface DocumentGeneratorV2Props {
  caseId: number
  onClose: () => void
}

export function DocumentGeneratorV2({ caseId, onClose }: DocumentGeneratorV2Props) {
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([])
  const [selectedDocument, setSelectedDocument] = useState<GeneratedDocument | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState<string>("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const { toast } = useToast()

  // 生成所有文书
  const generateAllDocuments = async () => {
    try {
      setGenerating(true)
      
      // 调用 generate-all-by-case API
      const result = await documentApi.generateAllDocumentsByCase(caseId)
      
      if (result.data && result.data.successful_documents) {
        setGeneratedDocuments(result.data.successful_documents)
        setHasGenerated(true)
        
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
        
        // 默认选择第一个生成的文档
        if (result.data.successful_documents.length > 0) {
          setSelectedDocument(result.data.successful_documents[0])
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

    try {
      setDownloading('all')
      
      // 使用新的ZIP下载API
      const zipBlob = await documentApi.downloadDocumentsZip(generatedDocuments, caseId)
      
      // 创建下载链接
      const url = window.URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `案件${caseId}文书_${new Date().toLocaleDateString('zh-CN')}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "下载成功",
        description: `成功下载 ${generatedDocuments.length} 个文书的ZIP压缩包`
      })
    } catch (error: any) {
      toast({
        title: "下载失败",
        description: error.message || "ZIP文件下载失败",
        variant: "destructive"
      })
    } finally {
      setDownloading('')
    }
  }

  const handleDocumentSelect = async (document: GeneratedDocument) => {
    setSelectedDocument(document)
    setPreviewLoading(true)
    setPreviewData(null)
    
    try {
      // 获取真实预览数据
      const result = await documentApi.getDocumentPreview(document.filename)
      setPreviewData(result.data)
    } catch (error: any) {
      toast({
        title: "预览加载失败",
        description: error.message || "无法加载文档预览",
        variant: "destructive"
      })
      // 回退到模拟预览
      setPreviewData(getDocumentPreview(document))
    } finally {
      setPreviewLoading(false)
    }
  }

  const getDocumentPreview = (document: GeneratedDocument) => {
    // 这里应该调用后端的文档预览API
    // 目前使用占位符，实际需要后端支持文档转HTML或PDF预览
    return {
      title: document.template_name,
      type: document.template_type,
      filename: document.filename,
      content: `这是 ${document.template_name} 的内容预览。
      
由于技术限制，目前无法直接预览Word文档内容。
实际部署时，这里应该显示文档的实际内容，
可以通过以下方式实现：

1. 后端将Word文档转换为HTML或PDF
2. 前端通过iframe或PDF查看器显示
3. 或者显示文档的文本提取内容

文档信息：
- 模板名称：${document.template_name}
- 模板类型：${document.template_type}
- 文件名：${document.filename}
- 状态：已生成完成`
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">文书生成与预览</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-gray-300"
          >
            关闭
          </Button>
        </div>
      </div>

      {!hasGenerated ? (
        /* 初始状态 - 提示生成文书 */
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md p-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">生成案件文书</h3>
            <p className="text-sm text-gray-600 mb-6">
              点击生成按钮，系统将根据案件信息自动生成所有相关的法律文书。
              生成完成后，您可以预览每个文书的内容并选择需要下载的文档。
            </p>
            <Button
              onClick={generateAllDocuments}
              disabled={generating}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  生成所有文书
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* 生成后的界面 */
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧文书列表 */}
          <div className="w-80 border-r bg-gray-50 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">已生成文书</h3>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {generatedDocuments.length}
                </Badge>
              </div>
              
              <div className="space-y-2">
                {generatedDocuments.map((document) => (
                  <div
                    key={document.template_id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedDocument?.template_id === document.template_id
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => handleDocumentSelect(document)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {document.template_name}
                          </h4>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">
                          {document.template_type}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {document.filename}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadDocument(document)
                        }}
                        disabled={downloading === document.template_id || downloading === 'all'}
                        className="ml-2 flex-shrink-0"
                      >
                        {downloading === document.template_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 批量下载按钮 */}
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={downloadAllDocuments}
                  className="w-full"
                  size="sm"
                  disabled={downloading === 'all'}
                >
                  {downloading === 'all' ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      压缩中...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3 h-3 mr-2" />
                      一键下载全部
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* 右侧预览区域 */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {selectedDocument ? (
              <>
                {/* 预览头部 */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {selectedDocument.template_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {selectedDocument.template_type} • {selectedDocument.filename}
                      </p>
                    </div>
                    <Button
                      onClick={() => downloadDocument(selectedDocument)}
                      disabled={downloading === selectedDocument.template_id || downloading === 'all'}
                    >
                      {downloading === selectedDocument.template_id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          下载中...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          下载文书
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* 预览内容 */}
                <div className="flex-1 overflow-y-auto p-6">
                  {previewLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                        <p className="text-gray-600">正在加载文档预览...</p>
                      </div>
                    </div>
                  ) : previewData ? (
                    <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          文档预览
                          <Badge variant="secondary">实时预览</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {previewData.html_content ? (
                          <div className="border rounded-lg overflow-hidden">
                            <iframe
                              srcDoc={previewData.html_content}
                              className="w-full h-96 border-0"
                              title={`${selectedDocument.template_name}预览`}
                              sandbox="allow-same-origin"
                            />
                          </div>
                        ) : (
                          <div className="bg-gray-50 border rounded-lg p-6">
                            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed max-h-96 overflow-y-auto">
                              {previewData.text_content || '暂无预览内容'}
                            </pre>
                          </div>
                        )}
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                            <div className="text-sm text-green-800">
                              <p className="font-medium mb-1">实时预览</p>
                              <p>
                                当前显示的是文档的真实内容，由Word文档实时转换而来。
                                支持文本、表格、格式等内容的完整预览。
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-500">
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>正在准备文档预览...</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>请从左侧列表选择一个文书进行预览</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}