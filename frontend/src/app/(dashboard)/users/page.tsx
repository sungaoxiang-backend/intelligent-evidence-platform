"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Search, Edit, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { User } from "@/types";
import { UserForm } from "@/components/users/user-form";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Suspense } from "react";

function UsersContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const queryClient = useQueryClient();

  // 获取用户列表
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['users', currentPage, pageSize],
    queryFn: () => apiClient.getUsers({ 
      skip: (currentPage - 1) * pageSize, 
      limit: pageSize 
    }),
  });

  // 变量定义（只保留一次）
  const users = usersData?.data || [];
  const pagination = usersData?.pagination;

  // 删除用户
  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => apiClient.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("用户删除成功");
    },
    onError: (error: any) => {
      toast.error(error.message || "删除用户失败");
    },
  });

  // 过滤用户
  const filteredUsers = users.filter((user: User) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.phone && user.phone.includes(searchTerm)) ||
    (user.id_card && user.id_card.includes(searchTerm))
  );

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleDelete = async (userId: number) => {
    if (window.confirm("确定要删除这个用户吗？")) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingUser(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm text-muted-foreground">加载用户数据中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-8">
        加载用户列表失败，请重试
      </div>
    );
  }

  // 在JSX的底部使用标准分页组件
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground">管理系统中的用户信息</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增用户
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>
            共 {pagination?.total || 0} 个用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户姓名、手机号或身份证号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* 用户表格 */}
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-4 text-left align-middle font-medium">姓名</th>
                  <th className="h-12 px-4 text-left align-middle font-medium">身份证号</th>
                  <th className="h-12 px-4 text-left align-middle font-medium">手机号</th>
                  <th className="h-12 px-4 text-left align-middle font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-24 text-center text-muted-foreground">
                      {searchTerm ? "未找到匹配的用户" : "暂无用户数据"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user: User) => (
                    <tr key={user.id} className="border-b">
                      <td className="p-4 align-middle">
                        <div className="font-medium">{user.name}</div>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="text-muted-foreground">
                          {user.id_card || "-"}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <span className="text-muted-foreground">
                          {user.phone || "-"}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 用户表单对话框 */}
      {isFormOpen && (
        <UserForm
          user={editingUser}
          onClose={handleFormClose}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            handleFormClose();
          }}
        />
      )}
      
      {/* 使用标准的shadcn/ui分页组件 */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                  className={currentPage >= pagination.pages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          
          <div className="text-sm text-muted-foreground mt-2 text-center">
            显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, pagination.total)} 条，共 {pagination.total} 条
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    }>
      <UsersContent />
    </Suspense>
  );
}