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

  // 初始化表单状态
  const [addForm, setAddForm] = useState({
    user_id: 0,
    case_type: null as null | CaseType,
    creditor_name: "",
    creditor_type: null as null | PartyType,
    debtor_name: null as null | string,
    debtor_type: null as null | PartyType,
    description: null as null | string,
  });

  const [editForm, setEditForm] = useState({
    user_id: 0,
    case_type: null as null | CaseType,
    creditor_name: "",
    creditor_type: null as null | PartyType,
    debtor_name: null as null | string,
    debtor_type: null as null | PartyType,
    description: null as null | string,
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
  const handleAddCase = async () => {
    try {
      await caseApi.createCase(addForm);
      setShowAddDialog(false);
      setAddForm({
        user_id: 0,
        case_type: null,
        creditor_name: "",
        creditor_type: null,
        debtor_name: null,
        debtor_type: null,
        description: null,
      });
      mutate();
    } catch (error) {
      console.error("Failed to create case:", error);
    }
  };

  const handleEditCase = async () => {
    if (!editingCase) return;
    
    try {
      await caseApi.updateCase(editingCase.id, editForm);
      setShowEditDialog(false);
      setEditingCase(null);
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
      case_type: caseItem.case_type as CaseType,
      creditor_name: caseItem.creditor_name,
      creditor_type: caseItem.creditor_type as PartyType,
      debtor_name: caseItem.debtor_name || "",
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
  const renderTable = (cases: Case[]) => (
    <>
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>关联用户</TableHead>
              <TableHead>案件类型</TableHead>
              <TableHead>债权人</TableHead>
              <TableHead>债务人</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((caseItem) => (
              <TableRow key={caseItem.id}>
                <TableCell>{caseItem.user?.name || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {caseTypeLabels[caseItem.case_type as keyof typeof caseTypeLabels] || "-"}
                  </Badge>
                </TableCell>
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
                <TableCell className="max-w-xs truncate">{caseItem.description || "-"}</TableCell>
                <TableCell>{new Date(caseItem.created_at).toLocaleDateString()}</TableCell>
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
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
            <DialogTitle>新增案件</DialogTitle>
            <DialogDescription>
              创建一个新的案件记录
            </DialogDescription>
            </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="user" className="text-right">
                关联用户
              </Label>
              <div className="col-span-3 flex space-x-2">
                  <Select 
                  value={addForm.user_id.toString()}
                  onValueChange={handleUserChange}
                >
                  <SelectTrigger className="flex-1">
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="case_type" className="text-right">
                案件类型
              </Label>
                  <Select 
                    value={addForm.case_type || ""} 
                onValueChange={(value: any) => setAddForm({ ...addForm, case_type: value })}
                  >
                <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                  <SelectItem value="debt">借款纠纷</SelectItem>
                  <SelectItem value="contract">合同纠纷</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="creditor_name" className="text-right">
                债权人
              </Label>
                  <Input 
                id="creditor_name"
                    value={addForm.creditor_name} 
                onChange={(e) => setAddForm({ ...addForm, creditor_name: e.target.value })}
                className="col-span-3"
                  />
                </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="creditor_type" className="text-right">
                债权人类型
              </Label>
                  <Select 
                value={addForm.creditor_type || ""}
                onValueChange={(value: any) => setAddForm({ ...addForm, creditor_type: value })}
                  >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                  <SelectItem value="person">个人</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="individual">个体工商户</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="debtor_name" className="text-right">
                债务人
              </Label>
              <Input
                id="debtor_name"
                value={addForm.debtor_name || ""}
                onChange={(e) => setAddForm({ ...addForm, debtor_name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="debtor_type" className="text-right">
                债务人类型
              </Label>
                  <Select 
                value={addForm.debtor_type || ""}
                onValueChange={(value: any) => setAddForm({ ...addForm, debtor_type: value })}
                  >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                  <SelectItem value="person">个人</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="individual">个体工商户</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                描述
              </Label>
                <Textarea 
                  id="description" 
                  value={addForm.description || ""} 
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                className="col-span-3"
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑案件</DialogTitle>
            <DialogDescription>
              修改案件信息
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-user" className="text-right">
                关联用户
              </Label>
              <Select 
                value={editForm.user_id.toString()}
                onValueChange={handleEditUserChange}
              >
                <SelectTrigger className="col-span-3">
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-case_type" className="text-right">
                案件类型
              </Label>
              <Select 
                value={editForm.case_type || ""}
                onValueChange={(value: any) => setEditForm({ ...editForm, case_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debt">借款纠纷</SelectItem>
                  <SelectItem value="contract">合同纠纷</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-creditor_name" className="text-right">
                债权人
              </Label>
              <Input
                id="edit-creditor_name"
                value={editForm.creditor_name}
                onChange={(e) => setEditForm({ ...editForm, creditor_name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-creditor_type" className="text-right">
                债权人类型
              </Label>
              <Select 
                value={editForm.creditor_type || ""}
                onValueChange={(value: any) => setEditForm({ ...editForm, creditor_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">个人</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="individual">个体工商户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-debtor_name" className="text-right">
                债务人
              </Label>
              <Input
                id="edit-debtor_name"
                value={editForm.debtor_name || ""}
                onChange={(e) => setEditForm({ ...editForm, debtor_name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-debtor_type" className="text-right">
                债务人类型
              </Label>
              <Select
                value={editForm.debtor_type || ""}
                onValueChange={(value: any) => setEditForm({ ...editForm, debtor_type: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">个人</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="individual">个体工商户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">
                描述
              </Label>
              <Textarea
                id="edit-description"
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="col-span-3"
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