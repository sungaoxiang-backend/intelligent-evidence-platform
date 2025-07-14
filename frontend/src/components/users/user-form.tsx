"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { User, UserCreate } from "@/types";

interface UserFormProps {
  user?: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserForm({ user, onClose, onSuccess }: UserFormProps) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    id_card: user?.id_card || "",
    phone: user?.phone || "",
  });

  const isEditing = !!user;

  // 创建用户
  const createUserMutation = useMutation({
    mutationFn: (data: UserCreate) => apiClient.createUser(data),
    onSuccess: () => {
      toast.success("用户创建成功");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "创建用户失败");
    },
  });

  // 更新用户
  const updateUserMutation = useMutation({
    mutationFn: (data: { id: number; userData: Partial<UserCreate> }) =>
      apiClient.updateUser(data.id, data.userData),
    onSuccess: () => {
      toast.success("用户更新成功");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "更新用户失败");
    },
  });

  // 添加输入验证函数
  const validateIdCard = (value: string): string | null => {
    if (!value.trim()) return null;
    const cleaned = value.trim();
    if (![15, 18].includes(cleaned.length)) {
      return "身份证号码必须是15位或18位";
    }
    if (cleaned.length === 18 && !/^\d{17}[\dXx]$/.test(cleaned)) {
      return "18位身份证号码格式不正确";
    }
    if (cleaned.length === 15 && !/^\d{15}$/.test(cleaned)) {
      return "15位身份证号码格式不正确";
    }
    return null;
  };
  
  const validatePhone = (value: string): string | null => {
    if (!value.trim()) return null;
    const cleaned = value.replace(/[\s\-\(\)]/g, '');
    if (!/^1[3-9]\d{9}$/.test(cleaned)) {
      return "手机号码格式不正确";
    }
    return null;
  };
  
  // 在handleSubmit中添加验证
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!formData.name.trim()) {
      toast.error("请输入用户姓名");
      return;
    }
  
    // 验证身份证
    const idCardError = validateIdCard(formData.id_card);
    if (idCardError) {
      toast.error(idCardError);
      return;
    }
  
    // 验证手机号
    const phoneError = validatePhone(formData.phone);
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
  
    if (isEditing && user) {
      updateUserMutation.mutate({
        id: user.id,
        userData: formData,
      });
    } else {
      createUserMutation.mutate(formData);
    }
  };

  const isLoading = createUserMutation.isPending || updateUserMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{isEditing ? "编辑用户" : "新增用户"}</CardTitle>
              <CardDescription>
                {isEditing ? "修改用户信息" : "创建新的用户"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入用户姓名"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_card">身份证号</Label>
              // 更新输入框
              <Input
                id="id_card"
                value={formData.id_card}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\dXx]/g, '').toUpperCase();
                  setFormData({ ...formData, id_card: value });
                }}
                maxLength={18}
                placeholder="请输入15位或18位身份证号码"
              />
              
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d]/g, '');
                  setFormData({ ...formData, phone: value });
                }}
                maxLength={11}
                placeholder="请输入11位手机号码"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "更新" : "创建"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}