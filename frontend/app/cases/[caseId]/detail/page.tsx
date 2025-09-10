"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Edit, Save, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import { EvidenceChainDashboard } from "@/components/evidence-chain-dashboard"
import { DocumentTemplateSelector } from "@/components/document-template-selector"
import { DocumentGeneratorNew } from "@/components/document-generator-new"
import { DocumentGeneratorV2 } from "@/components/document-generator-v2"
import { DocumentGeneratorSimple } from "@/components/document-generator-simple"
import { caseApi, userApi } from "@/lib/api"
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
  
  // 文书生成相关状态
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false)
  
  // 用户选择相关状态
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userSearchTerm, setUserSearchTerm] = useState("")
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  

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
    creditor_required_name: "", // 债权人必要姓名字段
    creditor_required_company: "", // 债权人必要公司字段
    debtor_required_name: "", // 债务人必要姓名字段
    debtor_required_company: "", // 债务人必要公司字段
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
      creditor_required_name: "",
      creditor_required_company: "",
      debtor_required_name: "",
      debtor_required_company: "",
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

    // 根据当事人类型验证必要字段
    if (editForm.creditor_type) {
      if (editForm.creditor_type === "person") {
        // 个人类型：需要 name（自然人姓名）
        if (!editForm.creditor_real_name?.trim()) {
          errors.creditor_required_name = "请输入自然人姓名";
        }
      } else if (editForm.creditor_type === "individual") {
        // 个体工商户类型：需要 company_name（个体工商户名称）和 name（经营者名称）
        if (!editForm.creditor_company_name?.trim()) {
          errors.creditor_required_company = "请输入个体工商户名称";
        }
        if (!editForm.creditor_real_name?.trim()) {
          errors.creditor_required_name = "请输入经营者名称";
        }
      } else if (editForm.creditor_type === "company") {
        // 公司类型：需要 company_name（公司名称）和 name（法定代表人名称）
        if (!editForm.creditor_company_name?.trim()) {
          errors.creditor_required_company = "请输入公司名称";
        }
        if (!editForm.creditor_real_name?.trim()) {
          errors.creditor_required_name = "请输入法定代表人名称";
        }
      }
    }

    if (editForm.debtor_type) {
      if (editForm.debtor_type === "person") {
        // 个人类型：需要 name（自然人姓名）
        if (!editForm.debtor_real_name?.trim()) {
          errors.debtor_required_name = "请输入自然人姓名";
        }
      } else if (editForm.debtor_type === "individual") {
        // 个体工商户类型：需要 company_name（个体工商户名称）和 name（经营者名称）
        if (!editForm.debtor_company_name?.trim()) {
          errors.debtor_required_company = "请输入个体工商户名称";
        }
        if (!editForm.debtor_real_name?.trim()) {
          errors.debtor_required_name = "请输入经营者名称";
        }
      } else if (editForm.debtor_type === "company") {
        // 公司类型：需要 company_name（公司名称）和 name（法定代表人名称）
        if (!editForm.debtor_company_name?.trim()) {
          errors.debtor_required_company = "请输入公司名称";
        }
        if (!editForm.debtor_real_name?.trim()) {
          errors.debtor_required_name = "请输入法定代表人名称";
        }
      }
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

  // 加载用户列表
  const loadUsers = async () => {
    try {
      setLoadingUsers(true)
      const result = await userApi.getUsers({ page: 1, pageSize: 100 })
      setUsers(result.data)
    } catch (error) {
      console.error('加载用户列表失败:', error)
      toast({
        title: "加载失败",
        description: "无法加载用户列表",
        variant: "destructive"
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  // 用户筛选逻辑
  const filteredUsers = users?.filter(user => {
    if (!userSearchTerm.trim()) return true;
    const searchLower = userSearchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.wechat_nickname?.toLowerCase().includes(searchLower) ||
      user.wechat_number?.toLowerCase().includes(searchLower) ||
      user.id.toString().includes(searchLower)
    );
  }) || [];

  // 处理用户选择
  const handleUserSelect = (user: any) => {
    setEditForm((prev: any) => ({
      ...prev,
      user_id: user.id
    }));
    setUserSearchTerm(user.name || user.wechat_nickname || `用户${user.id}`);
    setShowUserDropdown(false);
  };

  // 点击外部关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserDropdown) {
        const target = event.target as Element;
        const dropdownContainer = document.querySelector('.user-dropdown-container');
        
        if (dropdownContainer && !dropdownContainer.contains(target)) {
          setShowUserDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  // 初始化编辑表单
  useEffect(() => {
    if (caseData && !editing) {
      const creditor = caseData.case_parties?.find((p: any) => p.party_role === "creditor");
      const debtor = caseData.case_parties?.find((p: any) => p.party_role === "debtor");
      
      setEditForm({
        user_id: caseData.user_id || '',
        creditor_name: creditor?.party_name || '',
        debtor_name: debtor?.party_name || '',
        loan_amount: caseData.loan_amount || '',
        case_type: caseData.case_type || '',
        loan_date: caseData.loan_date ? new Date(caseData.loan_date) : undefined,
        court: caseData.court_name || '',
        creditor_type: creditor?.party_type || '',
        debtor_type: debtor?.party_type || '',
        creditor_phone: creditor?.phone || '',
        creditor_bank_account: creditor?.bank_account || '',
        creditor_bank_address: creditor?.bank_address || '',
        debtor_phone: debtor?.phone || '',
        // 扩展字段
        creditor_real_name: creditor?.name || '',
        creditor_gender: creditor?.gender || '',
        creditor_birthday: creditor?.birthday ? new Date(creditor.birthday) : undefined,
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
        debtor_birthday: debtor?.birthday ? new Date(debtor.birthday) : undefined,
        debtor_nation: debtor?.nation || '',
        debtor_address: debtor?.address || '',
        debtor_id_card: debtor?.id_card || '',
        debtor_company_name: debtor?.company_name || '',
        debtor_company_address: debtor?.company_address || '',
        debtor_company_code: debtor?.company_code || '',
      })
      // 设置金额输入值
      setLoanAmountInput(caseData.loan_amount ? caseData.loan_amount.toString() : '')
      // 设置用户搜索词
      setUserSearchTerm(caseData.user?.name || caseData.user?.wechat_nickname || `用户${caseData.user_id}` || '')
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
        user_id: editForm.user_id ? parseInt(editForm.user_id) : undefined,
        loan_amount: loanAmountInput ? parseFloat(loanAmountInput) : undefined,
        case_type: editForm.case_type,
        loan_date: editForm.loan_date ? editForm.loan_date.toISOString() : undefined,
        court_name: editForm.court || undefined,
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
          birthday: editForm.creditor_birthday ? editForm.creditor_birthday.toISOString() : undefined,
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
          birthday: editForm.debtor_birthday ? editForm.debtor_birthday.toISOString() : undefined,
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
        creditor_required_name: "",
        creditor_required_company: "",
        debtor_required_name: "",
        debtor_required_company: "",
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
      <div className="space-y-4">
        {/* 第一行：案件标题和案由标签 */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-foreground">
              {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.party_name || '未设置债权人'} vs {caseData.case_parties?.find((p: any) => p.party_role === "debtor")?.party_name || '未设置债务人'}
          </h1>
          {/* 案由标签 */}
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            {caseData.case_type === 'debt' ? '民间借贷纠纷' : 
             caseData.case_type === 'contract' ? '买卖合同纠纷' : 
             caseData.case_type || '未设置案由'}
          </div>
        </div>
        
        {/* 第二行：时间和按钮 */}
        <div className="flex items-center justify-between">
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
          
          <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/cases")}
          >
            返回案件列表
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/cases/${caseId}`)}
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <FileText className="w-4 h-4 mr-1" />
            证据分析
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDocumentGenerator(true)}
            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
          >
            <FileText className="w-4 h-4 mr-1" />
            生成文书
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
                    loan_date: caseData.loan_date ? new Date(caseData.loan_date) : undefined,
                    court: caseData.court_name || '',
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
                    creditor_required_name: "",
                    creditor_required_company: "",
                    debtor_required_name: "",
                    debtor_required_company: "",
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
      </div>

      {/* 上半部分：案件概览 + 证据链 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 案件概览卡片 */}
        <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
              <div className="relative mr-4">
                <div className="w-3 h-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-lg"></div>
                <div className="absolute inset-0 w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full animate-pulse opacity-60"></div>
              </div>
              <span className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent font-medium tracking-wide">
                案件概览
              </span>
              <div className="ml-auto h-px bg-gradient-to-r from-blue-200 to-transparent flex-1 max-w-16"></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-6">
          {/* 基础信息区域 */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">基础信息</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 第一行：归属用户、案件类型 */}
                  <div className="space-y-1.5">
                  <Label htmlFor="user_id" className="text-sm font-medium text-gray-700">
                    归属用户
                  </Label>
                  {editing ? (
                    <div className="relative">
                      <Input
                        placeholder="搜索或选择用户"
                        value={userSearchTerm}
                        onChange={(e) => {
                          const value = e.target.value;
                          setUserSearchTerm(value);
                          setShowUserDropdown(true);
                          if (users.length === 0) {
                            loadUsers();
                          }
                        }}
                        onFocus={() => {
                          setShowUserDropdown(true);
                          if (users.length === 0) {
                            loadUsers();
                          }
                        }}
                        className="h-9"
                      />
                      
                      {/* 用户下拉列表 */}
                      {showUserDropdown && (
                        <div className="user-dropdown-container absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {loadingUsers ? (
                            <div className="px-3 py-2 text-gray-500 text-sm">加载中...</div>
                          ) : filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                              <div
                                key={user.id}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                                onClick={() => handleUserSelect(user)}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-sm">
                                      {user.name || user.wechat_nickname || `用户${user.id}`}
                                    </div>
                                    {user.wechat_number && (
                                      <div className="text-xs text-gray-500">
                                        微信号: {user.wechat_number}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                              {userSearchTerm.trim() ? '未找到匹配的用户' : '开始输入搜索用户...'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                      {caseData.user?.name || caseData.user?.wechat_nickname || `用户${caseData.user_id}` || '未设置'}
                    </div>
                  )}
                </div>

                  <div className="space-y-1.5">
                  <Label htmlFor="case_type" className="text-sm font-medium text-gray-700">
                    案由 <span className="text-red-500">*</span>
                  </Label>
                  {editing ? (
                    <Select
                      value={editForm.case_type || ""}
                      onValueChange={(value: string) => setEditForm({ ...editForm, case_type: value as CaseType })}
                    >
                        <SelectTrigger className={`h-9 ${formErrors.case_type ? "border-red-500" : ""}`}>
                        <SelectValue placeholder="选择案由" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debt">民间借贷纠纷</SelectItem>
                        <SelectItem value="contract">买卖合同纠纷</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                      <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                      {caseData.case_type === 'debt' ? '民间借贷纠纷' : 
                       caseData.case_type === 'contract' ? '买卖合同纠纷' : '未设置'}
                    </div>
                  )}
                  {formErrors.case_type && (
                    <div className="text-red-500 text-xs">{formErrors.case_type}</div>
                  )}
                </div>

                  {/* 第二行：欠款金额、欠款日期 */}
                  <div className="space-y-1.5">
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
                        className={`h-9 ${formErrors.loan_amount ? "border-red-500" : ""} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    />
                  ) : (
                      <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                      {caseData.loan_amount ? `¥${caseData.loan_amount.toLocaleString()}` : '未设置'}
                    </div>
                  )}
                  {formErrors.loan_amount && (
                    <div className="text-red-500 text-xs">{formErrors.loan_amount}</div>
                  )}
                </div>

                  {/* 第三行：欠款日期、开庭法院 */}
                  <div className="space-y-1.5">
                    <Label htmlFor="loan_date" className="text-sm font-medium text-gray-700">欠款日期</Label>
                    {editing ? (
                      <DatePicker
                        id="loan_date"
                        value={editForm.loan_date}
                        onChange={(date) => setEditForm({ ...editForm, loan_date: date })}
                        placeholder="选择欠款日期"
                        className="h-9"
                      />
                    ) : (
                      <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                        {editForm.loan_date ? editForm.loan_date.toLocaleDateString('zh-CN') : '未设置'}
                      </div>
                    )}
            </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="court" className="text-sm font-medium text-gray-700">开庭法院</Label>
                    {editing ? (
                      <Input
                        id="court"
                        value={editForm.court || ''}
                        onChange={(e) => setEditForm({ ...editForm, court: e.target.value })}
                        placeholder="请输入开庭法院"
                        className="h-9"
                      />
                    ) : (
                      <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                        {editForm.court || '未设置'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

          {/* 收款信息区域 */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">收款信息</h4>
            <div className="space-y-4">
              {/* 第一行：银行账户（全宽） */}
              <div className="space-y-1.5">
                <Label htmlFor="creditor_bank_account" className="text-sm font-medium text-gray-700">银行账户</Label>
                {editing ? (
                  <Input
                    id="creditor_bank_account"
                    value={editForm.creditor_bank_account || ''}
                    onChange={(e) => setEditForm({ ...editForm, creditor_bank_account: e.target.value })}
                    placeholder="请输入银行账户"
                    className="h-9"
                  />
                ) : (
                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                    {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.bank_account || '未设置'}
                  </div>
                )}
              </div>

              {/* 第二行：开户支行和开户人（并排显示） */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="creditor_bank_address" className="text-sm font-medium text-gray-700">开户支行</Label>
                  {editing ? (
                    <Input
                      id="creditor_bank_address"
                      value={editForm.creditor_bank_address || ''}
                      onChange={(e) => setEditForm({ ...editForm, creditor_bank_address: e.target.value })}
                      placeholder="请输入开户支行"
                      className="h-9"
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                      {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.bank_address || '未设置'}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="creditor_bank_account_holder" className="text-sm font-medium text-gray-700">开户人</Label>
                  {editing ? (
                    <Input
                      id="creditor_bank_account_holder"
                      value={editForm.creditor_owner_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, creditor_owner_name: e.target.value })}
                      placeholder="请输入开户人"
                      className="h-9"
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                      {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.owner_name || '未设置'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        </Card>

        {/* 证据链卡片 */}
        <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-green-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
              <div className="relative mr-4">
                <div className="w-3 h-3 bg-gradient-to-br from-green-500 to-green-600 rounded-full shadow-lg"></div>
                <div className="absolute inset-0 w-3 h-3 bg-gradient-to-br from-green-400 to-green-500 rounded-full animate-pulse opacity-60"></div>
              </div>
              <span className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent font-medium tracking-wide">
                证据链进度
              </span>
              <div className="ml-auto h-px bg-gradient-to-r from-green-200 to-transparent flex-1 max-w-16"></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-6">
            <EvidenceChainDashboard
              key={refreshKey}
              caseId={numericCaseId}
            />
          </CardContent>
        </Card>
      </div>

      {/* 下半部分：当事人信息双栏布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：债权人信息 */}
        <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
              <div className="relative mr-4">
                <div className="w-3 h-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-lg"></div>
                <div className="absolute inset-0 w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full animate-pulse opacity-60"></div>
              </div>
              <span className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent font-medium tracking-wide">
                债权人信息
              </span>
              <div className="ml-auto h-px bg-gradient-to-r from-blue-200 to-transparent flex-1 max-w-16"></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-5">
            {/* 基本信息 */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">基本信息</h4>
              <div className="grid grid-cols-1 gap-3">
                  {/* 债权人姓名 */}
                  <div className="space-y-1.5">
                    <Label htmlFor="creditor" className="text-sm font-medium text-gray-700">
                      债权人名称 <span className="text-red-500">*</span>
                    </Label>
                    {editing ? (
                      <Input
                        id="creditor"
                        value={editForm.creditor_name}
                        onChange={(e) => setEditForm({ ...editForm, creditor_name: e.target.value })}
                        placeholder="请输入债权人姓名"
                      className={`h-9 ${formErrors.creditor_name ? "border-red-500" : ""}`}
                      />
                    ) : (
                    <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                        {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.party_name || '未设置'}
                      </div>
                    )}
                    {formErrors.creditor_name && (
                      <div className="text-red-500 text-xs">{formErrors.creditor_name}</div>
                    )}
                  </div>

                {/* 债权人类型和联系电话 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="creditor_type" className="text-sm font-medium text-gray-700">
                      债权人类型 <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        {editing ? (
                          <Select
                            value={editForm.creditor_type || ""}
                            onValueChange={(value: string) => setEditForm({ ...editForm, creditor_type: value as PartyType })}
                          >
                            <SelectTrigger className={`h-9 ${formErrors.creditor_type ? "border-red-500" : ""}`}>
                              <SelectValue placeholder="选择债权人类型" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="person">个人</SelectItem>
                              <SelectItem value="company">公司</SelectItem>
                              <SelectItem value="individual">个体工商户</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                            {(() => {
                              const creditorType = caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.party_type;
                              return creditorType === 'person' ? '个人' : 
                                     creditorType === 'company' ? '公司' : 
                                     creditorType === 'individual' ? '个体工商户' : '未设置';
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                    {formErrors.creditor_type && (
                      <div className="text-red-500 text-xs">{formErrors.creditor_type}</div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="creditor_phone" className="text-sm font-medium text-gray-700">联系电话</Label>
                    {editing ? (
                      <Input
                        id="creditor_phone"
                        value={editForm.creditor_phone}
                        onChange={(e) => setEditForm({ ...editForm, creditor_phone: e.target.value })}
                        placeholder="请输入联系电话"
                        className="h-9"
                      />
                    ) : (
                      <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                        {caseData.case_parties?.find((p: any) => p.party_role === "creditor")?.phone || '未设置'}
                      </div>
                    )}
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
                        <div className="space-y-3">
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">身份信息</h4>
                          <div className="grid grid-cols-1 gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_real_name" className="text-sm font-medium text-gray-700">姓名 <span className="text-red-500">*</span></Label>
                                {editing ? (
                                  <Input
                                    id="creditor_real_name"
                                    value={editForm.creditor_real_name || ''}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_real_name: e.target.value })}
                                    placeholder="请输入姓名"
                                    className={`h-9 ${formErrors.creditor_required_name ? 'border-red-500' : ''}`}
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.name || '未设置'}
                                  </div>
                                )}
                                {formErrors.creditor_required_name && (
                                  <div className="text-red-500 text-xs">{formErrors.creditor_required_name}</div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_gender" className="text-sm font-medium text-gray-700">性别</Label>
                                {editing ? (
                                  <Select
                                    value={editForm.creditor_gender || ""}
                                    onValueChange={(value: string) => setEditForm({ ...editForm, creditor_gender: value })}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="选择性别" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="男">男</SelectItem>
                                      <SelectItem value="女">女</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.gender || '未设置'}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_birthday" className="text-sm font-medium text-gray-700">出生</Label>
                                {editing ? (
                                  <DatePicker
                                    id="creditor_birthday"
                                    value={editForm.creditor_birthday}
                                    onChange={(date) => setEditForm({ ...editForm, creditor_birthday: date })}
                                    placeholder="选择出生日期"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.birthday ? new Date(creditor.birthday).toLocaleDateString('zh-CN') : '未设置'}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_nation" className="text-sm font-medium text-gray-700">民族</Label>
                                {editing ? (
                                  <Input
                                    id="creditor_nation"
                                    value={editForm.creditor_nation}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_nation: e.target.value })}
                                    placeholder="请输入民族"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.nation || '未设置'}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="creditor_address" className="text-sm font-medium text-gray-700">住址</Label>
                              {editing ? (
                                <Input
                                  id="creditor_address"
                                  value={editForm.creditor_address}
                                  onChange={(e) => setEditForm({ ...editForm, creditor_address: e.target.value })}
                                  placeholder="请输入住址"
                                  className="h-9"
                                />
                              ) : (
                                <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                  {creditor?.address || '未设置'}
                                </div>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="creditor_id_card" className="text-sm font-medium text-gray-700">公民身份号码</Label>
                              {editing ? (
                                <Input
                                  id="creditor_id_card"
                                  value={editForm.creditor_id_card}
                                  onChange={(e) => setEditForm({ ...editForm, creditor_id_card: e.target.value })}
                                  placeholder="请输入身份证号"
                                  className="h-9"
                                />
                              ) : (
                                <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
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
                          <div className="space-y-3">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">个体工商户信息</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_company_name" className="text-sm font-medium text-gray-700">经营名称 <span className="text-red-500">*</span></Label>
                                {editing ? (
                                  <Input
                                    id="creditor_company_name"
                                    value={editForm.creditor_company_name}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_company_name: e.target.value })}
                                    placeholder="请输入经营名称"
                                    className={`h-9 ${formErrors.creditor_required_company ? 'border-red-500' : ''}`}
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.company_name || '未设置'}
                                  </div>
                                )}
                                {formErrors.creditor_required_company && (
                                  <div className="text-red-500 text-xs">{formErrors.creditor_required_company}</div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_company_address" className="text-sm font-medium text-gray-700">住所地</Label>
                                {editing ? (
                                  <Input
                                    id="creditor_company_address"
                                    value={editForm.creditor_company_address}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_company_address: e.target.value })}
                                    placeholder="请输入住所地"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.company_address || '未设置'}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor="creditor_company_code" className="text-sm font-medium text-gray-700">统一社会信用代码</Label>
                                {editing ? (
                                  <Input
                                    id="creditor_company_code"
                                    value={editForm.creditor_company_code}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_company_code: e.target.value })}
                                    placeholder="请输入统一社会信用代码"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.company_code || '未设置'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">经营者信息</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_real_name" className="text-sm font-medium text-gray-700">姓名 <span className="text-red-500">*</span></Label>
                                {editing ? (
                                  <Input
                                    id="creditor_real_name"
                                    value={editForm.creditor_real_name || ''}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_real_name: e.target.value })}
                                    placeholder="请输入姓名"
                                    className={`h-9 ${formErrors.creditor_required_name ? 'border-red-500' : ''}`}
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.name || '未设置'}
                                  </div>
                                )}
                                {formErrors.creditor_required_name && (
                                  <div className="text-red-500 text-xs">{formErrors.creditor_required_name}</div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_gender" className="text-sm font-medium text-gray-700">性别</Label>
                                {editing ? (
                                  <Select
                                    value={editForm.creditor_gender || ""}
                                    onValueChange={(value: string) => setEditForm({ ...editForm, creditor_gender: value })}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="选择性别" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="男">男</SelectItem>
                                      <SelectItem value="女">女</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.gender || '未设置'}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_birthday" className="text-sm font-medium text-gray-700">出生</Label>
                                {editing ? (
                                  <DatePicker
                                    id="creditor_birthday"
                                    value={editForm.creditor_birthday}
                                    onChange={(date) => setEditForm({ ...editForm, creditor_birthday: date })}
                                    placeholder="选择出生日期"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.birthday ? new Date(creditor.birthday).toLocaleDateString('zh-CN') : '未设置'}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_nation" className="text-sm font-medium text-gray-700">民族</Label>
                                {editing ? (
                                  <Input
                                    id="creditor_nation"
                                    value={editForm.creditor_nation}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_nation: e.target.value })}
                                    placeholder="请输入民族"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.nation || '未设置'}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor="creditor_address" className="text-sm font-medium text-gray-700">住址</Label>
                                {editing ? (
                                  <Input
                                    id="creditor_address"
                                    value={editForm.creditor_address}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_address: e.target.value })}
                                    placeholder="请输入住址"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.address || '未设置'}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor="creditor_id_card" className="text-sm font-medium text-gray-700">公民身份号码</Label>
                                {editing ? (
                                  <Input
                                    id="creditor_id_card"
                                    value={editForm.creditor_id_card}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_id_card: e.target.value })}
                                    placeholder="请输入身份证号"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
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
                          <div className="space-y-3">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">公司信息</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_company_name" className="text-sm font-medium text-gray-700">公司名称 <span className="text-red-500">*</span></Label>
                                {editing ? (
                                  <Input
                                    id="creditor_company_name"
                                    value={editForm.creditor_company_name}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_company_name: e.target.value })}
                                    placeholder="请输入公司名称"
                                    className={`h-9 ${formErrors.creditor_required_company ? 'border-red-500' : ''}`}
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.company_name || '未设置'}
                                  </div>
                                )}
                                {formErrors.creditor_required_company && (
                                  <div className="text-red-500 text-xs">{formErrors.creditor_required_company}</div>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_company_address" className="text-sm font-medium text-gray-700">住所地</Label>
                                {editing ? (
                                  <Input
                                    id="creditor_company_address"
                                    value={editForm.creditor_company_address}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_company_address: e.target.value })}
                                    placeholder="请输入住所地"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.company_address || '未设置'}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor="creditor_company_code" className="text-sm font-medium text-gray-700">统一社会信用代码</Label>
                                {editing ? (
                                  <Input
                                    id="creditor_company_code"
                                    value={editForm.creditor_company_code}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_company_code: e.target.value })}
                                    placeholder="请输入统一社会信用代码"
                                    className="h-9"
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.company_code || '未设置'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">法定代表人信息</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="creditor_real_name" className="text-sm font-medium text-gray-700">姓名 <span className="text-red-500">*</span></Label>
                                {editing ? (
                                  <Input
                                    id="creditor_real_name"
                                    value={editForm.creditor_real_name || ''}
                                    onChange={(e) => setEditForm({ ...editForm, creditor_real_name: e.target.value })}
                                    placeholder="请输入姓名"
                                    className={`h-9 ${formErrors.creditor_required_name ? 'border-red-500' : ''}`}
                                  />
                                ) : (
                                  <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                                    {creditor?.name || '未设置'}
                                  </div>
                                )}
                                {formErrors.creditor_required_name && (
                                  <div className="text-red-500 text-xs">{formErrors.creditor_required_name}</div>
                                )}
                              </div>

                            </div>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

          </CardContent>
        </Card>



              {/* 右侧：债务人信息 */}
        <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-orange-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
              <div className="relative mr-4">
                <div className="w-3 h-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full shadow-lg"></div>
                <div className="absolute inset-0 w-3 h-3 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full animate-pulse opacity-60"></div>
              </div>
              <span className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent font-medium tracking-wide">
                债务人信息
              </span>
              <div className="ml-auto h-px bg-gradient-to-r from-orange-200 to-transparent flex-1 max-w-16"></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-5">
            {/* 基本信息 */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">基本信息</h4>
              <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="debtor" className="text-sm font-medium text-gray-700">
                      债务人名称 <span className="text-red-500">*</span>
                    </Label>
                    {editing ? (
                      <Input
                        id="debtor"
                        value={editForm.debtor_name}
                        onChange={(e) => setEditForm({ ...editForm, debtor_name: e.target.value })}
                        placeholder="请输入债务人姓名"
                      className={`h-9 ${formErrors.debtor_name ? "border-red-500" : ""}`}
                      />
                    ) : (
                    <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                        {caseData.case_parties?.find((p: any) => p.party_role === "debtor")?.party_name || '未设置'}
                      </div>
                    )}
                    {formErrors.debtor_name && (
                      <div className="text-red-500 text-xs">{formErrors.debtor_name}</div>
                    )}
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="debtor_type" className="text-sm font-medium text-gray-700">
                      债务人类型 <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        {editing ? (
                          <Select
                            value={editForm.debtor_type || ""}
                            onValueChange={(value: string) => setEditForm({ ...editForm, debtor_type: value as PartyType })}
                          >
                            <SelectTrigger className={`h-9 ${formErrors.debtor_type ? "border-red-500" : ""}`}>
                              <SelectValue placeholder="选择债务人类型" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="person">个人</SelectItem>
                              <SelectItem value="company">公司</SelectItem>
                              <SelectItem value="individual">个体工商户</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                            {(() => {
                              const debtorType = caseData.case_parties?.find((p: any) => p.party_role === "debtor")?.party_type;
                              return debtorType === 'person' ? '个人' : 
                                     debtorType === 'company' ? '公司' : 
                                     debtorType === 'individual' ? '个体工商户' : '未设置';
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                    {formErrors.debtor_type && (
                      <div className="text-red-500 text-xs">{formErrors.debtor_type}</div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="debtor_phone" className="text-sm font-medium text-gray-700">联系电话</Label>
                    {editing ? (
                      <Input
                        id="debtor_phone"
                        value={editForm.debtor_phone}
                        onChange={(e) => setEditForm({ ...editForm, debtor_phone: e.target.value })}
                        placeholder="请输入联系电话"
                        className="h-9"
                      />
                    ) : (
                      <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                        {caseData.case_parties?.find((p: any) => p.party_role === "debtor")?.phone || '未设置'}
                      </div>
                    )}
                  </div>
                </div>

            {/* 身份信息 */}
            {(() => {
              const debtor = caseData.case_parties?.find((p: any) => p.party_role === "debtor");
              const debtorType = editing ? editForm.debtor_type : debtor?.party_type;
              
              if (debtorType === 'person') {
                return (
                  <div className="space-y-3">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">身份信息</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_real_name" className="text-sm font-medium text-gray-700">姓名 <span className="text-red-500">*</span></Label>
                          {editing ? (
                            <Input
                              id="debtor_real_name"
                              value={editForm.debtor_real_name}
                              onChange={(e) => setEditForm({ ...editForm, debtor_real_name: e.target.value })}
                              placeholder="请输入姓名"
                              className={`h-9 ${formErrors.debtor_required_name ? 'border-red-500' : ''}`}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.name || '未设置'}
                            </div>
                          )}
                          {formErrors.debtor_required_name && (
                            <div className="text-red-500 text-xs">{formErrors.debtor_required_name}</div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_gender" className="text-sm font-medium text-gray-700">性别</Label>
                          {editing ? (
                            <Select
                              value={editForm.debtor_gender || ""}
                              onValueChange={(value: string) => setEditForm({ ...editForm, debtor_gender: value })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="选择性别" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="男">男</SelectItem>
                                <SelectItem value="女">女</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.gender || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_nation" className="text-sm font-medium text-gray-700">民族</Label>
                          {editing ? (
                            <Input
                              id="debtor_nation"
                              value={editForm.debtor_nation}
                              onChange={(e) => setEditForm({ ...editForm, debtor_nation: e.target.value })}
                              placeholder="请输入民族"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.nation || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_birthday" className="text-sm font-medium text-gray-700">出生</Label>
                          {editing ? (
                            <DatePicker
                              id="debtor_birthday"
                              value={editForm.debtor_birthday}
                              onChange={(date) => setEditForm({ ...editForm, debtor_birthday: date })}
                              placeholder="选择出生日期"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.birthday ? new Date(debtor.birthday).toLocaleDateString('zh-CN') : '未设置'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="debtor_address" className="text-sm font-medium text-gray-700">住址</Label>
                        {editing ? (
                          <Input
                            id="debtor_address"
                            value={editForm.debtor_address}
                            onChange={(e) => setEditForm({ ...editForm, debtor_address: e.target.value })}
                            placeholder="请输入住址"
                            className="h-9"
                          />
                        ) : (
                          <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                            {debtor?.address || '未设置'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="debtor_id_card" className="text-sm font-medium text-gray-700">公民身份号码</Label>
                        {editing ? (
                          <Input
                            id="debtor_id_card"
                            value={editForm.debtor_id_card}
                            onChange={(e) => setEditForm({ ...editForm, debtor_id_card: e.target.value })}
                            placeholder="请输入公民身份号码"
                            className="h-9"
                          />
                        ) : (
                          <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                            {debtor?.id_card || '未设置'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              } else if (debtorType === 'company') {
                return (
                  <>
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">公司信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_company_name" className="text-sm font-medium text-gray-700">公司名称 <span className="text-red-500">*</span></Label>
                          {editing ? (
                            <Input
                              id="debtor_company_name"
                              value={editForm.debtor_company_name}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_name: e.target.value })}
                              placeholder="请输入公司名称"
                              className={`h-9 ${formErrors.debtor_required_company ? 'border-red-500' : ''}`}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.company_name || '未设置'}
                            </div>
                          )}
                          {formErrors.debtor_required_company && (
                            <div className="text-red-500 text-xs">{formErrors.debtor_required_company}</div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_company_address" className="text-sm font-medium text-gray-700">住所地</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_address"
                              value={editForm.debtor_company_address}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_address: e.target.value })}
                              placeholder="请输入住所地"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.company_address || '未设置'}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="debtor_company_code" className="text-sm font-medium text-gray-700">统一社会信用代码</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_code"
                              value={editForm.debtor_company_code}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_code: e.target.value })}
                              placeholder="请输入统一社会信用代码"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.company_code || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">法定代表人信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_real_name" className="text-sm font-medium text-gray-700">姓名 <span className="text-red-500">*</span></Label>
                          {editing ? (
                            <Input
                              id="debtor_real_name"
                              value={editForm.debtor_real_name}
                              onChange={(e) => setEditForm({ ...editForm, debtor_real_name: e.target.value })}
                              placeholder="请输入姓名"
                              className={`h-9 ${formErrors.debtor_required_name ? 'border-red-500' : ''}`}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.name || '未设置'}
                            </div>
                          )}
                          {formErrors.debtor_required_name && (
                            <div className="text-red-500 text-xs">{formErrors.debtor_required_name}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              } else if (debtorType === 'individual') {
                return (
                  <>
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">个体工商户信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_company_name" className="text-sm font-medium text-gray-700">经营名称 <span className="text-red-500">*</span></Label>
                          {editing ? (
                            <Input
                              id="debtor_company_name"
                              value={editForm.debtor_company_name}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_name: e.target.value })}
                              placeholder="请输入经营名称"
                              className={`h-9 ${formErrors.debtor_required_company ? 'border-red-500' : ''}`}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.company_name || '未设置'}
                            </div>
                          )}
                          {formErrors.debtor_required_company && (
                            <div className="text-red-500 text-xs">{formErrors.debtor_required_company}</div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_company_address" className="text-sm font-medium text-gray-700">住所地</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_address"
                              value={editForm.debtor_company_address}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_address: e.target.value })}
                              placeholder="请输入住所地"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.company_address || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="debtor_company_code" className="text-sm font-medium text-gray-700">统一社会信用代码</Label>
                          {editing ? (
                            <Input
                              id="debtor_company_code"
                              value={editForm.debtor_company_code}
                              onChange={(e) => setEditForm({ ...editForm, debtor_company_code: e.target.value })}
                              placeholder="请输入统一社会信用代码"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.company_code || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-100 pb-1">经营者信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_real_name" className="text-sm font-medium text-gray-700">姓名 <span className="text-red-500">*</span></Label>
                          {editing ? (
                            <Input
                              id="debtor_real_name"
                              value={editForm.debtor_real_name}
                              onChange={(e) => setEditForm({ ...editForm, debtor_real_name: e.target.value })}
                              placeholder="请输入姓名"
                              className={`h-9 ${formErrors.debtor_required_name ? 'border-red-500' : ''}`}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.name || '未设置'}
                            </div>
                          )}
                          {formErrors.debtor_required_name && (
                            <div className="text-red-500 text-xs">{formErrors.debtor_required_name}</div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_gender" className="text-sm font-medium text-gray-700">性别</Label>
                          {editing ? (
                            <Select
                              value={editForm.debtor_gender || ""}
                              onValueChange={(value: string) => setEditForm({ ...editForm, debtor_gender: value })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="选择性别" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="男">男</SelectItem>
                                <SelectItem value="女">女</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.gender || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_birthday" className="text-sm font-medium text-gray-700">出生</Label>
                          {editing ? (
                            <DatePicker
                              id="debtor_birthday"
                              value={editForm.debtor_birthday}
                              onChange={(date) => setEditForm({ ...editForm, debtor_birthday: date })}
                              placeholder="选择出生日期"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.birthday ? new Date(debtor.birthday).toLocaleDateString('zh-CN') : '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="debtor_nation" className="text-sm font-medium text-gray-700">民族</Label>
                          {editing ? (
                            <Input
                              id="debtor_nation"
                              value={editForm.debtor_nation}
                              onChange={(e) => setEditForm({ ...editForm, debtor_nation: e.target.value })}
                              placeholder="请输入民族"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.nation || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="debtor_address" className="text-sm font-medium text-gray-700">住址</Label>
                          {editing ? (
                            <Input
                              id="debtor_address"
                              value={editForm.debtor_address}
                              onChange={(e) => setEditForm({ ...editForm, debtor_address: e.target.value })}
                              placeholder="请输入住址"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.address || '未设置'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="debtor_id_card" className="text-sm font-medium text-gray-700">公民身份号码</Label>
                          {editing ? (
                            <Input
                              id="debtor_id_card"
                              value={editForm.debtor_id_card}
                              onChange={(e) => setEditForm({ ...editForm, debtor_id_card: e.target.value })}
                              placeholder="请输入公民身份号码"
                              className="h-9"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded-md border text-sm h-9 flex items-center">
                              {debtor?.id_card || '未设置'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              }
              return null;
            })()}
              </div>
            </div>
        </CardContent>
      </Card>
      </div>

      {/* 新文书生成器 */}
      {showDocumentGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <DocumentGeneratorSimple
              caseId={numericCaseId}
              onClose={() => setShowDocumentGenerator(false)}
            />
          </div>
        </div>
      )}

    </div>
  )
}
