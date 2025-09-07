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
    wechat_nickname: "",
    wechat_number: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    wechat_nickname: "",
    wechat_number: "",
  });

  // Use paginated SWR hook with sorting
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
    (params) => {
      const apiParams: any = {
        ...params,
        sort_by: sort.field,
        sort_order: sort.direction || "desc" // 提供默认值，避免null
      };
      return userApi.getUsers(apiParams);
    },
    [sort.field, sort.direction], // Add sorting as dependencies
  );

  const handleAddUser = async () => {
    try {
      await userApi.createUser(addForm);
      setShowAddDialog(false);
      setAddForm({
        name: "",
        wechat_nickname: "",
        wechat_number: "",
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

  // 移除客户端排序逻辑，使用服务端排序
  const sortedUsers = users || [];

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      wechat_nickname: user.wechat_nickname || "",
      wechat_number: user.wechat_number || "",
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
    return (
    <>
      {/* Users Table */}
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>头像</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>微信昵称</TableHead>
              <TableHead>微信号</TableHead>
              <TableHead>企微用户ID</TableHead>
              <TableHead>类型</TableHead>
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
            {users.map((user) => (
              <TableRow key={user.id}>
                {/* 头像预览 */}
                <TableCell>
                  <div className="flex items-center">
                    {user.wechat_avatar ? (
                      <img 
                        src={user.wechat_avatar} 
                        alt="头像" 
                        className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => {
                          // 头像加载失败时显示默认头像
                          const target = e.currentTarget as HTMLImageElement;
                          target.src = "/api/placeholder/40/40";
                          target.className = "w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500";
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                        {user.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                </TableCell>
                
                {/* 姓名 */}
                <TableCell className="font-medium">{user.name}</TableCell>
                
                {/* 微信昵称 */}
                <TableCell>{user.wechat_nickname || "-"}</TableCell>
                
                {/* 微信号 */}
                <TableCell>{user.wechat_number || "-"}</TableCell>
                
                {/* 企微用户ID */}
                <TableCell className="text-sm text-gray-600 font-mono max-w-32 truncate" title={user.wechat_number || ""}>
                  {user.wechat_number || "-"}
                </TableCell>
                
                {/* 用户类型 */}
                <TableCell>
                  <div className="flex items-center">
                    {user.wechat_avatar ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        企微客户
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        系统用户
                      </span>
                    )}
                  </div>
                </TableCell>
                
                {/* 创建时间 */}
                <TableCell className="text-sm text-gray-600">
                  {formatDateTime(user.created_at)}
                </TableCell>
                
                {/* 更新时间 */}
                <TableCell className="text-sm text-gray-600">
                  {formatDateTime(user.updated_at)}
                </TableCell>
                
                {/* 操作按钮 */}
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
              <Label htmlFor="wechat_nickname" className="text-right">
                微信昵称
              </Label>
              <Input
                id="wechat_nickname"
                value={addForm.wechat_nickname}
                onChange={(e) => setAddForm({ ...addForm, wechat_nickname: e.target.value })}
                className="col-span-3"
                placeholder="可选"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wechat_number" className="text-right">
                微信号
              </Label>
              <Input
                id="wechat_number"
                value={addForm.wechat_number}
                onChange={(e) => setAddForm({ ...addForm, wechat_number: e.target.value })}
                className="col-span-3"
                placeholder="可选"
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
              <Label htmlFor="edit-wechat_nickname" className="text-right">
                微信昵称
              </Label>
              <Input
                id="edit-wechat_nickname"
                value={editForm.wechat_nickname}
                onChange={(e) => setEditForm({ ...editForm, wechat_nickname: e.target.value })}
                className="col-span-3"
                placeholder="可选"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-wechat_number" className="text-right">
                微信号
              </Label>
              <Input
                id="edit-wechat_number"
                value={editForm.wechat_number}
                onChange={(e) => setEditForm({ ...editForm, wechat_number: e.target.value })}
                className="col-span-3"
                placeholder="可选"
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