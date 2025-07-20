"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  DollarSign,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  Upload,
  Brain,
  Gavel,
  Scale,
  Loader2,
} from "lucide-react"
import { caseApi } from "@/lib/api"
import type { Case } from "@/lib/types"

interface CaseDetailProps {
  caseId: string
  onBack: () => void
  onNavigate: (module: string) => void
  onOpenGallery?: () => void // 新增
}

export function CaseDetail({ caseId, onBack, onNavigate, onOpenGallery }: CaseDetailProps) {
  const [case_, setCase] = useState<Case | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Case>>({})

  useEffect(() => {
    loadCaseDetail()
  }, [caseId])

  const loadCaseDetail = async () => {
    setLoading(true)
    try {
      const response = await caseApi.getCaseById(caseId)
      setCase(response.data)
      setEditForm(response.data)
    } catch (error) {
      console.error("加载案件详情失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!case_) return
    setSaving(true)
    try {
      const response = await caseApi.updateCase(case_.id, editForm)
      setCase(response.data)
      setEditing(false)
    } catch (error) {
      console.error("保存案件失败:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm(case_ || {})
    setEditing(false)
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "诉前":
        return "bg-blue-100 text-blue-800"
      case "诉中":
        return "bg-orange-100 text-orange-800"
      case "诉后":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case "诉前":
        return <FileText className="h-4 w-4" />
      case "诉中":
        return <Gavel className="h-4 w-4" />
      case "诉后":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const renderStageTimeline = () => {
    if (!case_) return null

    // 兼容：无 stageDetails 时给默认空对象
    const stageDetails = (case_ as any).stageDetails || {}

    const timelineSteps = [
      { key: "basicInfo", label: "基础信息录入", icon: FileText },
      { key: "evidenceUpload", label: "证据材料上传", icon: Upload },
      { key: "aiAnnotation", label: "AI智能标注", icon: Brain },
      { key: "documentGeneration", label: "法律文书生成", icon: FileText },
    ]

    if (case_.stage === "诉中" || case_.stage === "诉后") {
      timelineSteps.push(
        { key: "submitted", label: "提交法院", icon: FileText },
        { key: "filed", label: "立案受理", icon: CheckCircle },
        { key: "trialPreparation", label: "庭审准备", icon: Gavel },
        { key: "trialInProgress", label: "庭审进行", icon: Clock },
      )
    }

    if (case_.stage === "诉后") {
      timelineSteps.push(
        { key: "judgment", label: "判决下达", icon: Gavel },
        { key: "execution", label: "强制执行", icon: DollarSign },
        { key: "archived", label: "案件归档", icon: FileText },
      )
    }

    return (
      <div className="space-y-4">
        {timelineSteps.map((step, index) => {
          const Icon = step.icon
          const stepData = stageDetails[step.key as keyof typeof stageDetails]
          const isCompleted = stepData?.completed
          const progress = stepData?.progress || 0
          const date = stepData?.date

          return (
            <div key={step.key} className="flex items-start space-x-4">
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  isCompleted
                    ? "bg-green-100 text-green-600"
                    : progress > 0
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4
                    className={`text-sm font-medium ${isCompleted ? "text-green-600" : progress > 0 ? "text-blue-600" : "text-gray-500"}`}
                  >
                    {step.label}
                  </h4>
                  {date && <span className="text-xs text-muted-foreground">{date}</span>}
                </div>
                {progress > 0 && progress < 100 && (
                  <div className="mt-2">
                    <Progress value={progress} className="h-1" />
                    <span className="text-xs text-muted-foreground mt-1">{progress}%</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!case_) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">案件不存在</p>
        <Button onClick={onBack} className="mt-4">
          返回列表
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack} className="h-8 bg-transparent">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{case_.title}</h1>
            {/* 只保留案件编号 */}
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-sm text-muted-foreground">案件编号: {case_.id}</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                保存
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                编辑
              </Button>
              {onOpenGallery && (
                <Button size="sm" variant="outline" className="ml-2" onClick={onOpenGallery}>
                  <FileText className="h-4 w-4 mr-2" />
                  证据画廊
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-lg">案件基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">案件标题</Label>
              {editing ? (
                <Input
                  id="title"
                  value={editForm.title || ""}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium mt-1">{case_.title}</p>
              )}
            </div>
            <div>
              <Label htmlFor="case_type">案件类型</Label>
              {editing ? (
                <Input
                  id="case_type"
                  value={editForm.case_type || ""}
                  onChange={(e) => setEditForm({ ...editForm, case_type: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium mt-1">{case_.case_type}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="creditor_name">债权人</Label>
              {editing ? (
                <Input
                  id="creditor_name"
                  value={editForm.creditor_name || ""}
                  onChange={(e) => setEditForm({ ...editForm, creditor_name: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium mt-1">{case_.creditor_name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="creditor_type">债权人类型</Label>
              {editing ? (
                <Input
                  id="creditor_type"
                  value={editForm.creditor_type || ""}
                  onChange={(e) => setEditForm({ ...editForm, creditor_type: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium mt-1">{case_.creditor_type || "-"}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="debtor_name">债务人</Label>
              {editing ? (
                <Input
                  id="debtor_name"
                  value={editForm.debtor_name || ""}
                  onChange={(e) => setEditForm({ ...editForm, debtor_name: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium mt-1">{case_.debtor_name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="debtor_type">债务人类型</Label>
              {editing ? (
                <Input
                  id="debtor_type"
                  value={editForm.debtor_type || ""}
                  onChange={(e) => setEditForm({ ...editForm, debtor_type: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium mt-1">{case_.debtor_type || "-"}</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="description">案件描述</Label>
            {editing ? (
              <Textarea
                id="description"
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={4}
              />
            ) : (
              <p className="text-sm mt-1 bg-muted/30 p-3 rounded-lg">{case_.description}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>创建时间</Label>
              <p className="text-sm font-medium mt-1">{case_.created_at ? new Date(case_.created_at).toLocaleString() : "-"}</p>
            </div>
            <div>
              <Label>更新时间</Label>
              <p className="text-sm font-medium mt-1">{case_.updated_at ? new Date(case_.updated_at).toLocaleString() : "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
