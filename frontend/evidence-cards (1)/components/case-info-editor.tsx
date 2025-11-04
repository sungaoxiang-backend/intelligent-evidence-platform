"use client"

import { useState } from "react"
import { Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type PartyType = "个人" | "个体工商户" | "公司"

interface CaseInfo {
  caseId: string
  caseType: string
  debtAmount: number
  creditor: {
    type: PartyType
    name: string
    idNumber?: string
    businessName?: string
    operatorName?: string
    companyName?: string
    legalRepName?: string
  }
  debtor: {
    type: PartyType
    name: string
    idNumber?: string
    businessName?: string
    operatorName?: string
    companyName?: string
    legalRepName?: string
  }
}

export function CaseInfoEditor() {
  const [isEditing, setIsEditing] = useState(false)
  const [caseInfo, setCaseInfo] = useState<CaseInfo>({
    caseId: "#35",
    caseType: "买卖合同纠纷",
    debtAmount: 350000,
    creditor: {
      type: "个人",
      name: "张三",
      idNumber: "330106199303030015",
    },
    debtor: {
      type: "个人",
      name: "李四",
      idNumber: "330108199006150023",
    },
  })

  const [editedInfo, setEditedInfo] = useState<CaseInfo>(caseInfo)

  const handleSave = () => {
    setCaseInfo(editedInfo)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedInfo(caseInfo)
    setIsEditing(false)
  }

  const renderPartyFields = (party: "creditor" | "debtor") => {
    const partyData = isEditing ? editedInfo[party] : caseInfo[party]
    const isCreditor = party === "creditor"

    return (
      <div className="space-y-3">
        {/* Type field */}
        <div className="space-y-1">
          <span className="text-xs text-slate-500">类型</span>
          {isEditing ? (
            <Select
              value={partyData.type}
              onValueChange={(value: PartyType) => {
                setEditedInfo({
                  ...editedInfo,
                  [party]: {
                    type: value,
                    name: partyData.name,
                    ...(value === "个人" && { idNumber: "" }),
                    ...(value === "个体工商户" && { businessName: "", operatorName: "" }),
                    ...(value === "公司" && { companyName: "", legalRepName: "" }),
                  },
                })
              }}
            >
              <SelectTrigger className="h-8 text-sm border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="个人">个人</SelectItem>
                <SelectItem value="个体工商户">个体工商户</SelectItem>
                <SelectItem value="公司">公司</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm font-medium text-slate-900">{partyData.type}</div>
          )}
        </div>

        {/* Dynamic fields based on type */}
        {partyData.type === "个人" && (
          <>
            <div className="space-y-1">
              <span className="text-xs text-slate-500">姓名</span>
              {isEditing ? (
                <Input
                  value={partyData.name}
                  onChange={(e) =>
                    setEditedInfo({
                      ...editedInfo,
                      [party]: { ...partyData, name: e.target.value },
                    })
                  }
                  className="h-8 text-sm border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="请输入姓名"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900">{partyData.name}</div>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500">身份证号</span>
              {isEditing ? (
                <Input
                  value={partyData.idNumber || ""}
                  onChange={(e) =>
                    setEditedInfo({
                      ...editedInfo,
                      [party]: { ...partyData, idNumber: e.target.value },
                    })
                  }
                  className="h-8 text-sm font-mono border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="请输入18位身份证号"
                  maxLength={18}
                />
              ) : (
                <div className="text-xs font-mono text-slate-700 break-all">{partyData.idNumber}</div>
              )}
            </div>
          </>
        )}

        {partyData.type === "个体工商户" && (
          <>
            <div className="space-y-1">
              <span className="text-xs text-slate-500">户名</span>
              {isEditing ? (
                <Input
                  value={partyData.businessName || ""}
                  onChange={(e) =>
                    setEditedInfo({
                      ...editedInfo,
                      [party]: { ...partyData, businessName: e.target.value },
                    })
                  }
                  className="h-8 text-sm border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="请输入个体工商户名称"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900">{partyData.businessName}</div>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500">经营者</span>
              {isEditing ? (
                <Input
                  value={partyData.operatorName || ""}
                  onChange={(e) =>
                    setEditedInfo({
                      ...editedInfo,
                      [party]: { ...partyData, operatorName: e.target.value },
                    })
                  }
                  className="h-8 text-sm border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="请输入经营者名称"
                />
              ) : (
                <div className="text-sm text-slate-700">{partyData.operatorName}</div>
              )}
            </div>
          </>
        )}

        {partyData.type === "公司" && (
          <>
            <div className="space-y-1">
              <span className="text-xs text-slate-500">公司名</span>
              {isEditing ? (
                <Input
                  value={partyData.companyName || ""}
                  onChange={(e) =>
                    setEditedInfo({
                      ...editedInfo,
                      [party]: { ...partyData, companyName: e.target.value },
                    })
                  }
                  className="h-8 text-sm border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="请输入公司名称"
                />
              ) : (
                <div className="text-sm font-medium text-slate-900">{partyData.companyName}</div>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500">法定代表</span>
              {isEditing ? (
                <Input
                  value={partyData.legalRepName || ""}
                  onChange={(e) =>
                    setEditedInfo({
                      ...editedInfo,
                      [party]: { ...partyData, legalRepName: e.target.value },
                    })
                  }
                  className="h-8 text-sm border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  placeholder="请输入法定代表人名称"
                />
              ) : (
                <div className="text-sm text-slate-700">{partyData.legalRepName}</div>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900">案件信息</h3>
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-8 px-3 text-xs border-slate-300 hover:border-blue-400 hover:bg-blue-50"
          >
            <Pencil className="h-3 w-3 mr-1.5" />
            编辑
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-8 px-3 text-xs border-slate-300 hover:bg-slate-50 bg-transparent"
            >
              <X className="h-3 w-3 mr-1.5" />
              取消
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
            >
              <Check className="h-3 w-3 mr-1.5" />
              保存
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-6 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <span className="text-xs text-slate-500">案件ID</span>
          <div className="text-sm font-semibold text-slate-900">{caseInfo.caseId}</div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-slate-500">案由</span>
          {isEditing ? (
            <Select
              value={editedInfo.caseType}
              onValueChange={(value) => setEditedInfo({ ...editedInfo, caseType: value })}
            >
              <SelectTrigger className="h-8 text-sm border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="民间借贷纠纷">民间借贷纠纷</SelectItem>
                <SelectItem value="买卖合同纠纷">买卖合同纠纷</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm font-medium text-slate-900">{caseInfo.caseType}</div>
          )}
        </div>
        <div className="space-y-1">
          <span className="text-xs text-slate-500">欠款金额</span>
          {isEditing ? (
            <Input
              type="number"
              value={editedInfo.debtAmount}
              onChange={(e) => setEditedInfo({ ...editedInfo, debtAmount: Number(e.target.value) })}
              className="h-8 text-sm border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              placeholder="请输入欠款金额"
            />
          ) : (
            <div className="text-sm font-semibold text-red-600">¥{caseInfo.debtAmount.toLocaleString()}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-blue-500 rounded-full" />
            <h4 className="font-bold text-slate-900 text-sm">债权人</h4>
          </div>
          {renderPartyFields("creditor")}
        </div>

        <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-amber-500 rounded-full" />
            <h4 className="font-bold text-slate-900 text-sm">债务人</h4>
          </div>
          {renderPartyFields("debtor")}
        </div>
      </div>
    </div>
  )
}
