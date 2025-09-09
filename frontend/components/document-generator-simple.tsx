"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Loader2, CheckCircle, FileDown, X } from "lucide-react"
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

interface DocumentGeneratorSimpleProps {
  caseId: number
  onClose: () => void
}

export function DocumentGeneratorSimple({ caseId, onClose }: DocumentGeneratorSimpleProps) {
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([])
  const [generating, setGenerating] = useState(true)
  const [downloading, setDownloading] = useState<string>("")
  const [hoveredDoc, setHoveredDoc] = useState<string>("")
  const { toast } = useToast()

  // 组件加载时立即生成所有文书
  useEffect(() => {
    generateAllDocuments()
  }, [])

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
        description: `${getCleanTemplateName(doc.template_name)} 已下载`
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: `${getCleanTemplateName(doc.template_name)} 下载失败`,
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
      
      // 使用ZIP下载API
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

  // 清理模板名称，去掉"模板"后缀
  const getCleanTemplateName = (templateName: string): string => {
    return templateName.replace(/模板$/, '').trim()
  }

  // 获取文档类型显示名称
  const getDocumentTypeDisplay = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      '起诉': '起诉类',
      '答辩': '答辩类',
      '证据': '证据类',
      '代理': '代理类',
      '申请': '申请类',
      '其他': '其他类'
    }
    return typeMap[type] || type
  }

  return (
    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto my-8 max-h-[80vh] flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">文书生成完成</h2>
            <p className="text-sm text-gray-600">案件 {caseId} 的所有文书已生成</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {generating ? (
          /* 生成中状态 */
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
              <div className="absolute inset-0 w-12 h-12 border-2 border-blue-200 rounded-full animate-pulse"></div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mt-6 mb-2">正在生成文书...</h3>
            <p className="text-sm text-gray-600 text-center max-w-md">
              系统正在根据案件信息自动生成所有相关的法律文书，请稍候...
            </p>
          </div>
        ) : (
          <>
            {/* 生成成功提示 */}
            {generatedDocuments.length > 0 && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      成功生成 {generatedDocuments.length} 个文书
                    </p>
                    <p className="text-xs text-green-600">
                      点击下方文书名称即可下载，或使用底部的一键下载全部
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 文书列表 */}
            <div className="space-y-3">
              {generatedDocuments.map((document) => (
                <Card
                  key={document.template_id}
                  className="border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-sm group"
                  onMouseEnter={() => setHoveredDoc(document.template_id)}
                  onMouseLeave={() => setHoveredDoc("")}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-medium text-gray-900 truncate">
                            {getCleanTemplateName(document.template_name)}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {getDocumentTypeDisplay(document.template_type)}
                            </Badge>
                            <span className="text-xs text-gray-500 truncate">
                              {document.filename}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* 悬停时显示的下载按钮 */}
                        <div className={`transition-all duration-200 ${
                          hoveredDoc === document.template_id || downloading === document.template_id
                            ? 'opacity-100 translate-x-0'
                            : 'opacity-0 translate-x-2'
                        }`}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadDocument(document)
                            }}
                            disabled={downloading === document.template_id}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            {downloading === document.template_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        
                        {/* 始终显示的成功状态 */}
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {generatedDocuments.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">暂无生成的文书</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="border-t p-6 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {generatedDocuments.length > 0 && (
              <span>共 {generatedDocuments.length} 个文书</span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={downloading === 'all'}
            >
              关闭
            </Button>
            
            {generatedDocuments.length > 0 && (
              <Button
                onClick={downloadAllDocuments}
                disabled={downloading === 'all'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {downloading === 'all' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    准备压缩包...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4 mr-2" />
                    一键下载全部
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}