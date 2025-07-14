"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User, Save } from "lucide-react";
import { apiClient } from "@/lib/api";

interface StaffInfo {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  phone?: string;
  is_active: boolean;
  is_superuser: boolean;
}

interface StaffUpdateData {
  full_name?: string;
  phone?: string;
  email?: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<StaffUpdateData>({
    full_name: "",
    phone: "",
    email: "",
  });

  // 获取当前员工信息
  const { data: staffData, isLoading, error } = useQuery({
    queryKey: ["current-staff"],
    queryFn: () => apiClient.getCurrentUser(),
  });

  const staff: StaffInfo | undefined = staffData?.data;

  // 更新员工信息
  const updateMutation = useMutation({
    mutationFn: (data: StaffUpdateData) => apiClient.updateCurrentUser(data),
    onSuccess: () => {
      toast.success("个人信息已成功更新");
      queryClient.invalidateQueries({ queryKey: ["current-staff"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "更新个人信息时发生错误");
    },
  });

  // 当获取到员工数据时，初始化表单
  useEffect(() => {
    if (staff) {
      setFormData({
        full_name: staff.full_name || "",
        phone: staff.phone || "",
        email: staff.email || "",
      });
    }
  }, [staff]);

  const handleInputChange = (field: keyof StaffUpdateData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 只提交有变化的字段
    const updateData: StaffUpdateData = {};
    if (formData.full_name !== (staff?.full_name || "")) {
      updateData.full_name = formData.full_name;
    }
    if (formData.phone !== (staff?.phone || "")) {
      updateData.phone = formData.phone;
    }
    if (formData.email !== (staff?.email || "")) {
      updateData.email = formData.email;
    }

    // 如果没有变化，不发送请求
    if (Object.keys(updateData).length === 0) {
      toast({
        title: "无需更新",
        description: "没有检测到信息变化",
      });
      return;
    }

    updateMutation.mutate(updateData);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">加载个人信息失败</p>
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ["current-staff"] })}
            className="mt-2"
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">个人设置</h1>
        <p className="text-muted-foreground">查看和编辑您的个人信息</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            个人信息
          </CardTitle>
          <CardDescription>更新您的个人资料信息</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input 
                  id="username" 
                  value={staff?.username || ""} 
                  disabled 
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">用户名不可修改</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="请输入邮箱"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">姓名</Label>
                <Input 
                  id="fullName" 
                  value={formData.full_name}
                  onChange={(e) => handleInputChange("full_name", e.target.value)}
                  placeholder="请输入姓名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">电话</Label>
                <Input 
                  id="phone" 
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="请输入电话号码"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>账户状态</Label>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    staff?.is_active 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  }`}>
                    {staff?.is_active ? "激活" : "未激活"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>权限级别</Label>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    staff?.is_superuser 
                      ? "bg-blue-100 text-blue-800" 
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {staff?.is_superuser ? "超级管理员" : "普通员工"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                className="flex items-center gap-2"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {updateMutation.isPending ? "保存中..." : "保存更改"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}