"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, CheckCircle } from "lucide-react";
import { caseApi } from "@/lib/api";
import { userApi } from "@/lib/user-api";
import { API_CONFIG } from "@/lib/config";

// Helper functions for API calls
function getAuthHeader(): Record<string, string> {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(API_CONFIG.TOKEN_KEY) || ''
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  return {}
}

function buildApiUrl(path: string): string {
  return API_CONFIG.BASE_URL + path
}
import { ListPage } from "@/components/common/list-page";
import { usePaginatedSWR } from "@/hooks/use-paginated-swr";
import { SortableHeader, formatDateTime, type SortDirection } from "@/components/common/sortable-header";
import type { Case, User, CaseType, PartyType } from "@/lib/types";

const caseTypeLabels = {
  debt: "民间借贷纠纷",
  contract: "买卖合同纠纷",
};

const partyTypeLabels = {
  person: "个人",
  company: "公司",
  individual: "个体工商户",
};

export default function CaseManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [userForm, setUserForm] = useState({
    name: "",
    wechat_nickname: "",
    wechat_number: "",
  });

  const [userFormErrors, setUserFormErrors] = useState({
    name: "",
    wechat_nickname: "",
    wechat_number: "",
  });

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // 从 localStorage 恢复排序状态，避免页面刷新后丢失
  const getInitialSort = () => {
    if (typeof window !== 'undefined') {
      const savedSort = localStorage.getItem('case-management-sort');
      if (savedSort) {
        try {
          return JSON.parse(savedSort);
        } catch (e) {
          console.warn('Failed to parse saved sort state:', e);
        }
      }
    }
    return { field: "created_at", direction: "desc" as SortDirection };
  };
  
  const [sort, setSort] = useState<{ field: string; direction: SortDirection }>(getInitialSort);

  // Initialize user filter from URL params
  useEffect(() => {
    const userId = searchParams.get('user_id');
    if (userId) {
      setSelectedUserId(userId);
    }
  }, [searchParams]);

  // 初始化表单状态
  const [addForm, setAddForm] = useState({
    user_id: 0,
    creditor_name: "",
    debtor_name: "",
    loan_amount: 0,
    case_type: null as null | CaseType,
    creditor_type: null as null | PartyType,
    debtor_type: null as null | PartyType,
    creditor_phone: "",
    creditor_bank_account: "",
    creditor_bank_address: "",
    debtor_phone: "",
  });

  // 临时存储输入的金额字符串，用于显示
  const [loanAmountInput, setLoanAmountInput] = useState("");

  // 表单验证状态
  const [addFormErrors, setAddFormErrors] = useState({
    user_id: "",
    creditor_name: "",
    debtor_name: "",
    loan_amount: "",
    creditor_type: "",
    debtor_type: "",
    case_type: "",
  });

  // Use paginated SWR hook with user filter and sorting
  const {
    data: cases,
    loading,
    error,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    mutate
  } = usePaginatedSWR<Case>(
    "/cases",
    (params) => {
      // Add user_id filter and sorting parameters
      const apiParams: any = {
        ...params,
        sort_by: sort.field,
        sort_order: sort.direction || "desc" // 提供默认值，避免null
      };
      if (selectedUserId) {
        apiParams.user_id = parseInt(selectedUserId);
      }
      return caseApi.getCases(apiParams);
    },
    [selectedUserId, sort.field, sort.direction], // Add sorting as dependencies
    20, // initialPageSize
    {
      // 优化刷新策略：避免不必要的重新获取
      revalidateOnFocus: false,      // 页面获得焦点时不重新验证
      revalidateOnReconnect: false,  // 网络重连时不重新验证
      revalidateIfStale: false,      // 数据过期时不自动重新验证
      dedupingInterval: 30000,       // 30秒内重复请求会被去重
    }
  );

  const handleSort = (field: string, direction: SortDirection) => {
    const newSort = { field, direction };
    setSort(newSort);
    // 保存排序状态到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('case-management-sort', JSON.stringify(newSort));
    }
  };

  // 移除客户端排序逻辑，使用服务端排序
  const sortedCases = cases || [];

  // Fetch users for dropdown
  const {
    data: users,
    mutate: mutateUsers
  } = usePaginatedSWR<User>(
    "/users",
    (params) => userApi.getUsers(params),
    [],
    100,
    {
      // 用户列表不需要频繁刷新
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000, // 1分钟内重复请求会被去重
    }
  );

  // 初始化时设置金额输入值
  useEffect(() => {
    if (addForm.loan_amount > 0) {
      setLoanAmountInput(addForm.loan_amount.toString());
    }
  }, [addForm.loan_amount]);

  // 重置表单时也要修改
  // 验证函数
  const validateAddForm = () => {
    const errors = {
      user_id: "",
      creditor_name: "",
      debtor_name: "",
      loan_amount: "",
      creditor_type: "",
      debtor_type: "",
      case_type: "",
    };

    if (!addForm.user_id || addForm.user_id === 0) {
      errors.user_id = "请选择关联用户";
    }
    if (!addForm.creditor_name.trim()) {
      errors.creditor_name = "请输入债权人姓名";
    }
    if (!addForm.debtor_name.trim()) {
      errors.debtor_name = "请输入债务人姓名";
    }
    if (!addForm.loan_amount || addForm.loan_amount <= 0) {
      errors.loan_amount = "请输入有效的欠款金额";
    }
    if (!addForm.creditor_type) {
      errors.creditor_type = "请选择债权人类型";
    }
    if (!addForm.debtor_type) {
      errors.debtor_type = "请选择债务人类型";
    }
    if (!addForm.case_type) {
      errors.case_type = "请选择案件类型";
    }

    setAddFormErrors(errors);
    return Object.values(errors).every(error => error === "");
  };

  const handleAddCase = async () => {
    if (!validateAddForm()) {
      return;
    }

    try {
      await caseApi.createCase(addForm);
      setShowAddDialog(false);
      setAddForm({
        user_id: 0,
        creditor_name: "",
        debtor_name: "",
        loan_amount: 0,
        case_type: null,
        creditor_type: null,
        debtor_type: null,
        creditor_phone: "",
        creditor_bank_account: "",
        creditor_bank_address: "",
        debtor_phone: "",
      });
      setLoanAmountInput("");
      setAddFormErrors({
        user_id: "",
        creditor_name: "",
        debtor_name: "",
        loan_amount: "",
        creditor_type: "",
        debtor_type: "",
        case_type: "",
      });
      
      // 重置排序为创建时间倒序，确保新案件显示在最前面
      const newSort = { field: "created_at", direction: "desc" as SortDirection };
      setSort(newSort);
      if (typeof window !== 'undefined') {
        localStorage.setItem('case-management-sort', JSON.stringify(newSort));
      }
      
      // 显示刷新loading状态
      setIsRefreshing(true);
      
      // 强制刷新案件列表数据
      await mutate();
      
      // 隐藏刷新loading状态
      setIsRefreshing(false);
      
      // 显示成功提示（可选）
      console.log("案件创建成功，列表已刷新，排序已重置");
    } catch (error) {
      console.error("Failed to create case:", error);
    }
  };

  const openAddDialog = () => {
    setShowAddDialog(true);
  };

  const handleCreateUser = () => {
    setUserForm({
      name: "",
      wechat_nickname: "",
      wechat_number: "",
    });
    setUserFormErrors({
      name: "",
      wechat_nickname: "",
      wechat_number: "",
    });
    setShowUserDialog(true);
  };

  const validateUserForm = () => {
    const errors = {
      name: "",
      wechat_nickname: "",
      wechat_number: "",
    };

    if (!userForm.name.trim()) {
      errors.name = "请输入用户姓名";
    }

    setUserFormErrors(errors);
    return !errors.name;
  };

  const handleSubmitUser = async () => {
    if (!validateUserForm()) {
      return;
    }

    try {
      const newUser = await userApi.createUser({
        name: userForm.name,
        wechat_nickname: userForm.wechat_nickname,
        wechat_number: userForm.wechat_number,
      });

      // 显示刷新loading状态
      setIsRefreshing(true);
      
      // 刷新用户列表
      await mutateUsers();

      // 设置新创建的用户为选中用户
      setAddForm(prev => ({
        ...prev,
        user_id: Number(newUser.data.id)
      }));

      // 隐藏刷新loading状态
      setIsRefreshing(false);

      // 关闭弹窗
      setShowUserDialog(false);
    } catch (error) {
      console.error("Failed to create user:", error);
    }
  };

  const handleUserChange = (userId: string) => {
    const selectedUser = users?.find(u => u.id === parseInt(userId));
    setAddForm(prev => ({
      ...prev,
      user_id: parseInt(userId),
      creditor_name: selectedUser?.name || "",
    }));
  };

  const handleViewCase = (caseId: number) => {
    router.push(`/cases/${caseId}`);
  };

  const handleViewEvidenceChain = (caseId: number) => {
    router.push(`/cases/${caseId}/detail`);
  };

  const handleUserFilterChange = (userId: string) => {
    setSelectedUserId(userId === "all" ? null : userId);
    setPage(1); // Reset to first page when filter changes
  };

  const clearUserFilter = () => {
    setSelectedUserId(null);
    setPage(1);
    // Update URL to remove user_id parameter
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('user_id');
    router.replace(`/cases?${newSearchParams.toString()}`);
  };

  const getSelectedUserName = () => {
    if (!selectedUserId) return null;
    return users?.find(u => u.id === parseInt(selectedUserId))?.name;
  };

  // 修改表格渲染逻辑
  const renderTable = (cases: Case[]) => {
    const sortedCases = cases;

    return (
      <>
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">关联用户</TableHead>
                <TableHead className="whitespace-nowrap">欠款金额</TableHead>
                <TableHead className="whitespace-nowrap">案件类型</TableHead>
                <TableHead className="whitespace-nowrap">债权人</TableHead>
                <TableHead className="whitespace-nowrap">债权人类型</TableHead>
                <TableHead className="whitespace-nowrap">债务人</TableHead>
                <TableHead className="whitespace-nowrap">债务人类型</TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortableHeader
                    field="created_at"
                    currentSort={sort}
                    onSort={handleSort}
                  >
                    创建时间
                  </SortableHeader>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortableHeader
                    field="updated_at"
                    currentSort={sort}
                    onSort={handleSort}
                  >
                    更新时间
                  </SortableHeader>
                </TableHead>
                <TableHead className="whitespace-nowrap">快速查看</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCases.map((caseItem) => (
                <TableRow key={caseItem.id}>
                  <TableCell className="whitespace-nowrap">{caseItem.user?.name || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {caseItem.loan_amount !== null && caseItem.loan_amount !== undefined ? `¥${caseItem.loan_amount.toLocaleString()}` : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {caseItem.case_type === 'debt' ? '民间借贷纠纷' : 
                     caseItem.case_type === 'contract' ? '买卖合同纠纷' : '-'}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {caseItem.creditor_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {caseItem.creditor_type ? partyTypeLabels[caseItem.creditor_type] : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {caseItem.debtor_name || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {caseItem.debtor_type ? partyTypeLabels[caseItem.debtor_type] : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                    {formatDateTime(caseItem.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                    {formatDateTime(caseItem.updated_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewCase(caseItem.id)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 text-xs whitespace-nowrap min-w-0"
                      >
                        证据
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEvidenceChain(caseItem.id)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1 text-xs whitespace-nowrap min-w-0"
                      >
                        详情
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  };

  return (
    <>
      <ListPage
        title="案件管理"
        subtitle="管理和跟踪所有案件信息"
        headerActions={
          <div className="flex items-center space-x-4">
            {/* User Filter */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="user-filter" className="text-sm font-medium whitespace-nowrap">
                用户筛选:
              </Label>
              <Select
                value={selectedUserId || "all"}
                onValueChange={handleUserFilterChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="选择用户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部用户</SelectItem>
                  {(users || []).map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearUserFilter}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedUserId && (
              <Badge variant="secondary" className="text-sm whitespace-nowrap">
                筛选: {getSelectedUserName()}
              </Badge>
            )}
            <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              新增案件
            </Button>
          </div>
        }
        data={cases}
        loading={loading || isRefreshing}
        error={error}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        renderTable={renderTable}
        emptyMessage={selectedUserId ? "该用户暂无案件数据" : "暂无案件数据"}
        emptyAction={
          <Button onClick={openAddDialog} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            创建第一个案件
          </Button>
        }
      />

      {/* Add Case Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增案件</DialogTitle>
            <DialogDescription>
              创建一个新的案件记录
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* 关联用户 - 关键信息，放在最顶部 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <Label className="text-base font-medium text-gray-700">
                  关联用户 <span className="text-red-500">*</span>
                </Label>
              </div>
              <div className="flex space-x-3">
                <Select
                  value={addForm.user_id.toString()}
                  onValueChange={handleUserChange}
                >
                  <SelectTrigger className={`flex-1 ${addFormErrors.user_id ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="选择用户" />
                  </SelectTrigger>
                  <SelectContent>
                    {(users || []).map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateUser}
                  className="px-4"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  新建用户
                </Button>
              </div>
              {addFormErrors.user_id && (
                <div className="text-red-500 text-sm">{addFormErrors.user_id}</div>
              )}
            </div>

            {/* 基础案件信息区域 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">基础案件信息</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* 案件类型 */}
                <div className="space-y-2">
                  <Label htmlFor="case_type" className="text-sm font-medium">
                    案件类型 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={addForm.case_type || ""}
                    onValueChange={(value: any) => {
                      setAddForm({ ...addForm, case_type: value });
                      if (value) {
                        setAddFormErrors(prev => ({ ...prev, case_type: "" }));
                      }
                    }}
                  >
                    <SelectTrigger className={`${addFormErrors.case_type ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="选择案件类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debt">民间借贷纠纷</SelectItem>
                      <SelectItem value="contract">买卖合同纠纷</SelectItem>
                    </SelectContent>
                  </Select>
                  {addFormErrors.case_type && (
                    <div className="text-red-500 text-xs">{addFormErrors.case_type}</div>
                  )}
                </div>

                {/* 欠款金额 */}
                <div className="space-y-2">
                  <Label htmlFor="loan_amount" className="text-sm font-medium">
                    欠款金额 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="loan_amount"
                    type="text"
                    placeholder="请输入欠款金额"
                    value={loanAmountInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      // 允许输入任何内容，包括小数点
                      setLoanAmountInput(value);
                      // 清除错误状态
                      setAddFormErrors(prev => ({ ...prev, loan_amount: "" }));
                    }}
                    onBlur={() => {
                      const value = loanAmountInput;
                      if (!value || value.trim() === "") {
                        setAddFormErrors(prev => ({ ...prev, loan_amount: "请输入欠款金额" }));
                        return;
                      }
                      
                      // 验证是否为有效数字格式
                      if (!/^\d+(\.\d{1,2})?$/.test(value)) {
                        setAddFormErrors(prev => ({ ...prev, loan_amount: "请输入有效的金额格式（最多两位小数）" }));
                        return;
                      }
                      
                      const numValue = parseFloat(value);
                      if (numValue <= 0) {
                        setAddFormErrors(prev => ({ ...prev, loan_amount: "请输入有效的欠款金额" }));
                        return;
                      }
                      
                      // 验证通过，更新表单数据
                      setAddForm(prev => ({ ...prev, loan_amount: numValue }));
                      setAddFormErrors(prev => ({ ...prev, loan_amount: "" }));
                    }}
                    className={`${addFormErrors.loan_amount ? 'border-red-500' : ''} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                  />
                  {addFormErrors.loan_amount && (
                    <div className="text-red-500 text-xs">{addFormErrors.loan_amount}</div>
                  )}
                </div>
              </div>
            </div>

            {/* 债权人和债务人信息区域 */}
            <div className="grid grid-cols-2 gap-8">
              {/* 左侧：债权人信息 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-blue-600 border-b border-blue-200 pb-2">债权人信息</h3>
                
                {/* 债权人姓名 */}
                <div className="space-y-2">
                  <Label htmlFor="creditor_name" className="text-sm font-medium">
                    债权人姓名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="creditor_name"
                    value={addForm.creditor_name}
                    onChange={(e) => setAddForm({ ...addForm, creditor_name: e.target.value })}
                    onBlur={() => {
                      if (!addForm.creditor_name.trim()) {
                        setAddFormErrors(prev => ({ ...prev, creditor_name: "请输入债权人姓名" }));
                      } else {
                        setAddFormErrors(prev => ({ ...prev, creditor_name: "" }));
                      }
                    }}
                    className={`${addFormErrors.creditor_name ? 'border-red-500' : ''}`}
                    placeholder="请输入债权人姓名"
                  />
                  {addFormErrors.creditor_name && (
                    <div className="text-red-500 text-xs">{addFormErrors.creditor_name}</div>
                  )}
                </div>

                {/* 债权人类型 */}
                <div className="space-y-2">
                  <Label htmlFor="creditor_type" className="text-sm font-medium">
                    债权人类型 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={addForm.creditor_type || ""}
                    onValueChange={(value: any) => {
                      setAddForm({ ...addForm, creditor_type: value });
                      if (value) {
                        setAddFormErrors(prev => ({ ...prev, creditor_type: "" }));
                      }
                    }}
                  >
                    <SelectTrigger className={`${addFormErrors.creditor_type ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="选择债权人类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person">个人</SelectItem>
                      <SelectItem value="company">公司</SelectItem>
                      <SelectItem value="individual">个体工商户</SelectItem>
                    </SelectContent>
                  </Select>
                  {addFormErrors.creditor_type && (
                    <div className="text-red-500 text-xs">{addFormErrors.creditor_type}</div>
                  )}
                </div>

                {/* 债权人电话 */}
                <div className="space-y-2">
                  <Label htmlFor="creditor_phone" className="text-sm font-medium">
                    债权人电话
                  </Label>
                  <Input
                    id="creditor_phone"
                    value={addForm.creditor_phone || ""}
                    onChange={(e) => setAddForm({ ...addForm, creditor_phone: e.target.value })}
                    placeholder="请输入债权人电话"
                  />
                </div>

                {/* 债权人银行账户 */}
                <div className="space-y-2">
                  <Label htmlFor="creditor_bank_account" className="text-sm font-medium">
                    债权人银行账户
                  </Label>
                  <Input
                    id="creditor_bank_account"
                    value={addForm.creditor_bank_account || ""}
                    onChange={(e) => setAddForm({ ...addForm, creditor_bank_account: e.target.value })}
                    placeholder="请输入银行账户"
                  />
                </div>

                {/* 债权人银行地址 */}
                <div className="space-y-2">
                  <Label htmlFor="creditor_bank_address" className="text-sm font-medium">
                    债权人银行地址
                  </Label>
                  <Input
                    id="creditor_bank_address"
                    value={addForm.creditor_bank_address || ""}
                    onChange={(e) => setAddForm({ ...addForm, creditor_bank_address: e.target.value })}
                    placeholder="请输入银行地址"
                  />
                </div>
              </div>

              {/* 右侧：债务人信息 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-600 border-b border-orange-200 pb-2">债务人信息</h3>
                
                {/* 债务人姓名 */}
                <div className="space-y-2">
                  <Label htmlFor="debtor_name" className="text-sm font-medium">
                    债务人姓名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="debtor_name"
                    value={addForm.debtor_name}
                    onChange={(e) => setAddForm({ ...addForm, debtor_name: e.target.value })}
                    onBlur={() => {
                      if (!addForm.debtor_name.trim()) {
                        setAddFormErrors(prev => ({ ...prev, debtor_name: "请输入债务人姓名" }));
                      } else {
                        setAddFormErrors(prev => ({ ...prev, debtor_name: "" }));
                      }
                    }}
                    className={`${addFormErrors.debtor_name ? 'border-red-500' : ''}`}
                    placeholder="请输入债务人姓名"
                  />
                  {addFormErrors.debtor_name && (
                    <div className="text-red-500 text-xs">{addFormErrors.debtor_name}</div>
                  )}
                </div>

                {/* 债务人类型 */}
                <div className="space-y-2">
                  <Label htmlFor="debtor_type" className="text-sm font-medium">
                    债务人类型 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={addForm.debtor_type || ""}
                    onValueChange={(value: any) => {
                      setAddForm({ ...addForm, debtor_type: value });
                      if (value) {
                        setAddFormErrors(prev => ({ ...prev, debtor_type: "" }));
                      }
                    }}
                  >
                    <SelectTrigger className={`${addFormErrors.debtor_type ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="选择债务人类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person">个人</SelectItem>
                      <SelectItem value="company">公司</SelectItem>
                      <SelectItem value="individual">个体工商户</SelectItem>
                    </SelectContent>
                  </Select>
                  {addFormErrors.debtor_type && (
                    <div className="text-red-500 text-xs">{addFormErrors.debtor_type}</div>
                  )}
                </div>

                {/* 债务人电话 */}
                <div className="space-y-2">
                  <Label htmlFor="debtor_phone" className="text-sm font-medium">
                    债务人电话
                  </Label>
                  <Input
                    id="debtor_phone"
                    value={addForm.debtor_phone || ""}
                    onChange={(e) => setAddForm({ ...addForm, debtor_phone: e.target.value })}
                    placeholder="请输入债务人电话"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddCase}>
              创建案件
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>新建用户</DialogTitle>
            <DialogDescription>
              创建一个新的用户账户
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* 用户姓名 */}
            <div className="space-y-2">
              <Label htmlFor="user-name" className="text-sm font-medium">
                姓名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="user-name"
                value={userForm.name}
                onChange={(e) => {
                  setUserForm({ ...userForm, name: e.target.value });
                  if (e.target.value.trim()) {
                    setUserFormErrors(prev => ({ ...prev, name: "" }));
                  }
                }}
                className={`${userFormErrors.name ? 'border-red-500' : ''}`}
                placeholder="请输入用户姓名"
              />
              {userFormErrors.name && (
                <div className="text-red-500 text-xs">{userFormErrors.name}</div>
              )}
            </div>

            {/* 微信昵称 */}
            <div className="space-y-2">
              <Label htmlFor="user-wechat-nickname" className="text-sm font-medium">
                微信昵称
              </Label>
              <Input
                id="user-wechat-nickname"
                value={userForm.wechat_nickname}
                onChange={(e) => {
                  setUserForm({ ...userForm, wechat_nickname: e.target.value });
                }}
                placeholder="可选"
              />
            </div>

            {/* 微信号 */}
            <div className="space-y-2">
              <Label htmlFor="user-wechat-number" className="text-sm font-medium">
                微信号
              </Label>
              <Input
                id="user-wechat-number"
                value={userForm.wechat_number}
                onChange={(e) => {
                  setUserForm({ ...userForm, wechat_number: e.target.value });
                }}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitUser}>
              创建用户
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}