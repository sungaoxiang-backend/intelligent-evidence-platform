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

// 格式化金额，去除尾随零
function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) {
    return amount.toString();
  }
  return amount.toFixed(2).replace(/\.?0+$/, '');
}

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
  
  // 临时存储输入的金额字符串，用于显示
  const [loanAmountInput, setLoanAmountInput] = useState("")

  // 表单验证状态
  const [formErrors, setFormErrors] = useState({
    creditor_name: "",
    debtor_name: "",
    loan_amount: "",
    case_type: "",
    creditor_type: "",
    debtor_type: "",
    creditor_phone: "",
    creditor_bank_account: "",
    creditor_bank_address: "",
    debtor_phone: "",
  })

  // 表单验证函数
  const validateForm = () => {
    const errors = {
      creditor_name: "",
      debtor_name: "",
      loan_amount: "",
      case_type: "",
      creditor_type: "",
      debtor_type: "",
      creditor_phone: "",
      creditor_bank_account: "",
      creditor_bank_address: "",
      debtor_phone: "",
    }

    // 验证债权人姓名
    if (!editForm.creditor_name?.trim()) {
      errors.creditor_name = "债权人姓名不能为空"
    }

    // 验证债务人姓名
    if (!editForm.debtor_name?.trim()) {
      errors.debtor_name = "债务人姓名不能为空"
    }

    // 验证欠款金额
    if (!loanAmountInput || loanAmountInput.trim() === "") {
      errors.loan_amount = "请输入欠款金额";
    } else if (!/^\d+(\.\d{1,2})?$/.test(loanAmountInput)) {
      errors.loan_amount = "请输入有效的金额格式（最多两位小数）";
    } else if (parseFloat(loanAmountInput) <= 0) {
      errors.loan_amount = "金额必须大于0";
    }

    // 验证案件类型
    if (!editForm.case_type) {
      errors.case_type = "请选择案件类型"
    }

    // 验证债权人类型
    if (!editForm.creditor_type) {
      errors.creditor_type = "请选择债权人类型"
    }

    // 验证债务人类型
    if (!editForm.debtor_type) {
      errors.debtor_type = "请选择债务人类型"
    }

    // 检查是否有错误
    const hasErrors = Object.values(errors).some(error => error !== "")
    
    // 更新错误状态
    setFormErrors(errors)
    
    return !hasErrors
  }

  // 获取案件数据
  const { data: caseData, error: caseError } = useSWR(
    ['case', caseId],
    caseFetcher
  )

  // 初始化编辑表单
  useEffect(() => {
    if (caseData && !editing) {
      const creditor = caseData.case_parties?.find((p: any) => p.party_role === "creditor");
      const debtor = caseData.case_parties?.find((p: any) => p.party_role === "debtor");
      
      setEditForm({
        creditor_name: creditor?.party_name || '',
        debtor_name: debtor?.party_name || '',
        loan_amount: caseData.loan_amount || '',
        case_type: caseData.case_type || '',
        creditor_type: creditor?.party_type || '',
        debtor_type: debtor?.party_type || '',
        creditor_phone: creditor?.phone || '',
        creditor_bank_account: creditor?.bank_account || '',
        creditor_bank_address: creditor?.bank_address || '',
        debtor_phone: debtor?.phone || '',
        // 扩展字段
        creditor_real_name: creditor?.name || '',
        creditor_gender: creditor?.gender || '',
        creditor_birthday: creditor?.birthday || '',
        creditor_nation: creditor?.nation || '',
        creditor_address: creditor?.address || '',
        creditor_id_card: creditor?.id_card || '',
        creditor_company_name: creditor?.company_name || '',
        creditor_company_address: creditor?.company_address || '',
        creditor_company_code: creditor?.company_code || '',
        creditor_owner_name: creditor?.owner_name || '',
        creditor_bank_phone: creditor?.bank_phone || '',
        debtor_real_name: debtor?.name || '',
        debtor_gender: debtor?.gender || '',
        debtor_birthday: debtor?.birthday || '',
        debtor_nation: debtor?.nation || '',
        debtor_address: debtor?.address || '',
        debtor_id_card: debtor?.id_card || '',
        debtor_company_name: debtor?.company_name || '',
        debtor_company_address: debtor?.company_address || '',
        debtor_company_code: debtor?.company_code || '',
      })
      // 设置金额输入值
      setLoanAmountInput(caseData.loan_amount ? caseData.loan_amount.toString() : '')
    }
  }, [caseData, editing])

  if (isNaN(numericCaseId)) {
    router.push("/cases")
    return null
  }

  // 保存案件信息
  const handleSave = async () => {
    // 先进行表单验证
    if (!validateForm()) {
      toast({ 
        title: "验证失败", 
        description: "请检查必填字段", 
        variant: "destructive" 
      })
      return
    }

    try {
      // 1. 更新案件基本信息（不包含当事人信息）
      await caseApi.updateCase(numericCaseId, {
        loan_amount: loanAmountInput ? parseFloat(loanAmountInput) : undefined,
        case_type: editForm.case_type,
      })

      // 2. 分别更新债权人和债务人信息
      const creditor = caseData?.case_parties?.find((p: any) => p.party_role === "creditor")
      const debtor = caseData?.case_parties?.find((p: any) => p.party_role === "debtor")

      if (creditor && creditor.id) {
        await caseApi.updateCaseParty(numericCaseId, creditor.id, {
          party_name: editForm.creditor_name,
          party_type: editForm.creditor_type,
          phone: editForm.creditor_phone,
          bank_account: editForm.creditor_bank_account,
          bank_address: editForm.creditor_bank_address,
          name: editForm.creditor_real_name,
          gender: editForm.creditor_gender,
          birthday: editForm.creditor_birthday,
          nation: editForm.creditor_nation,
          address: editForm.creditor_address,
          id_card: editForm.creditor_id_card,
          company_name: editForm.creditor_company_name,
          company_address: editForm.creditor_company_address,
          company_code: editForm.creditor_company_code,
          owner_name: editForm.creditor_owner_name,
          bank_phone: editForm.creditor_bank_phone,
        })
      }

      if (debtor && debtor.id) {
        await caseApi.updateCaseParty(numericCaseId, debtor.id, {
          party_name: editForm.debtor_name,
          party_type: editForm.debtor_type,
          phone: editForm.debtor_phone,
          name: editForm.debtor_real_name,
          gender: editForm.debtor_gender,
          birthday: editForm.debtor_birthday,
          nation: editForm.debtor_nation,
          address: editForm.debtor_address,
          id_card: editForm.debtor_id_card,
          company_name: editForm.debtor_company_name,
          company_address: editForm.debtor_company_address,
          company_code: editForm.debtor_company_code,
        })
      }
      
      toast({ title: "保存成功", description: "案件信息已更新" })
      setEditing(false)
      
      // 清除错误状态
      setFormErrors({
        creditor_name: "",
        debtor_name: "",
        loan_amount: "",
        case_type: "",
        creditor_type: "",
        debtor_type: "",
        creditor_phone: "",
        creditor_bank_account: "",
        creditor_bank_address: "",
        debtor_phone: "",
      })
      
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
          <div className="mt-2 space-y-1">
            <p className="text-muted-foreground text-lg">
              {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.party_name || '未设置债权人'} vs {caseData.case_parties?.find((p: any) => p.party_role === "debtor")?.party_name || '未设置债务人'}
            </p>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <span>创建时间：{caseData.created_at ? new Date(caseData.created_at).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }) : '未设置'}</span>
              <span>更新时间：{caseData.updated_at ? new Date(caseData.updated_at).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              }) : '未设置'}</span>
            </div>
          </div>
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
                  // 重置表单和错误状态
                  const creditor = caseData.case_parties?.find((p: any) => p.party_role === "creditor");
                  const debtor = caseData.case_parties?.find((p: any) => p.party_role === "debtor");
                  
                  setEditForm({
                    creditor_name: creditor?.party_name || '',
                    debtor_name: debtor?.party_name || '',
                    loan_amount: caseData.loan_amount || '',
                    case_type: caseData.case_type || '',
                    creditor_type: creditor?.party_type || '',
                    debtor_type: debtor?.party_type || '',
                    creditor_phone: creditor?.phone || '',
                    creditor_bank_account: creditor?.bank_account || '',
                    creditor_bank_address: creditor?.bank_address || '',
                    debtor_phone: debtor?.phone || ''
                  })
                  setLoanAmountInput(caseData.loan_amount ? caseData.loan_amount.toString() : '')
                  setFormErrors({
                    creditor_name: "",
                    debtor_name: "",
                    loan_amount: "",
                    case_type: "",
                    creditor_type: "",
                    debtor_type: "",
                    creditor_phone: "",
                    creditor_bank_account: "",
                    creditor_bank_address: "",
                    debtor_phone: "",
                  })
                }}
              >
                <X className="w-4 h-4 mr-1" />
                取消
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Edit className="w-4 h-4 mr-1" />
                编辑
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={async () => {
                  if (confirm('确定要删除这个案件吗？删除后无法恢复。')) {
                    try {
                      await caseApi.deleteCase(numericCaseId)
                      toast({ 
                        title: "删除成功", 
                        description: "案件已删除" 
                      })
                      router.push("/cases")
                    } catch (error: any) {
                      toast({ 
                        title: "删除失败", 
                        description: error?.message || "请稍后重试", 
                        variant: "destructive" 
                      })
                    }
                  }
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                删除
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 基础案件信息卡片 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
            基础案件信息
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 案件类型 */}
            <div className="space-y-2">
              <Label htmlFor="case_type" className="text-sm font-medium text-gray-700">
                案件类型 <span className="text-red-500">*</span>
              </Label>
              {editing ? (
                <Select
                  value={editForm.case_type || ""}
                  onValueChange={(value: string) => setEditForm({ ...editForm, case_type: value as CaseType })}
                >
                  <SelectTrigger className={formErrors.case_type ? "border-red-500" : ""}>
                    <SelectValue placeholder="选择案件类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debt">民间借贷纠纷</SelectItem>
                    <SelectItem value="contract">买卖合同纠纷</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                  {caseData.case_type === 'debt' ? '民间借贷纠纷' : 
                   caseData.case_type === 'contract' ? '买卖合同纠纷' : '未设置'}
                </div>
              )}
              {formErrors.case_type && (
                <div className="text-red-500 text-xs">{formErrors.case_type}</div>
              )}
            </div>

            {/* 欠款金额 */}
            <div className="space-y-2">
              <Label htmlFor="loan_amount" className="text-sm font-medium text-gray-700">
                欠款金额 <span className="text-red-500">*</span>
              </Label>
              {editing ? (
                <Input
                  id="loan_amount"
                  type="text"
                  value={loanAmountInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLoanAmountInput(value);
                    
                    if (value === "" || value === ".") {
                      setFormErrors(prev => ({ ...prev, loan_amount: "请输入欠款金额" }));
                    } else if (!/^\d+(\.\d*)?$/.test(value)) {
                      setFormErrors(prev => ({ ...prev, loan_amount: "请输入有效的金额格式" }));
                    } else if (value.includes(".") && value.split(".")[1]?.length > 2) {
                      setFormErrors(prev => ({ ...prev, loan_amount: "最多支持两位小数" }));
                    } else if (parseFloat(value) <= 0) {
                      setFormErrors(prev => ({ ...prev, loan_amount: "金额必须大于0" }));
                    } else {
                      setFormErrors(prev => ({ ...prev, loan_amount: "" }));
                    }
                  }}
                  onBlur={() => {
                    const value = loanAmountInput;
                    if (!value || value.trim() === "") {
                      setFormErrors(prev => ({ ...prev, loan_amount: "请输入欠款金额" }));
                      return;
                    }
                    
                    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
                      setFormErrors(prev => ({ ...prev, loan_amount: "请输入有效的金额格式（最多两位小数）" }));
                      return;
                    }
                    
                    const numValue = parseFloat(value);
                    if (numValue <= 0) {
                      setFormErrors(prev => ({ ...prev, loan_amount: "请输入有效的欠款金额" }));
                      return;
                    }
                    
                    const formattedValue = formatAmount(numValue);
                    setLoanAmountInput(formattedValue);
                    setEditForm((prev: any) => ({ ...prev, loan_amount: numValue }));
                    setFormErrors(prev => ({ ...prev, loan_amount: "" }));
                  }}
                  placeholder="请输入欠款金额"
                  className={`${formErrors.loan_amount ? "border-red-500" : ""} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                />
              ) : (
                <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                  {caseData.loan_amount ? `¥${caseData.loan_amount.toLocaleString()}` : '未设置'}
                </div>
              )}
              {formErrors.loan_amount && (
                <div className="text-red-500 text-xs">{formErrors.loan_amount}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 债权人信息卡片 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-blue-600 flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
            债权人信息
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-800 border-l-3 border-blue-400 pl-3 bg-blue-50 py-2 -ml-3">基本信息</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 债权人姓名 */}
              <div className="space-y-2">
                <Label htmlFor="creditor" className="text-sm font-medium text-gray-700">
                  债权人名称 <span className="text-red-500">*</span>
                </Label>
                {editing ? (
                  <Input
                    id="creditor"
                    value={editForm.creditor_name}
                    onChange={(e) => setEditForm({ ...editForm, creditor_name: e.target.value })}
                    placeholder="请输入债权人姓名"
                    className={formErrors.creditor_name ? "border-red-500" : ""}
                  />
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.party_name || '未设置'}
                  </div>
                )}
                {formErrors.creditor_name && (
                  <div className="text-red-500 text-xs">{formErrors.creditor_name}</div>
                )}
              </div>

              {/* 债权人类型 */}
              <div className="space-y-2">
                <Label htmlFor="creditor_type" className="text-sm font-medium text-gray-700">
                  债权人类型 <span className="text-red-500">*</span>
                </Label>
                {editing ? (
                  <Select
                    value={editForm.creditor_type || ""}
                    onValueChange={(value: string) => setEditForm({ ...editForm, creditor_type: value as PartyType })}
                  >
                    <SelectTrigger className={formErrors.creditor_type ? "border-red-500" : ""}>
                      <SelectValue placeholder="选择债权人类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person">个人</SelectItem>
                      <SelectItem value="company">公司</SelectItem>
                      <SelectItem value="individual">个体工商户</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {(() => {
                      const creditorType = caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.party_type;
                      return creditorType === 'person' ? '个人' : 
                             creditorType === 'company' ? '公司' : 
                             creditorType === 'individual' ? '个体工商户' : '未设置';
                    })()}
                  </div>
                )}
                {formErrors.creditor_type && (
                  <div className="text-red-500 text-xs">{formErrors.creditor_type}</div>
                )}
              </div>

              {/* 债权人电话 */}
              <div className="space-y-2">
                <Label htmlFor="creditor_phone" className="text-sm font-medium text-gray-700">债权人电话</Label>
                {editing ? (
                  <Input
                    id="creditor_phone"
                    value={editForm.creditor_phone}
                    onChange={(e) => setEditForm({ ...editForm, creditor_phone: e.target.value })}
                    placeholder="请输入债权人电话"
                  />
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.phone || '未设置'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 根据债权人类型动态显示详细信息 */}
          {(() => {
            const creditor = caseData.case_parties?.find((p: any) => p.party_role === "creditor");
            const creditorType = editing ? editForm.creditor_type : creditor?.party_type;
            
            return (
              <>
                {/* 个人信息 */}
                {creditorType === 'person' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-800 border-l-3 border-blue-400 pl-3 bg-blue-50 py-2 -ml-3">身份信息</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* 姓名 */}
                      <div className="space-y-2">
                        <Label htmlFor="creditor_real_name" className="text-sm font-medium text-gray-700">姓名</Label>
                        {editing ? (
                          <Input
                            id="creditor_real_name"
                            value={editForm.creditor_real_name}
                            onChange={(e) => setEditForm({ ...editForm, creditor_real_name: e.target.value })}
                            placeholder="请输入姓名"
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {creditor?.name || '未设置'}
                          </div>
                        )}
                      </div>

                      {/* 性别 */}
                      <div className="space-y-2">
                        <Label htmlFor="creditor_gender" className="text-sm font-medium text-gray-700">性别</Label>
                        {editing ? (
                          <Select
                            value={editForm.creditor_gender || ""}
                            onValueChange={(value: string) => setEditForm({ ...editForm, creditor_gender: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择性别" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="男">男</SelectItem>
                              <SelectItem value="女">女</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {creditor?.gender || '未设置'}
                          </div>
                        )}
                      </div>

                      {/* 出生日期 */}
                      <div className="space-y-2">
                        <Label htmlFor="creditor_birthday" className="text-sm font-medium text-gray-700">出生日期</Label>
                        {editing ? (
                          <Input
                            id="creditor_birthday"
                            type="date"
                            value={editForm.creditor_birthday}
                            onChange={(e) => setEditForm({ ...editForm, creditor_birthday: e.target.value })}
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {creditor?.birthday || '未设置'}
                          </div>
                        )}
                      </div>

                      {/* 民族 */}
                      <div className="space-y-2">
                        <Label htmlFor="creditor_nation" className="text-sm font-medium text-gray-700">民族</Label>
                        {editing ? (
                          <Input
                            id="creditor_nation"
                            value={editForm.creditor_nation}
                            onChange={(e) => setEditForm({ ...editForm, creditor_nation: e.target.value })}
                            placeholder="请输入民族"
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {creditor?.nation || '未设置'}
                          </div>
                        )}
                      </div>

                      {/* 住址 - 跨列 */}
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="creditor_address" className="text-sm font-medium text-gray-700">住址</Label>
                        {editing ? (
                          <Input
                            id="creditor_address"
                            value={editForm.creditor_address}
                            onChange={(e) => setEditForm({ ...editForm, creditor_address: e.target.value })}
                            placeholder="请输入住址"
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {creditor?.address || '未设置'}
                          </div>
                        )}
                      </div>

                      {/* 身份证号 - 跨列 */}
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="creditor_id_card" className="text-sm font-medium text-gray-700">公民身份号码</Label>
                        {editing ? (
                          <Input
                            id="creditor_id_card"
                            value={editForm.creditor_id_card}
                            onChange={(e) => setEditForm({ ...editForm, creditor_id_card: e.target.value })}
                            placeholder="请输入身份证号"
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {creditor?.id_card || '未设置'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 个体工商户信息 */}
                {creditorType === 'individual' && (
                  <>
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-800 border-l-3 border-blue-400 pl-3 bg-blue-50 py-2 -ml-3">个体工商户信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="creditor_company_name" className="text-sm font-medium text-gray-700">经营名称</Label>
                          {editing ? (
                            <Input
                              id="creditor_company_name"
                              value={editForm.creditor_company_name}
                              onChange={(e) => setEditForm({ ...editForm, creditor_company_name: e.target.value })}
                              placeholder="请输入经营名称"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.company_name || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="creditor_company_address" className="text-sm font-medium text-gray-700">住所地</Label>
                          {editing ? (
                            <Input
                              id="creditor_company_address"
                              value={editForm.creditor_company_address}
                              onChange={(e) => setEditForm({ ...editForm, creditor_company_address: e.target.value })}
                              placeholder="请输入住所地"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.company_address || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="creditor_company_code" className="text-sm font-medium text-gray-700">统一社会信用代码</Label>
                          {editing ? (
                            <Input
                              id="creditor_company_code"
                              value={editForm.creditor_company_code}
                              onChange={(e) => setEditForm({ ...editForm, creditor_company_code: e.target.value })}
                              placeholder="请输入统一社会信用代码"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.company_code || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-800 border-l-3 border-blue-400 pl-3 bg-blue-50 py-2 -ml-3">经营者信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="creditor_real_name" className="text-sm font-medium text-gray-700">姓名</Label>
                          {editing ? (
                            <Input
                              id="creditor_real_name"
                              value={editForm.creditor_real_name}
                              onChange={(e) => setEditForm({ ...editForm, creditor_real_name: e.target.value })}
                              placeholder="请输入姓名"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.name || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="creditor_gender" className="text-sm font-medium text-gray-700">性别</Label>
                          {editing ? (
                            <Select
                              value={editForm.creditor_gender || ""}
                              onValueChange={(value: string) => setEditForm({ ...editForm, creditor_gender: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="选择性别" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="男">男</SelectItem>
                                <SelectItem value="女">女</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.gender || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="creditor_birthday" className="text-sm font-medium text-gray-700">出生日期</Label>
                          {editing ? (
                            <Input
                              id="creditor_birthday"
                              type="date"
                              value={editForm.creditor_birthday}
                              onChange={(e) => setEditForm({ ...editForm, creditor_birthday: e.target.value })}
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.birthday || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="creditor_nation" className="text-sm font-medium text-gray-700">民族</Label>
                          {editing ? (
                            <Input
                              id="creditor_nation"
                              value={editForm.creditor_nation}
                              onChange={(e) => setEditForm({ ...editForm, creditor_nation: e.target.value })}
                              placeholder="请输入民族"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.nation || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="creditor_address" className="text-sm font-medium text-gray-700">住址</Label>
                          {editing ? (
                            <Input
                              id="creditor_address"
                              value={editForm.creditor_address}
                              onChange={(e) => setEditForm({ ...editForm, creditor_address: e.target.value })}
                              placeholder="请输入住址"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.address || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 md:col-span-3">
                          <Label htmlFor="creditor_id_card" className="text-sm font-medium text-gray-700">公民身份号码</Label>
                          {editing ? (
                            <Input
                              id="creditor_id_card"
                              value={editForm.creditor_id_card}
                              onChange={(e) => setEditForm({ ...editForm, creditor_id_card: e.target.value })}
                              placeholder="请输入身份证号"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.id_card || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 公司信息 */}
                {creditorType === 'company' && (
                  <>
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-800 border-l-3 border-blue-400 pl-3 bg-blue-50 py-2 -ml-3">公司信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="creditor_company_name" className="text-sm font-medium text-gray-700">公司名称</Label>
                          {editing ? (
                            <Input
                              id="creditor_company_name"
                              value={editForm.creditor_company_name}
                              onChange={(e) => setEditForm({ ...editForm, creditor_company_name: e.target.value })}
                              placeholder="请输入公司名称"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.company_name || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="creditor_company_address" className="text-sm font-medium text-gray-700">住所地</Label>
                          {editing ? (
                            <Input
                              id="creditor_company_address"
                              value={editForm.creditor_company_address}
                              onChange={(e) => setEditForm({ ...editForm, creditor_company_address: e.target.value })}
                              placeholder="请输入住所地"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.company_address || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="creditor_company_code" className="text-sm font-medium text-gray-700">统一社会信用代码</Label>
                          {editing ? (
                            <Input
                              id="creditor_company_code"
                              value={editForm.creditor_company_code}
                              onChange={(e) => setEditForm({ ...editForm, creditor_company_code: e.target.value })}
                              placeholder="请输入统一社会信用代码"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.company_code || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-800 border-l-3 border-blue-400 pl-3 bg-blue-50 py-2 -ml-3">法定代表人信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="creditor_real_name" className="text-sm font-medium text-gray-700">姓名</Label>
                          {editing ? (
                            <Input
                              id="creditor_real_name"
                              value={editForm.creditor_real_name}
                              onChange={(e) => setEditForm({ ...editForm, creditor_real_name: e.target.value })}
                              placeholder="请输入姓名"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.name || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="creditor_phone" className="text-sm font-medium text-gray-700">联系电话</Label>
                          {editing ? (
                            <Input
                              id="creditor_phone"
                              value={editForm.creditor_phone}
                              onChange={(e) => setEditForm({ ...editForm, creditor_phone: e.target.value })}
                              placeholder="请输入联系电话"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {creditor?.phone || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()}

          {/* 银行信息 - 债权人专有 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-800 border-l-3 border-blue-400 pl-3 bg-blue-50 py-2 -ml-3">银行信息</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creditor_bank_account" className="text-sm font-medium text-gray-700">银行账户</Label>
                {editing ? (
                  <Input
                    id="creditor_bank_account"
                    value={editForm.creditor_bank_account}
                    onChange={(e) => setEditForm({ ...editForm, creditor_bank_account: e.target.value })}
                    placeholder="请输入银行账户"
                  />
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.bank_account || '未设置'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditor_bank_address" className="text-sm font-medium text-gray-700">银行地址</Label>
                {editing ? (
                  <Input
                    id="creditor_bank_address"
                    value={editForm.creditor_bank_address}
                    onChange={(e) => setEditForm({ ...editForm, creditor_bank_address: e.target.value })}
                    placeholder="请输入银行地址"
                  />
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.bank_address || '未设置'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditor_owner_name" className="text-sm font-medium text-gray-700">开户人</Label>
                {editing ? (
                  <Input
                    id="creditor_owner_name"
                    value={editForm.creditor_owner_name}
                    onChange={(e) => setEditForm({ ...editForm, creditor_owner_name: e.target.value })}
                    placeholder="请输入开户人"
                  />
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.owner_name || '未设置'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditor_bank_phone" className="text-sm font-medium text-gray-700">银行电话</Label>
                {editing ? (
                  <Input
                    id="creditor_bank_phone"
                    value={editForm.creditor_bank_phone}
                    onChange={(e) => setEditForm({ ...editForm, creditor_bank_phone: e.target.value })}
                    placeholder="请输入银行电话"
                  />
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.bank_phone || '未设置'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 债务人信息卡片 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-orange-600 flex items-center">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
            债务人信息
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-800 border-l-3 border-orange-400 pl-3 bg-orange-50 py-2 -ml-3">基本信息</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="debtor" className="text-sm font-medium text-gray-700">
                  债务人名称 <span className="text-red-500">*</span>
                </Label>
                {editing ? (
                  <Input
                    id="debtor"
                    value={editForm.debtor_name}
                    onChange={(e) => setEditForm({ ...editForm, debtor_name: e.target.value })}
                    placeholder="请输入债务人姓名"
                    className={formErrors.debtor_name ? "border-red-500" : ""}
                  />
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {caseData.case_parties?.find((p: any) => p.party_role === "debtor")?.party_name || '未设置'}
                  </div>
                )}
                {formErrors.debtor_name && (
                  <div className="text-red-500 text-xs">{formErrors.debtor_name}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="debtor_type" className="text-sm font-medium text-gray-700">
                  债务人类型 <span className="text-red-500">*</span>
                </Label>
                {editing ? (
                  <Select
                    value={editForm.debtor_type || ""}
                    onValueChange={(value: string) => setEditForm({ ...editForm, debtor_type: value as PartyType })}
                  >
                    <SelectTrigger className={formErrors.debtor_type ? "border-red-500" : ""}>
                      <SelectValue placeholder="选择债务人类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person">个人</SelectItem>
                      <SelectItem value="company">公司</SelectItem>
                      <SelectItem value="individual">个体工商户</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {(() => {
                      const debtorType = caseData.case_parties?.find((p: any) => p.party_role === "debtor")?.party_type;
                      return debtorType === 'person' ? '个人' : 
                             debtorType === 'company' ? '公司' : 
                             debtorType === 'individual' ? '个体工商户' : '未设置';
                    })()}
                  </div>
                )}
                {formErrors.debtor_type && (
                  <div className="text-red-500 text-xs">{formErrors.debtor_type}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="debtor_phone" className="text-sm font-medium text-gray-700">债务人电话</Label>
                {editing ? (
                  <Input
                    id="debtor_phone"
                    value={editForm.debtor_phone}
                    onChange={(e) => setEditForm({ ...editForm, debtor_phone: e.target.value })}
                    placeholder="请输入债务人电话"
                  />
                ) : (
                  <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                    {caseData.case_parties?.find((p: any) => p.party_role === "debtor")?.phone || '未设置'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 根据债务人类型动态显示详细信息 */}
          {(() => {
            const debtor = caseData.case_parties?.find((p: any) => p.party_role === "debtor");
            const debtorType = editing ? editForm.debtor_type : debtor?.party_type;
            
            return (
              <>
                {/* 个人信息 */}
                {debtorType === 'person' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-800 border-l-3 border-orange-400 pl-3 bg-orange-50 py-2 -ml-3">身份信息</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="debtor_real_name" className="text-sm font-medium text-gray-700">姓名</Label>
                        {editing ? (
                          <Input
                            id="debtor_real_name"
                            value={editForm.debtor_real_name}
                            onChange={(e) => setEditForm({ ...editForm, debtor_real_name: e.target.value })}
                            placeholder="请输入姓名"
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {debtor?.name || '未设置'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="debtor_gender" className="text-sm font-medium text-gray-700">性别</Label>
                        {editing ? (
                          <Select
                            value={editForm.debtor_gender || ""}
                            onValueChange={(value: string) => setEditForm({ ...editForm, debtor_gender: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择性别" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="男">男</SelectItem>
                              <SelectItem value="女">女</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {debtor?.gender || '未设置'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="debtor_birthday" className="text-sm font-medium text-gray-700">出生日期</Label>
                        {editing ? (
                          <Input
                            id="debtor_birthday"
                            type="date"
                            value={editForm.debtor_birthday}
                            onChange={(e) => setEditForm({ ...editForm, debtor_birthday: e.target.value })}
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {debtor?.birthday || '未设置'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="debtor_nation" className="text-sm font-medium text-gray-700">民族</Label>
                        {editing ? (
                          <Input
                            id="debtor_nation"
                            value={editForm.debtor_nation}
                            onChange={(e) => setEditForm({ ...editForm, debtor_nation: e.target.value })}
                            placeholder="请输入民族"
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {debtor?.nation || '未设置'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="debtor_address" className="text-sm font-medium text-gray-700">住址</Label>
                        {editing ? (
                          <Input
                            id="debtor_address"
                            value={editForm.debtor_address}
                            onChange={(e) => setEditForm({ ...editForm, debtor_address: e.target.value })}
                            placeholder="请输入住址"
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {debtor?.address || '未设置'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="debtor_id_card" className="text-sm font-medium text-gray-700">公民身份号码</Label>
                        {editing ? (
                          <Input
                            id="debtor_id_card"
                            value={editForm.debtor_id_card}
                            onChange={(e) => setEditForm({ ...editForm, debtor_id_card: e.target.value })}
                            placeholder="请输入身份证号"
                          />
                        ) : (
                          <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                            {debtor?.id_card || '未设置'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 个体工商户信息 */}
                {debtorType === 'individual' && (
                  <>
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-800 border-l-3 border-orange-400 pl-3 bg-orange-50 py-2 -ml-3">个体工商户信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="debtor_company_name" className="text-sm font-medium text-gray-700">经营名称</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_name"
                              value={editForm.debtor_company_name}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_name: e.target.value })}
                              placeholder="请输入经营名称"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.company_name || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="debtor_company_address" className="text-sm font-medium text-gray-700">住所地</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_address"
                              value={editForm.debtor_company_address}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_address: e.target.value })}
                              placeholder="请输入住所地"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.company_address || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="debtor_company_code" className="text-sm font-medium text-gray-700">统一社会信用代码</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_code"
                              value={editForm.debtor_company_code}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_code: e.target.value })}
                              placeholder="请输入统一社会信用代码"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.company_code || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-800 border-l-3 border-orange-400 pl-3 bg-orange-50 py-2 -ml-3">经营者信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="debtor_real_name" className="text-sm font-medium text-gray-700">姓名</Label>
                          {editing ? (
                            <Input
                              id="debtor_real_name"
                              value={editForm.debtor_real_name}
                              onChange={(e) => setEditForm({ ...editForm, debtor_real_name: e.target.value })}
                              placeholder="请输入姓名"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.name || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="debtor_gender" className="text-sm font-medium text-gray-700">性别</Label>
                          {editing ? (
                            <Select
                              value={editForm.debtor_gender || ""}
                              onValueChange={(value: string) => setEditForm({ ...editForm, debtor_gender: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="选择性别" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="男">男</SelectItem>
                                <SelectItem value="女">女</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.gender || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="debtor_birthday" className="text-sm font-medium text-gray-700">出生日期</Label>
                          {editing ? (
                            <Input
                              id="debtor_birthday"
                              type="date"
                              value={editForm.debtor_birthday}
                              onChange={(e) => setEditForm({ ...editForm, debtor_birthday: e.target.value })}
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.birthday || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="debtor_nation" className="text-sm font-medium text-gray-700">民族</Label>
                          {editing ? (
                            <Input
                              id="debtor_nation"
                              value={editForm.debtor_nation}
                              onChange={(e) => setEditForm({ ...editForm, debtor_nation: e.target.value })}
                              placeholder="请输入民族"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.nation || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="debtor_address" className="text-sm font-medium text-gray-700">住址</Label>
                          {editing ? (
                            <Input
                              id="debtor_address"
                              value={editForm.debtor_address}
                              onChange={(e) => setEditForm({ ...editForm, debtor_address: e.target.value })}
                              placeholder="请输入住址"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.address || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 md:col-span-3">
                          <Label htmlFor="debtor_id_card" className="text-sm font-medium text-gray-700">公民身份号码</Label>
                          {editing ? (
                            <Input
                              id="debtor_id_card"
                              value={editForm.debtor_id_card}
                              onChange={(e) => setEditForm({ ...editForm, debtor_id_card: e.target.value })}
                              placeholder="请输入身份证号"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.id_card || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 公司信息 */}
                {debtorType === 'company' && (
                  <>
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-800 border-l-3 border-orange-400 pl-3 bg-orange-50 py-2 -ml-3">公司信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="debtor_company_name" className="text-sm font-medium text-gray-700">公司名称</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_name"
                              value={editForm.debtor_company_name}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_name: e.target.value })}
                              placeholder="请输入公司名称"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.company_name || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="debtor_company_address" className="text-sm font-medium text-gray-700">住所地</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_address"
                              value={editForm.debtor_company_address}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_address: e.target.value })}
                              placeholder="请输入住所地"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.company_address || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="debtor_company_code" className="text-sm font-medium text-gray-700">统一社会信用代码</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_code"
                              value={editForm.debtor_company_code}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_code: e.target.value })}
                              placeholder="请输入统一社会信用代码"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.company_code || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-800 border-l-3 border-orange-400 pl-3 bg-orange-50 py-2 -ml-3">法定代表人信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="debtor_real_name" className="text-sm font-medium text-gray-700">姓名</Label>
                          {editing ? (
                            <Input
                              id="debtor_real_name"
                              value={editForm.debtor_real_name}
                              onChange={(e) => setEditForm({ ...editForm, debtor_real_name: e.target.value })}
                              placeholder="请输入姓名"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.name || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="debtor_phone" className="text-sm font-medium text-gray-700">联系电话</Label>
                          {editing ? (
                            <Input
                              id="debtor_phone"
                              value={editForm.debtor_phone}
                              onChange={(e) => setEditForm({ ...editForm, debtor_phone: e.target.value })}
                              placeholder="请输入联系电话"
                            />
                          ) : (
                            <div className="p-2.5 bg-gray-50 rounded-md border text-sm">
                              {debtor?.phone || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* 证据链分析组件 */}
      <div>
        <EvidenceChainDashboard
          key={refreshKey}
          caseId={numericCaseId}
        />
      </div>
    </div>
  )
}
