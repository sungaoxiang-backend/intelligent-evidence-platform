"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import { caseApi } from "@/lib/api";
import { userApi } from "@/lib/user-api";
import { ListPage } from "@/components/common/list-page";
import { usePaginatedSWR } from "@/hooks/use-paginated-swr";
import { SortableHeader, formatDateTime, type SortDirection } from "@/components/common/sortable-header";
import type { Case, User, CaseType, PartyType } from "@/lib/types";

const caseTypeLabels = {
  debt: "借款纠纷",
  contract: "合同纠纷",
};

const partyTypeLabels = {
    person: "个人",
    company: "公司", 
  individual: "个体工商户",
};

export default function CaseManagement() {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [sort, setSort] = useState<{ field: string; direction: SortDirection }>({
    field: "created_at",
    direction: "desc"
  });

  // 初始化表单状态
  const [addForm, setAddForm] = useState({
    user_id: 0,
    creditor_name: "",
    debtor_name: "",
    loan_amount: 0,
    case_type: null as null | CaseType,
    creditor_type: null as null | PartyType,
    debtor_type: null as null | PartyType,
    description: "",
  });

  const [editForm, setEditForm] = useState({
    user_id: 0,
    creditor_name: "",
    debtor_name: "",
    loan_amount: 0,
    case_type: null as null | CaseType,
    creditor_type: null as null | PartyType,
    debtor_type: null as null | PartyType,
    description: "",
  });

  // 表单验证状态
  const [addFormErrors, setAddFormErrors] = useState({
    user_id: "",
    creditor_name: "",
    debtor_name: "",
    loan_amount: "",
  });

  const [editFormErrors, setEditFormErrors] = useState({
    user_id: "",
    creditor_name: "",
    debtor_name: "",
    loan_amount: "",
  });

  // Use paginated SWR hook
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
    (params) => caseApi.getCases(params),
    [],
  );

  const handleSort = (field: string, direction: SortDirection) => {
    setSort({ field, direction });
  };

  // 对数据进行排序
  const getSortedCases = (cases: Case[]) => {
    if (!sort.field || !sort.direction) {
      return cases;
    }

    return [...cases].sort((a, b) => {
      let aValue: any = a[sort.field as keyof Case];
      let bValue: any = b[sort.field as keyof Case];

      // 处理时间字段
      if (sort.field === 'created_at' || sort.field === 'updated_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // 处理数字字段
      if (sort.field === 'loan_amount') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      // 处理字符串字段
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sort.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  // Fetch users for dropdown
  const {
    data: users
  } = usePaginatedSWR<User>(
    "/users",
    (params) => userApi.getUsers(params),
    [],
    100
  );

  // 重置表单时也要修改
  // 验证函数
  const validateAddForm = () => {
    const errors = {
      user_id: "",
      creditor_name: "",
      debtor_name: "",
      loan_amount: "",
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

    setAddFormErrors(errors);
    return !Object.values(errors).some(error => error !== "");
  };

  const validateEditForm = () => {
    const errors = {
      user_id: "",
      creditor_name: "",
      debtor_name: "",
      loan_amount: "",
    };

    if (!editForm.user_id || editForm.user_id === 0) {
      errors.user_id = "请选择关联用户";
    }
    if (!editForm.creditor_name.trim()) {
      errors.creditor_name = "请输入债权人姓名";
    }
    if (!editForm.debtor_name.trim()) {
      errors.debtor_name = "请输入债务人姓名";
    }
    if (!editForm.loan_amount || editForm.loan_amount <= 0) {
      errors.loan_amount = "请输入有效的欠款金额";
    }

    setEditFormErrors(errors);
    return !Object.values(errors).some(error => error !== "");
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
        description: "",
      });
      setAddFormErrors({
        user_id: "",
        creditor_name: "",
        debtor_name: "",
        loan_amount: "",
      });
      mutate();
    } catch (error) {
      console.error("Failed to create case:", error);
    }
  };

  const handleEditCase = async () => {
    if (!editingCase) return;
    
    if (!validateEditForm()) {
      return;
    }
    
    try {
      await caseApi.updateCase(editingCase.id, editForm);
      setShowEditDialog(false);
      setEditingCase(null);
      setEditFormErrors({
        user_id: "",
        creditor_name: "",
        debtor_name: "",
        loan_amount: "",
      });
      mutate();
    } catch (error) {
      console.error("Failed to update case:", error);
    }
  };

  const handleDeleteCase = async (id: number) => {
    if (!confirm("确定要删除这个案件吗？")) return;
    
    try {
      await caseApi.deleteCase(id);
      mutate();
    } catch (error) {
      console.error("Failed to delete case:", error);
    }
  };

  const openEditDialog = (caseItem: Case) => {
    setEditingCase(caseItem);
    setEditForm({
      user_id: caseItem.user_id,
      creditor_name: caseItem.creditor_name,
      debtor_name: caseItem.debtor_name || "",
      loan_amount: caseItem.loan_amount || 0,
      case_type: caseItem.case_type as CaseType,
      creditor_type: caseItem.creditor_type as PartyType,
      debtor_type: caseItem.debtor_type as PartyType,
      description: caseItem.description || "",
    });
    setShowEditDialog(true);
  };

  const openAddDialog = () => {
    setShowAddDialog(true);
  };

  const handleCreateUser = async () => {
    try {
      const newUser = await userApi.createUser({
        name: `user_${Date.now()}`,
        email: `user_${Date.now()}@example.com`,
      });
      
      setAddForm(prev => ({
        ...prev,
        user_id: Number(newUser.data.id)
      }));
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

  const handleEditUserChange = (userId: string) => {
    const selectedUser = users?.find(u => u.id === parseInt(userId));
    setEditForm(prev => ({
      ...prev,
      user_id: parseInt(userId),
      creditor_name: selectedUser?.name || "",
    }));
  };

  const handleViewCase = (caseId: number) => {
    router.push(`/cases/${caseId}`);
  };

  // 修改表格渲染逻辑
  const renderTable = (cases: Case[]) => {
    const sortedCases = getSortedCases(cases);
    
    return (
    <>
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>关联用户</TableHead>
              <TableHead>债权人</TableHead>
              <TableHead>债务人</TableHead>
              <TableHead>欠款金额</TableHead>
              <TableHead>
                <SortableHeader
                  field="created_at"
                  currentSort={sort}
                  onSort={handleSort}
                >
                  创建时间
                </SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader
                  field="updated_at"
                  currentSort={sort}
                  onSort={handleSort}
                >
                  更新时间
                </SortableHeader>
              </TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCases.map((caseItem) => (
              <TableRow key={caseItem.id}>
                <TableCell>{caseItem.user?.name || "-"}</TableCell>
                <TableCell className="font-medium">
                  {caseItem.creditor_name}
                  {caseItem.creditor_type && (
                    <span className="text-sm text-gray-500 ml-1">
                      ({partyTypeLabels[caseItem.creditor_type]})
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {caseItem.debtor_name || "-"}
                  {caseItem.debtor_type && caseItem.debtor_name && (
                    <span className="text-sm text-gray-500 ml-1">
                      ({partyTypeLabels[caseItem.debtor_type]})
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {caseItem.loan_amount !== null && caseItem.loan_amount !== undefined ? `¥${caseItem.loan_amount.toLocaleString()}` : "-"}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatDateTime(caseItem.created_at)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatDateTime(caseItem.updated_at)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewCase(caseItem.id)}
                      className="flex items-center text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      查看证据
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(caseItem)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCase(caseItem.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
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
          <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            新增案件
          </Button>
        }
        data={cases}
        loading={loading}
        error={error}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        renderTable={renderTable}
        emptyMessage="暂无案件数据"
        emptyAction={
          <Button onClick={openAddDialog} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            创建第一个案件
            </Button>
        }
      />

      {/* Add Case Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
            <DialogTitle>新增案件</DialogTitle>
            <DialogDescription>
              创建一个新的案件记录
            </DialogDescription>
            </DialogHeader>
          <div className="grid gap-4 py-4">
                        {/* 关联用户 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="user" className="text-right">
                关联用户 <span className="text-red-500">*</span>
              </Label>
              <div className="col-span-3 flex space-x-2">
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
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {addFormErrors.user_id && (
              <div className="text-red-500 text-xs mt-1 ml-4">{addFormErrors.user_id}</div>
            )}

            {/* 债权人 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="creditor_name" className="text-right">
                债权人 <span className="text-red-500">*</span>
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
                className={`col-span-3 ${addFormErrors.creditor_name ? 'border-red-500' : ''}`}
                placeholder="请输入债权人姓名"
              />
            </div>
            {addFormErrors.creditor_name && (
              <div className="text-red-500 text-xs mt-1 ml-4">{addFormErrors.creditor_name}</div>
            )}

            {/* 债务人 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="debtor_name" className="text-right">
                债务人 <span className="text-red-500">*</span>
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
                className={`col-span-3 ${addFormErrors.debtor_name ? 'border-red-500' : ''}`}
                placeholder="请输入债务人姓名"
              />
            </div>
            {addFormErrors.debtor_name && (
              <div className="text-red-500 text-xs mt-1 ml-4">{addFormErrors.debtor_name}</div>
            )}

            {/* 欠款金额 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="loan_amount" className="text-right">
                欠款金额 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="loan_amount"
                type="number"
                step="0.01"
                placeholder="请输入欠款金额"
                value={addForm.loan_amount || ""}
                onChange={(e) => setAddForm({ ...addForm, loan_amount: e.target.value ? Number(e.target.value) : 0 })}
                onBlur={() => {
                  if (!addForm.loan_amount || addForm.loan_amount <= 0) {
                    setAddFormErrors(prev => ({ ...prev, loan_amount: "请输入有效的欠款金额" }));
                  } else {
                    setAddFormErrors(prev => ({ ...prev, loan_amount: "" }));
                  }
                }}
                className={`col-span-3 ${addFormErrors.loan_amount ? 'border-red-500' : ''}`}
              />
            </div>
            {addFormErrors.loan_amount && (
              <div className="text-red-500 text-xs mt-1 ml-4">{addFormErrors.loan_amount}</div>
            )}

            {/* 债权人类型 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="creditor_type" className="text-right">
                债权人类型
              </Label>
              <Select 
                value={addForm.creditor_type || ""}
                onValueChange={(value: any) => setAddForm({ ...addForm, creditor_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择债权人类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">个人</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="individual">个体工商户</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 债务人类型 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="debtor_type" className="text-right">
                债务人类型
              </Label>
              <Select 
                value={addForm.debtor_type || ""}
                onValueChange={(value: any) => setAddForm({ ...addForm, debtor_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择债务人类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">个人</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="individual">个体工商户</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 案件类型 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="case_type" className="text-right">
                案件类型
              </Label>
              <Select 
                value={addForm.case_type || ""} 
                onValueChange={(value: any) => setAddForm({ ...addForm, case_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择案件类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debt">借款纠纷</SelectItem>
                  <SelectItem value="contract">合同纠纷</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 描述 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                描述
              </Label>
              <Textarea 
                id="description" 
                value={addForm.description} 
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                className="col-span-3"
                placeholder="请输入案件描述"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddCase}>
              创建案件
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Case Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑案件</DialogTitle>
            <DialogDescription>
              修改案件信息
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* 关联用户 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-user" className="text-right">
                关联用户 <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={editForm.user_id.toString()}
                onValueChange={handleEditUserChange}
              >
                <SelectTrigger className={`col-span-3 ${editFormErrors.user_id ? 'border-red-500' : ''}`}>
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
            </div>
            {editFormErrors.user_id && (
              <div className="text-red-500 text-xs mt-1 ml-4">{editFormErrors.user_id}</div>
            )}

            {/* 债权人 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-creditor_name" className="text-right">
                债权人 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-creditor_name"
                value={editForm.creditor_name}
                onChange={(e) => setEditForm({ ...editForm, creditor_name: e.target.value })}
                className={`col-span-3 ${editFormErrors.creditor_name ? 'border-red-500' : ''}`}
                placeholder="请输入债权人姓名"
              />
            </div>
            {editFormErrors.creditor_name && (
              <div className="text-red-500 text-xs mt-1 ml-4">{editFormErrors.creditor_name}</div>
            )}

            {/* 债务人 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-debtor_name" className="text-right">
                债务人 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-debtor_name"
                value={editForm.debtor_name}
                onChange={(e) => setEditForm({ ...editForm, debtor_name: e.target.value })}
                className={`col-span-3 ${editFormErrors.debtor_name ? 'border-red-500' : ''}`}
                placeholder="请输入债务人姓名"
              />
            </div>
            {editFormErrors.debtor_name && (
              <div className="text-red-500 text-xs mt-1 ml-4">{editFormErrors.debtor_name}</div>
            )}

            {/* 欠款金额 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-loan_amount" className="text-right">
                欠款金额 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-loan_amount"
                type="number"
                step="0.01"
                placeholder="请输入欠款金额"
                value={editForm.loan_amount || ""}
                onChange={(e) => setEditForm({ ...editForm, loan_amount: e.target.value ? Number(e.target.value) : 0 })}
                className={`col-span-3 ${editFormErrors.loan_amount ? 'border-red-500' : ''}`}
              />
            </div>
            {editFormErrors.loan_amount && (
              <div className="text-red-500 text-xs mt-1 ml-4">{editFormErrors.loan_amount}</div>
            )}

            {/* 债权人类型 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-creditor_type" className="text-right">
                债权人类型
              </Label>
              <Select 
                value={editForm.creditor_type || ""}
                onValueChange={(value: any) => setEditForm({ ...editForm, creditor_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择债权人类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">个人</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="individual">个体工商户</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 债务人类型 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-debtor_type" className="text-right">
                债务人类型
              </Label>
              <Select
                value={editForm.debtor_type || ""}
                onValueChange={(value: any) => setEditForm({ ...editForm, debtor_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择债务人类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">个人</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="individual">个体工商户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* 案件类型 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-case_type" className="text-right">
                案件类型
              </Label>
              <Select 
                value={editForm.case_type || ""}
                onValueChange={(value: any) => setEditForm({ ...editForm, case_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择案件类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debt">借款纠纷</SelectItem>
                  <SelectItem value="contract">合同纠纷</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 描述 */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">
                描述
              </Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="col-span-3"
                placeholder="请输入案件描述"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleEditCase}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}