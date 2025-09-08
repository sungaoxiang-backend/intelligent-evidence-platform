"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, Eye, CheckCircle, XCircle } from "lucide-react"
import { ocrApi, evidenceApi } from "@/lib/api"

interface OcrUploadProps {
  evidenceType: string // 证据类型，例如 "公司营业执照" 或 "个体工商户营业执照"
  caseId: number
  onDataExtracted: (data: any) => void
  onClose: () => void
}

export function OcrUpload({ evidenceType, caseId, onDataExtracted, onClose }: OcrUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [previewUrl, setPreviewUrl] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError("")
      
      // 创建预览URL
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleRecognize = async () => {
    if (!selectedFile) {
      setError("请选择图片文件")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // 第一步：上传文件
      const formData = new FormData()
      formData.append("case_id", String(caseId))
      formData.append("files", selectedFile)
      
      const uploadResult = await evidenceApi.autoProcess(formData)
      
      if (uploadResult.data && uploadResult.data.length > 0) {
        const uploadedEvidence = uploadResult.data[0]
        const imageUrl = uploadedEvidence.file_url
        
        // 第二步：OCR识别
        const ocrResult = await ocrApi.recognizeEvidence(imageUrl, evidenceType)
        
        if (ocrResult.data) {
          onDataExtracted(ocrResult.data)
          onClose()
        }
      } else {
        setError("文件上传失败")
      }
    } catch (err: any) {
      setError(err.message || "上传或OCR识别失败")
    } finally {
      setIsLoading(false)
    }
  }

  const getEvidenceTypeLabel = () => {
    return evidenceType
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          OCR识别营业执照信息
        </CardTitle>
        <CardDescription>
          上传{getEvidenceTypeLabel()}图片，自动识别并填入表单
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file-upload">选择图片文件</Label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">点击上传或拖拽文件到此处</p>
            <p className="text-sm text-gray-500">支持 JPG、PNG 等图片格式，最大 50MB</p>
            <Input 
              type="file" 
              className="hidden" 
              id="file-upload" 
              accept="image/*"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            <Button
              variant="outline"
              className="mt-4 bg-transparent"
              onClick={() => document.getElementById("file-upload")?.click()}
              disabled={isLoading}
            >
              选择文件
            </Button>
            {selectedFile && (
              <div className="mt-2 text-sm text-gray-700">已选择: {selectedFile.name}</div>
            )}
          </div>
        </div>

        {previewUrl && (
          <div className="space-y-2">
            <Label>图片预览</Label>
            <div className="border rounded-md p-2">
              <img
                src={previewUrl}
                alt="预览"
                className="max-w-full h-32 object-contain mx-auto"
                onError={() => setPreviewUrl("")}
              />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleRecognize}
            disabled={!selectedFile || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                上传识别中...
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                上传并识别
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            取消
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>支持的图片格式：JPG, PNG, GIF</p>
          <p>建议图片清晰，文字完整可见</p>
        </div>
      </CardContent>
    </Card>
  )
}
