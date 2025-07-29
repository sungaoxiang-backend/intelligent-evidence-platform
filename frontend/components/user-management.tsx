"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import { userApi } from "@/lib/user-api";
import { ListPage } from "@/components/common/list-page";
import { usePaginatedSWR } from "@/hooks/use-paginated-swr";
import { SortableHeader, formatDateTime, type SortDirection } from "@/components/common/sortable-header";
import type { User } from "@/lib/types";

export default function UserManagement() {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [sort, setSort] = useState<{ field: string; direction: SortDirection }>({
    field: "created_at",
    direction: "desc"
  });

  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    id_card: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    id_card: "",
  });

  // Use paginated SWR hook
  const {
    data: users,
    loading,
    error,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    mutate
  } = usePaginatedSWR<User>(
    "/users",
    (params) => userApi.getUsers(params),
    [],
  );

  const handleAddUser = async () => {
    try {
      await userApi.createUser(addForm);
      setShowAddDialog(false);
      setAddForm({
        name: "",
        email: "",
        phone: "",
        id_card: "",
      });
      mutate();
    } catch (error) {
      console.error("Failed to create user:", error);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    
    try {
      await userApi.updateUser(editingUser.id, editForm);
      setShowEditDialog(false);
      setEditingUser(null);
      mutate();
    } catch (error) {
      console.error("Failed to update user:", error);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("确定要删除这个用户吗？")) return;
    
    try {
      await userApi.deleteUser(id);
      mutate();
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const handleSort = (field: string, direction: SortDirection) => {
    setSort({ field, direction });
  };

  // 对数据进行排序
  const getSortedUsers = (users: User[]) => {
    if (!sort.field || !sort.direction) {
      return users;
    }

    return [...users].sort((a, b) => {
      let aValue: any = a[sort.field as keyof User];
      let bValue: any = b[sort.field as keyof User];

      // 处理时间字段
      if (sort.field === 'created_at' || sort.field === 'updated_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
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

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email || "",
      phone: user.phone || "",
      id_card: user.id_card || "",
    });
    setShowEditDialog(true);
  };

  const openAddDialog = () => {
    setShowAddDialog(true);
  };

  const handleViewUserCases = (userId: number) => {
    router.push(`/cases?user_id=${userId}`);
  };

  const renderTable = (users: User[]) => {
    const sortedUsers = getSortedUsers(users);
    
    return (
    <>
      {/* Users Table */}
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>身份证号</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>邮箱</TableHead>
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
            {sortedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.id_card || "-"}</TableCell>
                <TableCell>{user.phone || "-"}</TableCell>
                <TableCell>{user.email || "-"}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatDateTime(user.created_at)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatDateTime(user.updated_at)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewUserCases(user.id)}
                      className="flex items-center text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      查看案件
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
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
        title="用户管理"
        subtitle="管理系统中的所有用户信息"
        headerActions={
          <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            新增用户
          </Button>
        }
        data={users}
        loading={loading}
        error={error}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        renderTable={renderTable}
        emptyMessage="暂无用户数据"
        emptyAction={
          <Button onClick={openAddDialog} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            创建第一个用户
          </Button>
        }
      />

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
            <DialogDescription>
              创建一个新的用户记录
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                姓名
              </Label>
              <Input
                id="name"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="id_card" className="text-right">
                身份证号
              </Label>
              <Input
                id="id_card"
                value={addForm.id_card}
                onChange={(e) => setAddForm({ ...addForm, id_card: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                手机号
              </Label>
              <Input
                id="phone"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                邮箱
              </Label>
              <Input
                id="email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddUser}>
              创建用户
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>
              修改用户信息
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                姓名
              </Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-id_card" className="text-right">
                身份证号
              </Label>
              <Input
                id="edit-id_card"
                value={editForm.id_card}
                onChange={(e) => setEditForm({ ...editForm, id_card: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-phone" className="text-right">
                手机号
              </Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                邮箱
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleEditUser}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}