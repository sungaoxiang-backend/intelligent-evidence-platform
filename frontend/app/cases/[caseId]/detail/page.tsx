"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Edit, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EvidenceChainDashboard } from "@/components/evidence-chain-dashboard"
import { caseApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import useSWR, { mutate } from "swr"
import type { CaseType, PartyType } from "@/lib/types"

// 案件数据获取函数
const caseFetcher = async ([key, caseId]: [string, string]) => {
  const result = await caseApi.getCaseById(parseInt(caseId))
  return result.data
}

export default function CaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const caseId = params.caseId as string
  const numericCaseId = parseInt(caseId, 10)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [refreshKey, setRefreshKey] = useState(0)

  // 获取案件数据
  const { data: caseData, error: caseError } = useSWR(
    ['case', caseId],
    caseFetcher
  )

  // 初始化编辑表单
  useEffect(() => {
    if (caseData && !editing) {
      setEditForm({
        creditor_name: caseData.creditor_name || '',
        debtor_name: caseData.debtor_name || '',
        loan_amount: caseData.loan_amount || '',
        case_type: caseData.case_type || '',
        creditor_type: caseData.creditor_type || '',
        debtor_type: caseData.debtor_type || '',
        creditor_phone: caseData.creditor_phone || '',
        creditor_bank_account: caseData.creditor_bank_account || '',
        creditor_bank_address: caseData.creditor_bank_address || '',
        debtor_phone: caseData.debtor_phone || ''
      })
    }
  }, [caseData, editing])

  if (isNaN(numericCaseId)) {
    router.push("/cases")
    return null
  }

  // 保存案件信息
  const handleSave = async () => {
    try {
      await caseApi.updateCase(numericCaseId, {
        creditor_name: editForm.creditor_name,
        debtor_name: editForm.debtor_name,
        loan_amount: editForm.loan_amount ? parseFloat(editForm.loan_amount) : undefined,
        case_type: editForm.case_type,
        creditor_type: editForm.creditor_type,
        debtor_type: editForm.debtor_type,
        creditor_phone: editForm.creditor_phone,
        creditor_bank_account: editForm.creditor_bank_account,
        creditor_bank_address: editForm.creditor_bank_address,
        debtor_phone: editForm.debtor_phone
      })
      
      toast({ title: "保存成功", description: "案件信息已更新" })
      setEditing(false)
      
      // 刷新案件数据
      await mutate(['case', caseId])
      
      // 触发证据链dashboard重新加载
      setRefreshKey(prev => prev + 1)
    } catch (error: any) {
      toast({ 
        title: "保存失败", 
        description: error?.message || "请稍后重试", 
        variant: "destructive" 
      })
    }
  }

  if (caseError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 mb-2">加载案件数据失败</div>
            <Button onClick={() => window.location.reload()}>重试</Button>
          </div>
        </div>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <div className="text-muted-foreground">加载中...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">案件详情</h1>
          <p className="text-muted-foreground mt-1">
            {caseData.creditor_name || '未设置债权人'} vs {caseData.debtor_name || '未设置债务人'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/cases")}
          >
            返回
          </Button>
          {editing ? (
            <>
              <Button size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-1" />
                保存
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setEditing(false)
                  // 重置表单
                  setEditForm({
                    creditor_name: caseData.creditor_name || '',
                    debtor_name: caseData.debtor_name || '',
                    loan_amount: caseData.loan_amount || '',
                    case_type: caseData.case_type || '',
                    creditor_type: caseData.creditor_type || '',
                    debtor_type: caseData.debtor_type || '',
                    creditor_phone: caseData.creditor_phone || '',
                    creditor_bank_account: caseData.creditor_bank_account || '',
                    creditor_bank_address: caseData.creditor_bank_address || '',
                    debtor_phone: caseData.debtor_phone || ''
                  })
                }}
              >
                <X className="w-4 h-4 mr-1" />
                取消
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Edit className="w-4 h-4 mr-1" />
              编辑
            </Button>
          )}
        </div>
      </div>

      {/* 合并的案件信息和证据链分析卡片 */}
      <Card>
        <CardContent className="p-6">
          {/* 案件基本信息 */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 债权人 */}
              <div className="space-y-2">
                <Label htmlFor="creditor">债权人</Label>
                {editing ? (
                  <Input
                    id="creditor"
                    value={editForm.creditor_name}
                    onChange={(e) => setEditForm({ ...editForm, creditor_name: e.target.value })}
                    placeholder="请输入债权人姓名"
                  />
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.creditor_name || '未设置'}
                  </div>
                )}
              </div>

              {/* 债务人 */}
              <div className="space-y-2">
                <Label htmlFor="debtor">债务人</Label>
                {editing ? (
                  <Input
                    id="debtor"
                    value={editForm.debtor_name}
                    onChange={(e) => setEditForm({ ...editForm, debtor_name: e.target.value })}
                    placeholder="请输入债务人姓名"
                  />
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.debtor_name || '未设置'}
                  </div>
                )}
              </div>

              {/* 欠款合意 - 固定值 */}
              <div className="space-y-2">
                <Label>欠款合意</Label>
                <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                  明确
                </div>
              </div>

              {/* 欠款金额 */}
              <div className="space-y-2">
                <Label htmlFor="amount">欠款金额 (元)</Label>
                {editing ? (
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={editForm.loan_amount}
                    onChange={(e) => setEditForm({ ...editForm, loan_amount: e.target.value })}
                    placeholder="请输入欠款金额"
                  />
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.loan_amount !== null && caseData.loan_amount !== undefined 
                      ? `¥${caseData.loan_amount.toLocaleString()}` 
                      : '未设置'}
                  </div>
                )}
              </div>

              {/* 案件类型 */}
              <div className="space-y-2">
                <Label htmlFor="case_type">案件类型</Label>
                {editing ? (
                  <Select
                    value={editForm.case_type || ""}
                    onValueChange={(value: CaseType) => setEditForm({ ...editForm, case_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择案件类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debt">民间借贷纠纷</SelectItem>
                      <SelectItem value="contract">买卖合同纠纷</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.case_type === 'debt' ? '民间借贷纠纷' : 
                     caseData.case_type === 'contract' ? '买卖合同纠纷' : '未设置'}
                  </div>
                )}
              </div>

              {/* 债权人类型 */}
              <div className="space-y-2">
                <Label htmlFor="creditor_type">债权人类型</Label>
                {editing ? (
                  <Select
                    value={editForm.creditor_type || ""}
                    onValueChange={(value: PartyType) => setEditForm({ ...editForm, creditor_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择债权人类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person">个人</SelectItem>
                      <SelectItem value="company">公司</SelectItem>
                      <SelectItem value="individual">个体工商户</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.creditor_type === 'person' ? '个人' : 
                     caseData.creditor_type === 'company' ? '公司' : 
                     caseData.creditor_type === 'individual' ? '个体工商户' : '未设置'}
                  </div>
                )}
              </div>

              {/* 债权人电话 */}
              <div className="space-y-2">
                <Label htmlFor="creditor_phone">债权人电话</Label>
                {editing ? (
                  <Input
                    id="creditor_phone"
                    value={editForm.creditor_phone}
                    onChange={(e) => setEditForm({ ...editForm, creditor_phone: e.target.value })}
                    placeholder="请输入债权人电话"
                  />
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.creditor_phone || '未设置'}
                  </div>
                )}
              </div>

              {/* 债务人类型 */}
              <div className="space-y-2">
                <Label htmlFor="debtor_type">债务人类型</Label>
                {editing ? (
                  <Select
                    value={editForm.debtor_type || ""}
                    onValueChange={(value: PartyType) => setEditForm({ ...editForm, debtor_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择债务人类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person">个人</SelectItem>
                      <SelectItem value="company">公司</SelectItem>
                      <SelectItem value="individual">个体工商户</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.debtor_type === 'person' ? '个人' : 
                     caseData.debtor_type === 'company' ? '公司' : 
                     caseData.debtor_type === 'individual' ? '个体工商户' : '未设置'}
                  </div>
                )}
              </div>

              {/* 债务人电话 */}
              <div className="space-y-2">
                <Label htmlFor="debtor_phone">债务人电话</Label>
                {editing ? (
                  <Input
                    id="debtor_phone"
                    value={editForm.debtor_phone}
                    onChange={(e) => setEditForm({ ...editForm, debtor_phone: e.target.value })}
                    placeholder="请输入债务人电话"
                  />
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.debtor_phone || '未设置'}
                  </div>
                )}
              </div>

              {/* 债权人银行账户 */}
              <div className="space-y-2">
                <Label htmlFor="creditor_bank_account">债权人银行账户</Label>
                {editing ? (
                  <Input
                    id="creditor_bank_account"
                    value={editForm.creditor_bank_account}
                    onChange={(e) => setEditForm({ ...editForm, creditor_bank_account: e.target.value })}
                    placeholder="请输入银行账户"
                  />
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.creditor_bank_account || '未设置'}
                  </div>
                )}
              </div>

              {/* 债权人银行地址 */}
              <div className="space-y-2">
                <Label htmlFor="creditor_bank_address">债权人银行地址</Label>
                {editing ? (
                  <Input
                    id="creditor_bank_address"
                    value={editForm.creditor_bank_address}
                    onChange={(e) => setEditForm({ ...editForm, creditor_bank_address: e.target.value })}
                    placeholder="请输入银行地址"
                  />
                ) : (
                  <div className="p-2 bg-muted/30 rounded-md min-h-[40px] flex items-center">
                    {caseData.creditor_bank_address || '未设置'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 证据链分析组件 */}
          <div>
            <EvidenceChainDashboard
              key={refreshKey}
              caseId={numericCaseId}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}