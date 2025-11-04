"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Edit2, Save, X } from "lucide-react"
import Image from "next/image"
import { useState, useEffect } from "react"

interface EvidencePreviewProps {
  evidence: any
  onZoomImage: (image: { src: string; alt: string }) => void
}

export function EvidencePreview({ evidence, onZoomImage }: EvidencePreviewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editedCategory, setEditedCategory] = useState("")
  const [editedFeatures, setEditedFeatures] = useState<Record<string, string>>({})

  useEffect(() => {
    setIsEditing(false)
    setCurrentImageIndex(0)
    if (evidence && evidence.source === "classified") {
      setEditedCategory(evidence.category)
      setEditedFeatures(evidence.features || {})
    }
  }, [evidence]) // Updated dependency to evidence

  if (!evidence) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-50 to-slate-100 mx-auto mb-6 flex items-center justify-center">
            <div className="text-6xl text-slate-300">📋</div>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">未选择证据</h3>
          <p className="text-sm text-slate-500">请从左侧或中间列表选择证据以查看详细信息</p>
        </div>
      </div>
    )
  }

  if (evidence.source === "original") {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            {/* Large Thumbnail */}
            <div
              className="relative w-full aspect-[4/3] bg-slate-100 cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => onZoomImage({ src: evidence.thumbnail, alt: evidence.name })}
            >
              <Image
                src={evidence.thumbnail || "/placeholder.svg"}
                alt={evidence.name}
                fill
                className="object-contain p-8"
                priority
              />
            </div>

            {/* Card Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">原始证据详情</h3>
                  <p className="text-sm text-slate-500">查看证据文件的元数据信息</p>
                </div>
                <Badge
                  variant={evidence.forged ? "default" : "secondary"}
                  className={cn(
                    "text-sm px-3 py-1 font-semibold",
                    evidence.forged ? "bg-green-500 text-white" : "bg-slate-200 text-slate-600",
                  )}
                >
                  {evidence.forged ? "已铸造" : "未铸造"}
                </Badge>
              </div>

              {/* Metadata Grid - Simplified without icons */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                <div className="p-3 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500 mb-1">证据ID</p>
                  <p className="text-base font-bold text-slate-900">#{evidence.id}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500 mb-1">文件类型</p>
                  <p className="text-base font-semibold text-slate-900">
                    {evidence.type === "image" ? "图片文件" : "文档文件"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500 mb-1">文件大小</p>
                  <p className="text-base font-semibold text-slate-900">{evidence.size}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50">
                  <p className="text-xs text-slate-500 mb-1">上传日期</p>
                  <p className="text-base font-semibold text-slate-900">{evidence.date}</p>
                </div>
              </div>

              {/* File Name */}
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-xs text-slate-500 mb-1">完整文件名</p>
                <p className="text-sm text-slate-900 font-mono break-all">{evidence.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Classified evidence preview
  const referencedEvidenceList = evidence.referencedIds.map((id: string) => getEvidenceDetails(id)).filter(Boolean)
  const currentDisplayImage = referencedEvidenceList[currentImageIndex] || {
    thumbnail: evidence.thumbnail,
    name: evidence.category,
  }

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : referencedEvidenceList.length - 1))
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < referencedEvidenceList.length - 1 ? prev + 1 : 0))
  }

  const handleStartEdit = () => {
    setIsEditing(true)
    setEditedCategory(evidence.category)
    setEditedFeatures(evidence.features || {})
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedCategory(evidence.category)
    setEditedFeatures(evidence.features || {})
  }

  const handleSaveEdit = () => {
    console.log("[v0] Saving edited evidence:", {
      id: evidence.id,
      category: editedCategory,
      features: editedFeatures,
    })
    setIsEditing(false)
  }

  const handleCategoryChange = (newCategory: string) => {
    setEditedCategory(newCategory)
    if (newCategory === "未分类") {
      setEditedFeatures({})
    } else {
      setEditedFeatures(getDefaultFeaturesForCategory(newCategory))
    }
  }

  const handleFeatureChange = (key: string, value: string) => {
    setEditedFeatures((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          {/* Large Thumbnail with Navigation */}
          <div className="relative w-full aspect-[4/3] bg-slate-100 group">
            <div
              className="relative w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => onZoomImage({ src: currentDisplayImage.thumbnail, alt: currentDisplayImage.name })}
            >
              <Image
                src={currentDisplayImage.thumbnail || "/placeholder.svg"}
                alt={currentDisplayImage.name}
                fill
                className="object-contain p-8"
                priority
              />
            </div>

            {evidence.type === "combined" && referencedEvidenceList.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrevImage()
                  }}
                >
                  <ChevronLeft className="w-5 h-5 text-slate-700" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNextImage()
                  }}
                >
                  <ChevronRight className="w-5 h-5 text-slate-700" />
                </Button>

                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-white/90 shadow-lg">
                  <span className="text-sm font-semibold text-slate-700">
                    序号: {currentImageIndex + 1}/{referencedEvidenceList.length}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Card Content */}
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-blue-600">#{evidence.id}</span>
                  {evidence.type === "combined" && (
                    <Badge variant="secondary" className="text-sm bg-purple-50 text-purple-700 border-purple-200">
                      联合
                    </Badge>
                  )}
                  {evidence.cardType === "unclassified" && (
                    <Badge variant="outline" className="text-sm border-amber-300 text-amber-700 bg-amber-50">
                      未分类
                    </Badge>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 font-medium">证据类型</label>
                    <Select value={editedCategory} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="身份证">身份证</SelectItem>
                        <SelectItem value="微信聊天记录">微信聊天记录</SelectItem>
                        <SelectItem value="营业执照">营业执照</SelectItem>
                        <SelectItem value="银行流水">银行流水</SelectItem>
                        <SelectItem value="通话记录">通话记录</SelectItem>
                        <SelectItem value="转账记录">转账记录</SelectItem>
                        <SelectItem value="未分类">未分类</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <h3 className="text-lg font-bold text-slate-900">{evidence.category}</h3>
                )}

                <p className="text-sm text-slate-500">
                  引用: {evidence.referencedIds.map((id: string) => `#${id}`).join(", ")}
                </p>
              </div>

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-9 px-3 border-slate-300 hover:bg-slate-50 bg-transparent"
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      取消
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveEdit}
                      className="h-9 px-3 bg-blue-600 hover:bg-blue-700"
                    >
                      <Save className="h-4 w-4 mr-1.5" />
                      保存
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                    className="h-9 px-3 border-slate-300 hover:border-blue-400 hover:bg-blue-50 bg-transparent"
                  >
                    <Edit2 className="h-4 w-4 mr-1.5" />
                    编辑
                  </Button>
                )}
              </div>
            </div>

            {editedCategory !== "未分类" && Object.keys(editedFeatures).length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-900">特征信息</h4>
                {isEditing ? (
                  <div className="grid gap-3">
                    {Object.entries(editedFeatures).map(([key, value]) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-xs text-slate-600 font-medium">{formatFeatureKey(key)}</label>
                        <Input
                          value={value}
                          onChange={(e) => handleFeatureChange(key, e.target.value)}
                          className="h-9 text-sm"
                          placeholder={`请输入${formatFeatureKey(key)}`}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(editedFeatures).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between p-3 rounded-lg bg-slate-50">
                        <span className="text-sm text-slate-600">{formatFeatureKey(key)}</span>
                        <span className="text-sm font-semibold text-slate-900 text-right">{value as string}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Referenced Evidence */}
            {evidence.type === "combined" && evidence.referencedIds.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 mb-3">
                  引用的原始证据 ({evidence.referencedIds.length})
                </h4>
                <div className="grid gap-2">
                  {evidence.referencedIds.map((refId: string, index: number) => {
                    const refEvidence = getEvidenceDetails(refId)
                    return (
                      <div
                        key={refId}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <div
                          className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                          onClick={() =>
                            onZoomImage({ src: refEvidence?.thumbnail || "", alt: refEvidence?.name || "" })
                          }
                        >
                          {refEvidence?.thumbnail && (
                            <Image
                              src={refEvidence.thumbnail || "/placeholder.svg"}
                              alt={refEvidence.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900">证据 #{refId}</p>
                          <p className="text-xs text-slate-600 truncate">{refEvidence?.name || "未知文件"}</p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          序号: {index + 1}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function getDefaultFeaturesForCategory(category: string): Record<string, string> {
  const defaultFeatures: Record<string, Record<string, string>> = {
    身份证: {
      name: "",
      gender: "",
      ethnicity: "",
      birthDate: "",
      address: "",
      idNumber: "",
    },
    微信聊天记录: {
      wechatName: "",
      debtAmount: "",
      debtAgreement: "",
    },
    营业执照: {
      companyName: "",
      creditCode: "",
      legalRepresentative: "",
      companyType: "",
      registeredAddress: "",
    },
    银行流水: {
      accountName: "",
      accountNumber: "",
      totalIncome: "",
      totalExpense: "",
      period: "",
      largestTransaction: "",
    },
    通话记录: {
      phoneNumber: "",
      contactName: "",
      totalCalls: "",
      totalDuration: "",
      period: "",
      lastCallDate: "",
    },
    转账记录: {
      platform: "",
      amount: "",
      transferDate: "",
      sender: "",
      receiver: "",
      note: "",
    },
  }
  return defaultFeatures[category] || {}
}

function formatFeatureKey(key: string): string {
  const keyMap: Record<string, string> = {
    name: "姓名",
    gender: "性别",
    ethnicity: "民族",
    birthDate: "出生日期",
    address: "住址",
    idNumber: "身份证号",
    wechatName: "微信备注名",
    debtAmount: "欠款金额",
    debtAgreement: "欠款合意",
    borrowAmount: "借款金额",
    borrowDate: "借款日期",
    repaymentAgreement: "还款约定",
    debtStatus: "债务状态",
    companyName: "名称",
    creditCode: "统一社会信用代码",
    legalRepresentative: "法定代表人",
    companyType: "公司类型",
    registeredAddress: "住所地",
    accountName: "账户名",
    accountNumber: "账号",
    totalIncome: "总收入",
    totalExpense: "总支出",
    largestTransaction: "最大交易",
    period: "时间段",
    phoneNumber: "电话号码",
    contactName: "联系人",
    totalCalls: "通话次数",
    totalDuration: "通话时长",
    lastCallDate: "最后通话",
    analysisType: "分析类型",
    debtorName: "债务人",
    totalDebt: "债务总额",
    repaymentCapacity: "还款能力",
    riskLevel: "风险等级",
    confidence: "置信度",
    platform: "平台",
    amount: "金额",
    transferDate: "转账日期",
    sender: "转出方",
    receiver: "接收方",
    note: "备注",
  }
  return keyMap[key] || key
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ")
}

function getEvidenceDetails(id: string): { name: string; thumbnail: string } | null {
  const evidenceMap: Record<string, { name: string; thumbnail: string }> = {
    "12": { name: "张三身份证正面.jpg", thumbnail: "/generic-id-card-front.png" },
    "14": { name: "微信聊天记录_借款协商.png", thumbnail: "/wechat-chat-screenshot.jpg" },
    "15": { name: "微信聊天记录_转账确认.png", thumbnail: "/wechat-transfer-confirmation.jpg" },
    "16": { name: "微信聊天记录_催款记录.png", thumbnail: "/wechat-payment-reminder.jpg" },
    "72": { name: "工商银行流水_2023年.pdf", thumbnail: "/generic-bank-statement.png" },
    "73": { name: "通话记录截图.png", thumbnail: "/phone-call-log.jpg" },
    "80": { name: "借款合同扫描件.pdf", thumbnail: "/loan-contract-document.jpg" },
    "81": { name: "借条照片.jpg", thumbnail: "/iou-handwritten-note.jpg" },
    "82": { name: "转账记录_支付宝.png", thumbnail: "/alipay-transfer-record.jpg" },
    "83": { name: "收据扫描件.jpg", thumbnail: "/receipt-scan.jpg" },
    "84": { name: "担保人身份证.jpg", thumbnail: "/guarantor-id-card.jpg" },
    "85": { name: "房产证复印件.pdf", thumbnail: "/property-certificate.jpg" },
  }
  return evidenceMap[id] || null
}
