"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Staff, StaffCreate, StaffUpdate } from "@/types";
import { Loader2 } from "lucide-react";

interface StaffFormProps {
  initialData?: Partial<Staff>;
  onSubmit: (data: StaffCreate | StaffUpdate) => void;
  isEditing?: boolean;
  isLoading?: boolean;
}

export function StaffForm({ initialData, onSubmit, isEditing = false, isLoading = false }: StaffFormProps) {
  const [formData, setFormData] = useState({
    username: initialData?.username || "",
    email: initialData?.email || "",
    full_name: initialData?.full_name || "",
    phone: initialData?.phone || "",
    password: "",
    is_active: initialData?.is_active ?? true,
    is_superuser: initialData?.is_superuser ?? false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 如果是编辑模式且密码为空，则不更新密码
    const submitData = { ...formData };
    if (isEditing && !submitData.password) {
      delete submitData.password;
    }
    
    onSubmit(submitData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">用户名 *</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => handleChange("username", e.target.value)}
          required
          disabled={isEditing || isLoading} // 编辑时不允许修改用户名
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">邮箱 *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">姓名</Label>
        <Input
          id="full_name"
          value={formData.full_name}
          onChange={(e) => handleChange("full_name", e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">电话</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">
          {isEditing ? "新密码 (留空则不修改)" : "密码 *"}
        </Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => handleChange("password", e.target.value)}
          required={!isEditing}
          disabled={isLoading}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => handleChange("is_active", checked)}
          disabled={isLoading}
        />
        <Label htmlFor="is_active">账户激活</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_superuser"
          checked={formData.is_superuser}
          onCheckedChange={(checked) => handleChange("is_superuser", checked)}
          disabled={isLoading}
        />
        <Label htmlFor="is_superuser">超级管理员权限</Label>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEditing ? "更新员工" : "创建员工"}
      </Button>
    </form>
  );
}