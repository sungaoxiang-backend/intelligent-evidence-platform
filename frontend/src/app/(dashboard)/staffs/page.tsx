"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Edit, Trash2, UserCheck, UserX, Loader2 } from "lucide-react";
import { StaffForm } from "@/components/staffs/staff-form";
import { Staff, StaffCreate, StaffUpdate } from "@/types";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

export default function StaffsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const queryClient = useQueryClient();

  // 获取员工列表
  const { data: staffsData, isLoading, error } = useQuery({
    queryKey: ['staffs'],
    queryFn: () => apiClient.getStaffs(),
  });

  const staffs = staffsData?.data || [];

  // 创建员工
  const createMutation = useMutation({
    mutationFn: (data: StaffCreate) => apiClient.createStaff(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffs'] });
      setIsCreateDialogOpen(false);
      toast.success("员工创建成功");
    },
    onError: (error: any) => {
      toast.error(error.message || "创建失败");
    },
  });

  // 更新员工
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: StaffUpdate }) => 
      apiClient.updateStaff(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffs'] });
      setEditingStaff(null);
      toast.success("员工信息更新成功");
    },
    onError: (error: any) => {
      toast.error(error.message || "更新失败");
    },
  });

  // 删除员工
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffs'] });
      toast.success("员工删除成功");
    },
    onError: (error: any) => {
      toast.error(error.message || "删除失败");
    },
  });

  const filteredStaffs = staffs.filter(
    (staff: Staff) =>
      staff.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (staff.full_name && staff.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateStaff = (staffData: StaffCreate) => {
    createMutation.mutate(staffData);
  };

  const handleUpdateStaff = (staffData: StaffUpdate) => {
    if (!editingStaff) return;
    updateMutation.mutate({ id: editingStaff.id, data: staffData });
  };

  const handleDeleteStaff = (id: number) => {
    if (confirm("确定要删除这个员工吗？")) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleStatus = (staff: Staff) => {
    const updateData: StaffUpdate = {
      is_active: !staff.is_active
    };
    updateMutation.mutate({ id: staff.id, data: updateData });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-red-600">加载员工数据失败</p>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['staffs'] })}
            className="mt-4"
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">员工管理</h1>
          <p className="text-muted-foreground">管理系统员工账户和权限</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新增员工
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新增员工</DialogTitle>
              <DialogDescription>
                创建新的员工账户
              </DialogDescription>
            </DialogHeader>
            <StaffForm 
              onSubmit={handleCreateStaff} 
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>员工列表</CardTitle>
          <CardDescription>
            {isLoading ? "加载中..." : `共 ${staffs.length} 名员工`}
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索员工..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>员工</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaffs.map((staff: Staff) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {staff.full_name ? staff.full_name.charAt(0) : staff.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{staff.full_name || staff.username}</div>
                          <div className="text-sm text-muted-foreground">@{staff.username}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{staff.email}</div>
                        {staff.phone && (
                          <div className="text-sm text-muted-foreground">{staff.phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.is_superuser ? "default" : "secondary"}>
                        {staff.is_superuser ? "超级管理员" : "普通员工"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.is_active ? "default" : "secondary"}>
                        {staff.is_active ? "活跃" : "禁用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingStaff(staff)}>
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleToggleStatus(staff)}
                            disabled={updateMutation.isPending}
                          >
                            {staff.is_active ? (
                              <><UserX className="mr-2 h-4 w-4" />禁用</>
                            ) : (
                              <><UserCheck className="mr-2 h-4 w-4" />启用</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteStaff(staff.id)}
                            className="text-red-600"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 编辑对话框 */}
      <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑员工</DialogTitle>
            <DialogDescription>
              修改员工信息
            </DialogDescription>
          </DialogHeader>
          {editingStaff && (
            <StaffForm 
              initialData={editingStaff} 
              onSubmit={handleUpdateStaff} 
              isEditing
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}