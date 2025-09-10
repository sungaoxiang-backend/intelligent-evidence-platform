"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus } from "lucide-react";
import { caseApi } from "@/lib/api";
import { userApi } from "@/lib/user-api";

// Helper functions for API calls
// 格式化金额，去除尾随零
function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) {
    return amount.toString();
  }
  return amount.toFixed(2).replace(/\.?0+$/, '');
}
import { ListPage } from "@/components/common/list-page";
import { usePaginatedSWR } from "@/hooks/use-paginated-swr";
import { SortableHeader, formatDateTime, type SortDirection } from "@/components/common/sortable-header";
import { CaseFilters } from "@/components/case-filters";
import type { Case, User, CaseType, PartyType } from "@/lib/types";

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

  // 筛选条件状态
  const [filters, setFilters] = useState({
    userId: undefined as string | undefined,
    partyName: "",
    partyType: "",
    partyRole: "",
    minLoanAmount: undefined as number | undefined,
    maxLoanAmount: undefined as number | undefined,
  });
  
  // 用户筛选状态（为了保持与用户管理页面的关联）
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // 筛选器展开状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  
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

  // 处理筛选条件变化
  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    // 同步selectedUserId状态以保持与用户管理页面的关联
    if (newFilters.userId !== undefined) {
      setSelectedUserId(newFilters.userId);
    } else {
      setSelectedUserId(null);
    }
    setPage(1); // 重置到第一页
  };

  // Initialize user filter from URL params and update filters state
  useEffect(() => {
    const userId = searchParams.get('user_id');
    if (userId) {
      setSelectedUserId(userId);
      // Update filters to apply the user filter
      setFilters(prev => ({
        ...prev,
        userId: userId
      }));
    } else {
      // Clear user filter if not in URL
      setSelectedUserId(null);
      setFilters(prev => ({
        ...prev,
        userId: undefined
      }));
    }
  }, [searchParams]);

  // 初始化表单状态
  const [addForm, setAddForm] = useState({
    user_id: 0,
    loan_amount: 0,
    case_type: null as null | CaseType,
    case_parties: [
      {
        party_name: "",
        party_role: "creditor",
        party_type: null as null | PartyType,
        name: "", // 自然人姓名/经营者名称/法定代表人名称
        company_name: "", // 个体工商户名称/公司名称
      },
      {
        party_name: "",
        party_role: "debtor", 
        party_type: null as null | PartyType,
        name: "", // 自然人姓名/经营者名称/法定代表人名称
        company_name: "", // 个体工商户名称/公司名称
      }
    ]
  });

    // 临时存储输入的金额字符串，用于显示
  const [loanAmountInput, setLoanAmountInput] = useState("");
  
  // 用户筛选相关状态
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  // 表单验证状态
  const [addFormErrors, setAddFormErrors] = useState({
    user_id: "",
    loan_amount: "",
    case_type: "",
    creditor_name: "",
    creditor_type: "",
    creditor_required_name: "", // 债权人必要姓名字段
    creditor_required_company: "", // 债权人必要公司字段
    debtor_name: "",
    debtor_type: "",
    debtor_required_name: "", // 债务人必要姓名字段
    debtor_required_company: "", // 债务人必要公司字段
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
        sort_order: sort.direction || "desc", // 提供默认值，避免null
        user_id: filters.userId ? parseInt(filters.userId) : undefined,
        party_name: filters.partyName || undefined,
        party_type: filters.partyType || undefined,
        party_role: filters.partyRole || undefined,
        min_loan_amount: filters.minLoanAmount,
        max_loan_amount: filters.maxLoanAmount,
      };
      return caseApi.getCases(apiParams);
    },
    [filters], // Add filters as dependency to trigger re-fetch when filters change
    20, // initialPageSize
    {
      // 优化刷新策略：平衡性能和实时性
      revalidateOnFocus: true,       // 页面获得焦点时重新验证
      revalidateOnReconnect: true,   // 网络重连时重新验证
      revalidateIfStale: true,       // 数据过期时自动重新验证
      dedupingInterval: 10000,       // 10秒内重复请求会被去重
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
  // const sortedCases = cases || [];

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
  const handleUserSelect = (user: User) => {
    console.log('用户选择:', user);
    setAddForm(prev => ({
      ...prev,
      user_id: user.id,
      case_parties: [
        {
          ...prev.case_parties[0],
          party_name: user.name || "",
          name: user.name || "" // 同时设置必要姓名字段
        },
        prev.case_parties[1]
      ]
    }));
    setUserSearchTerm(user.name || "");
    setShowUserDropdown(false);
    setAddFormErrors(prev => ({ ...prev, user_id: "" }));
    console.log('用户选择完成，user_id:', user.id, 'user_name:', user.name);
  };

  // 点击外部关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserDropdown) {
        // 检查点击的目标是否在下拉列表容器内
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

  // 重置表单时也要修改
  // 验证函数
  const validateAddForm = () => {
    const errors = {
      user_id: "",
      loan_amount: "",
      case_type: "",
      creditor_name: "",
      creditor_type: "",
      creditor_required_name: "",
      creditor_required_company: "",
      debtor_name: "",
      debtor_type: "",
      debtor_required_name: "",
      debtor_required_company: "",
    };

    if (!addForm.user_id || addForm.user_id === 0) {
      errors.user_id = "请选择关联用户";
    } else if (!userSearchTerm.trim()) {
      errors.user_id = "请选择关联用户";
    }
    
    const creditor = addForm.case_parties.find(p => p.party_role === "creditor");
    const debtor = addForm.case_parties.find(p => p.party_role === "debtor");
    
    // 验证当事人名称
    if (!creditor?.party_name.trim()) {
      errors.creditor_name = "请输入债权人姓名";
    }
    if (!debtor?.party_name.trim()) {
      errors.debtor_name = "请输入债务人姓名";
    }
    
    // 验证金额格式
    if (!loanAmountInput || loanAmountInput.trim() === "") {
      errors.loan_amount = "请输入欠款金额";
    } else if (!/^\d+(\.\d{1,2})?$/.test(loanAmountInput)) {
      errors.loan_amount = "请输入有效的金额格式（最多两位小数）";
    } else if (parseFloat(loanAmountInput) <= 0) {
      errors.loan_amount = "金额必须大于0";
    }
    
    if (!creditor?.party_type) {
      errors.creditor_type = "请选择债权人类型";
    }
    if (!debtor?.party_type) {
      errors.debtor_type = "请选择债务人类型";
    }
    if (!addForm.case_type) {
      errors.case_type = "请选择案件类型";
    }

    // 根据当事人类型验证必要字段
    if (creditor?.party_type) {
      if (creditor.party_type === "person") {
        // 个人类型：需要 name（自然人姓名）
        if (!creditor.name?.trim()) {
          errors.creditor_required_name = "请输入自然人姓名";
        }
      } else if (creditor.party_type === "individual") {
        // 个体工商户类型：需要 company_name（个体工商户名称）和 name（经营者名称）
        if (!creditor.company_name?.trim()) {
          errors.creditor_required_company = "请输入个体工商户名称";
        }
        if (!creditor.name?.trim()) {
          errors.creditor_required_name = "请输入经营者名称";
        }
      } else if (creditor.party_type === "company") {
        // 公司类型：需要 company_name（公司名称）和 name（法定代表人名称）
        if (!creditor.company_name?.trim()) {
          errors.creditor_required_company = "请输入公司名称";
        }
        if (!creditor.name?.trim()) {
          errors.creditor_required_name = "请输入法定代表人名称";
        }
      }
    }

    if (debtor?.party_type) {
      if (debtor.party_type === "person") {
        // 个人类型：需要 name（自然人姓名）
        if (!debtor.name?.trim()) {
          errors.debtor_required_name = "请输入自然人姓名";
        }
      } else if (debtor.party_type === "individual") {
        // 个体工商户类型：需要 company_name（个体工商户名称）和 name（经营者名称）
        if (!debtor.company_name?.trim()) {
          errors.debtor_required_company = "请输入个体工商户名称";
        }
        if (!debtor.name?.trim()) {
          errors.debtor_required_name = "请输入经营者名称";
        }
      } else if (debtor.party_type === "company") {
        // 公司类型：需要 company_name（公司名称）和 name（法定代表人名称）
        if (!debtor.company_name?.trim()) {
          errors.debtor_required_company = "请输入公司名称";
        }
        if (!debtor.name?.trim()) {
          errors.debtor_required_name = "请输入法定代表人名称";
        }
      }
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
        loan_amount: 0,
        case_type: null,
        case_parties: [
          {
            party_name: "",
            party_role: "creditor",
            party_type: null,
            name: "",
            company_name: "",
          },
          {
            party_name: "",
            party_role: "debtor", 
            party_type: null,
            name: "",
            company_name: "",
          }
        ]
      });
      setLoanAmountInput("");
      setUserSearchTerm("");
      setShowUserDropdown(false);
      setAddFormErrors({
        user_id: "",
        loan_amount: "",
        case_type: "",
        creditor_name: "",
        creditor_type: "",
        creditor_required_name: "",
        creditor_required_company: "",
        debtor_name: "",
        debtor_type: "",
        debtor_required_name: "",
        debtor_required_company: "",
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
    // 确保弹窗打开时没有输入框获得焦点
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, 0);
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
        user_id: Number(newUser.data.id),
        case_parties: [
          {
            ...prev.case_parties[0],
            party_name: newUser.data.name || "",
            name: newUser.data.name || "" // 同时设置必要姓名字段
          },
          prev.case_parties[1]
        ]
      }));

      // 隐藏刷新loading状态
      setIsRefreshing(false);

      // 关闭弹窗
      setShowUserDialog(false);
    } catch (error) {
      console.error("Failed to create user:", error);
    }
  };

  const handleViewCase = (caseId: number) => {
    router.push(`/cases/${caseId}`);
  };

  const handleViewEvidenceChain = (caseId: number) => {
    router.push(`/cases/${caseId}/detail`);
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
                <TableHead className="whitespace-nowrap w-16">ID</TableHead>
                <TableHead className="whitespace-nowrap">关联用户</TableHead>
                <TableHead className="whitespace-nowrap">快速查看</TableHead>
                <TableHead className="whitespace-nowrap">欠款金额</TableHead>
                <TableHead className="whitespace-nowrap">案由</TableHead>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCases.map((caseItem) => {
                const creditor = caseItem.case_parties?.find((p: any) => p.party_role === "creditor");
                const debtor = caseItem.case_parties?.find((p: any) => p.party_role === "debtor");
                
                return (
                  <TableRow key={caseItem.id}>
                    <TableCell className="whitespace-nowrap font-mono text-sm text-gray-600">
                      #{caseItem.id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{caseItem.user?.name || "-"}</TableCell>
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
                    <TableCell className="whitespace-nowrap">
                      {caseItem.loan_amount !== null && caseItem.loan_amount !== undefined ? `¥${caseItem.loan_amount.toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {caseItem.case_type === 'debt' ? '民间借贷纠纷' : 
                       caseItem.case_type === 'contract' ? '买卖合同纠纷' : '-'}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {creditor?.party_name || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {creditor?.party_type ? partyTypeLabels[creditor.party_type] : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {debtor?.party_name || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {debtor?.party_type ? partyTypeLabels[debtor.party_type] : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                      {formatDateTime(caseItem.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                      {formatDateTime(caseItem.updated_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
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
          <div className="flex items-center space-x-2">
            <Button 
              variant={isFilterExpanded ? "default" : "outline"}
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className="whitespace-nowrap border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 flex items-center text-sm h-8"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              筛选
            </Button>
            <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap text-sm h-8">
              <Plus className="mr-1 h-3 w-3" />
              新增
            </Button>
          </div>
        }
        additionalContent={
          isFilterExpanded && (
            <div className="w-full mb-4">
              <CaseFilters 
                users={users || []}
                selectedUserId={selectedUserId}
                isExpanded={isFilterExpanded}
                onFilterChange={handleFilterChange}
                onUserFilterChange={setSelectedUserId}
                onToggleExpand={() => setIsFilterExpanded(!isFilterExpanded)}
              />
            </div>
          )
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
      />

      {/* Add Case Dialog */}
      <Dialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        modal={true}
      >
        <DialogContent 
          className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
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
                <div className="flex-1 relative">
                  <Input
                    placeholder="搜索或选择用户"
                    value={userSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setUserSearchTerm(value);
                      // 保持下拉列表展开，根据输入内容进行筛选
                      setShowUserDropdown(true);
                      if (value.trim()) {
                        setAddFormErrors(prev => ({ ...prev, user_id: "" }));
                      }
                    }}
                    onFocus={() => {
                      // 聚焦时展开下拉列表，显示所有用户
                      setShowUserDropdown(true);
                    }}
                    className={`${addFormErrors.user_id ? 'border-red-500' : ''}`}
                  />
                  
                  {/* 用户下拉列表 */}
                  {showUserDropdown && (
                    <div className="user-dropdown-container absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <div
                            key={user.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleUserSelect(user)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{user.name || '未命名用户'}</div>
                              <div className="text-xs text-gray-400 font-mono">#{user.id}</div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.wechat_nickname && `微信: ${user.wechat_nickname}`}
                              {user.wechat_number && ` (${user.wechat_number})`}
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
                {/* 案由 */}
                <div className="space-y-2">
                  <Label htmlFor="case_type" className="text-sm font-medium">
                    案由 <span className="text-red-500">*</span>
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
                      <SelectValue placeholder="选择案由" />
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
                      
                      // 实时验证
                      if (value === "" || value === ".") {
                        setAddFormErrors(prev => ({ ...prev, loan_amount: "请输入欠款金额" }));
                      } else if (!/^\d+(\.\d*)?$/.test(value)) {
                        setAddFormErrors(prev => ({ ...prev, loan_amount: "请输入有效的金额格式" }));
                      } else if (value.includes(".") && value.split(".")[1]?.length > 2) {
                        setAddFormErrors(prev => ({ ...prev, loan_amount: "最多支持两位小数" }));
                      } else if (parseFloat(value) <= 0) {
                        setAddFormErrors(prev => ({ ...prev, loan_amount: "金额必须大于0" }));
                      } else {
                        setAddFormErrors(prev => ({ ...prev, loan_amount: "" }));
                      }
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
                      
                                              // 验证通过，自动格式化并更新表单数据
                        const formattedValue = formatAmount(numValue);
                        setLoanAmountInput(formattedValue);
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
                    债权人名称 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="creditor_name"
                    value={addForm.case_parties[0]?.party_name || ""}
                    onChange={(e) => setAddForm(prev => ({
                      ...prev,
                      case_parties: [
                        { ...prev.case_parties[0], party_name: e.target.value },
                        prev.case_parties[1]
                      ]
                    }))}
                    onBlur={() => {
                      if (!addForm.case_parties[0]?.party_name.trim()) {
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
                    value={addForm.case_parties[0]?.party_type || ""}
                    onValueChange={(value: any) => {
                      setAddForm(prev => ({
                        ...prev,
                        case_parties: [
                          { ...prev.case_parties[0], party_type: value },
                          prev.case_parties[1]
                        ]
                      }));
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

                {/* 基于债权人类型的必要字段 */}
                {addForm.case_parties[0]?.party_type === "person" && (
                  <div className="space-y-2">
                    <Label htmlFor="creditor_person_name" className="text-sm font-medium">
                      自然人姓名 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="creditor_person_name"
                      value={addForm.case_parties[0]?.name || ""}
                      onChange={(e) => setAddForm(prev => ({
                        ...prev,
                        case_parties: [
                          { ...prev.case_parties[0], name: e.target.value },
                          prev.case_parties[1]
                        ]
                      }))}
                      onBlur={() => {
                        if (!addForm.case_parties[0]?.name?.trim()) {
                          setAddFormErrors(prev => ({ ...prev, creditor_required_name: "请输入自然人姓名" }));
                        } else {
                          setAddFormErrors(prev => ({ ...prev, creditor_required_name: "" }));
                        }
                      }}
                      className={`${addFormErrors.creditor_required_name ? 'border-red-500' : ''}`}
                      placeholder="请输入自然人姓名"
                    />
                    {addFormErrors.creditor_required_name && (
                      <div className="text-red-500 text-xs">{addFormErrors.creditor_required_name}</div>
                    )}
                  </div>
                )}

                {addForm.case_parties[0]?.party_type === "individual" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="creditor_company_name" className="text-sm font-medium">
                        个体工商户名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="creditor_company_name"
                        value={addForm.case_parties[0]?.company_name || ""}
                        onChange={(e) => setAddForm(prev => ({
                          ...prev,
                          case_parties: [
                            { ...prev.case_parties[0], company_name: e.target.value },
                            prev.case_parties[1]
                          ]
                        }))}
                        onBlur={() => {
                          if (!addForm.case_parties[0]?.company_name?.trim()) {
                            setAddFormErrors(prev => ({ ...prev, creditor_required_company: "请输入个体工商户名称" }));
                          } else {
                            setAddFormErrors(prev => ({ ...prev, creditor_required_company: "" }));
                          }
                        }}
                        className={`${addFormErrors.creditor_required_company ? 'border-red-500' : ''}`}
                        placeholder="请输入个体工商户名称"
                      />
                      {addFormErrors.creditor_required_company && (
                        <div className="text-red-500 text-xs">{addFormErrors.creditor_required_company}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="creditor_operator_name" className="text-sm font-medium">
                        经营者名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="creditor_operator_name"
                        value={addForm.case_parties[0]?.name || ""}
                        onChange={(e) => setAddForm(prev => ({
                          ...prev,
                          case_parties: [
                            { ...prev.case_parties[0], name: e.target.value },
                            prev.case_parties[1]
                          ]
                        }))}
                        onBlur={() => {
                          if (!addForm.case_parties[0]?.name?.trim()) {
                            setAddFormErrors(prev => ({ ...prev, creditor_required_name: "请输入经营者名称" }));
                          } else {
                            setAddFormErrors(prev => ({ ...prev, creditor_required_name: "" }));
                          }
                        }}
                        className={`${addFormErrors.creditor_required_name ? 'border-red-500' : ''}`}
                        placeholder="请输入经营者名称"
                      />
                      {addFormErrors.creditor_required_name && (
                        <div className="text-red-500 text-xs">{addFormErrors.creditor_required_name}</div>
                      )}
                    </div>
                  </>
                )}

                {addForm.case_parties[0]?.party_type === "company" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="creditor_company_name" className="text-sm font-medium">
                        公司名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="creditor_company_name"
                        value={addForm.case_parties[0]?.company_name || ""}
                        onChange={(e) => setAddForm(prev => ({
                          ...prev,
                          case_parties: [
                            { ...prev.case_parties[0], company_name: e.target.value },
                            prev.case_parties[1]
                          ]
                        }))}
                        onBlur={() => {
                          if (!addForm.case_parties[0]?.company_name?.trim()) {
                            setAddFormErrors(prev => ({ ...prev, creditor_required_company: "请输入公司名称" }));
                          } else {
                            setAddFormErrors(prev => ({ ...prev, creditor_required_company: "" }));
                          }
                        }}
                        className={`${addFormErrors.creditor_required_company ? 'border-red-500' : ''}`}
                        placeholder="请输入公司名称"
                      />
                      {addFormErrors.creditor_required_company && (
                        <div className="text-red-500 text-xs">{addFormErrors.creditor_required_company}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="creditor_legal_rep_name" className="text-sm font-medium">
                        法定代表人名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="creditor_legal_rep_name"
                        value={addForm.case_parties[0]?.name || ""}
                        onChange={(e) => setAddForm(prev => ({
                          ...prev,
                          case_parties: [
                            { ...prev.case_parties[0], name: e.target.value },
                            prev.case_parties[1]
                          ]
                        }))}
                        onBlur={() => {
                          if (!addForm.case_parties[0]?.name?.trim()) {
                            setAddFormErrors(prev => ({ ...prev, creditor_required_name: "请输入法定代表人名称" }));
                          } else {
                            setAddFormErrors(prev => ({ ...prev, creditor_required_name: "" }));
                          }
                        }}
                        className={`${addFormErrors.creditor_required_name ? 'border-red-500' : ''}`}
                        placeholder="请输入法定代表人名称"
                      />
                      {addFormErrors.creditor_required_name && (
                        <div className="text-red-500 text-xs">{addFormErrors.creditor_required_name}</div>
                      )}
                    </div>
                  </>
                )}

              </div>

              {/* 右侧：债务人信息 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-600 border-b border-orange-200 pb-2">债务人信息</h3>
                
                {/* 债务人姓名 */}
                <div className="space-y-2">
                  <Label htmlFor="debtor_name" className="text-sm font-medium">
                    债务人名称 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="debtor_name"
                    value={addForm.case_parties[1]?.party_name || ""}
                    onChange={(e) => setAddForm(prev => ({
                      ...prev,
                      case_parties: [
                        prev.case_parties[0],
                        { ...prev.case_parties[1], party_name: e.target.value }
                      ]
                    }))}
                    onBlur={() => {
                      if (!addForm.case_parties[1]?.party_name.trim()) {
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
                    value={addForm.case_parties[1]?.party_type || ""}
                    onValueChange={(value: any) => {
                      setAddForm(prev => ({
                        ...prev,
                        case_parties: [
                          prev.case_parties[0],
                          { ...prev.case_parties[1], party_type: value }
                        ]
                      }));
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

                {/* 基于债务人类型的必要字段 */}
                {addForm.case_parties[1]?.party_type === "person" && (
                  <div className="space-y-2">
                    <Label htmlFor="debtor_person_name" className="text-sm font-medium">
                      自然人姓名 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="debtor_person_name"
                      value={addForm.case_parties[1]?.name || ""}
                      onChange={(e) => setAddForm(prev => ({
                        ...prev,
                        case_parties: [
                          prev.case_parties[0],
                          { ...prev.case_parties[1], name: e.target.value }
                        ]
                      }))}
                      onBlur={() => {
                        if (!addForm.case_parties[1]?.name?.trim()) {
                          setAddFormErrors(prev => ({ ...prev, debtor_required_name: "请输入自然人姓名" }));
                        } else {
                          setAddFormErrors(prev => ({ ...prev, debtor_required_name: "" }));
                        }
                      }}
                      className={`${addFormErrors.debtor_required_name ? 'border-red-500' : ''}`}
                      placeholder="请输入自然人姓名"
                    />
                    {addFormErrors.debtor_required_name && (
                      <div className="text-red-500 text-xs">{addFormErrors.debtor_required_name}</div>
                    )}
                  </div>
                )}

                {addForm.case_parties[1]?.party_type === "individual" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="debtor_company_name" className="text-sm font-medium">
                        个体工商户名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="debtor_company_name"
                        value={addForm.case_parties[1]?.company_name || ""}
                        onChange={(e) => setAddForm(prev => ({
                          ...prev,
                          case_parties: [
                            prev.case_parties[0],
                            { ...prev.case_parties[1], company_name: e.target.value }
                          ]
                        }))}
                        onBlur={() => {
                          if (!addForm.case_parties[1]?.company_name?.trim()) {
                            setAddFormErrors(prev => ({ ...prev, debtor_required_company: "请输入个体工商户名称" }));
                          } else {
                            setAddFormErrors(prev => ({ ...prev, debtor_required_company: "" }));
                          }
                        }}
                        className={`${addFormErrors.debtor_required_company ? 'border-red-500' : ''}`}
                        placeholder="请输入个体工商户名称"
                      />
                      {addFormErrors.debtor_required_company && (
                        <div className="text-red-500 text-xs">{addFormErrors.debtor_required_company}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="debtor_operator_name" className="text-sm font-medium">
                        经营者名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="debtor_operator_name"
                        value={addForm.case_parties[1]?.name || ""}
                        onChange={(e) => setAddForm(prev => ({
                          ...prev,
                          case_parties: [
                            prev.case_parties[0],
                            { ...prev.case_parties[1], name: e.target.value }
                          ]
                        }))}
                        onBlur={() => {
                          if (!addForm.case_parties[1]?.name?.trim()) {
                            setAddFormErrors(prev => ({ ...prev, debtor_required_name: "请输入经营者名称" }));
                          } else {
                            setAddFormErrors(prev => ({ ...prev, debtor_required_name: "" }));
                          }
                        }}
                        className={`${addFormErrors.debtor_required_name ? 'border-red-500' : ''}`}
                        placeholder="请输入经营者名称"
                      />
                      {addFormErrors.debtor_required_name && (
                        <div className="text-red-500 text-xs">{addFormErrors.debtor_required_name}</div>
                      )}
                    </div>
                  </>
                )}

                {addForm.case_parties[1]?.party_type === "company" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="debtor_company_name" className="text-sm font-medium">
                        公司名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="debtor_company_name"
                        value={addForm.case_parties[1]?.company_name || ""}
                        onChange={(e) => setAddForm(prev => ({
                          ...prev,
                          case_parties: [
                            prev.case_parties[0],
                            { ...prev.case_parties[1], company_name: e.target.value }
                          ]
                        }))}
                        onBlur={() => {
                          if (!addForm.case_parties[1]?.company_name?.trim()) {
                            setAddFormErrors(prev => ({ ...prev, debtor_required_company: "请输入公司名称" }));
                          } else {
                            setAddFormErrors(prev => ({ ...prev, debtor_required_company: "" }));
                          }
                        }}
                        className={`${addFormErrors.debtor_required_company ? 'border-red-500' : ''}`}
                        placeholder="请输入公司名称"
                      />
                      {addFormErrors.debtor_required_company && (
                        <div className="text-red-500 text-xs">{addFormErrors.debtor_required_company}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="debtor_legal_rep_name" className="text-sm font-medium">
                        法定代表人名称 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="debtor_legal_rep_name"
                        value={addForm.case_parties[1]?.name || ""}
                        onChange={(e) => setAddForm(prev => ({
                          ...prev,
                          case_parties: [
                            prev.case_parties[0],
                            { ...prev.case_parties[1], name: e.target.value }
                          ]
                        }))}
                        onBlur={() => {
                          if (!addForm.case_parties[1]?.name?.trim()) {
                            setAddFormErrors(prev => ({ ...prev, debtor_required_name: "请输入法定代表人名称" }));
                          } else {
                            setAddFormErrors(prev => ({ ...prev, debtor_required_name: "" }));
                          }
                        }}
                        className={`${addFormErrors.debtor_required_name ? 'border-red-500' : ''}`}
                        placeholder="请输入法定代表人名称"
                      />
                      {addFormErrors.debtor_required_name && (
                        <div className="text-red-500 text-xs">{addFormErrors.debtor_required_name}</div>
                      )}
                    </div>
                  </>
                )}

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