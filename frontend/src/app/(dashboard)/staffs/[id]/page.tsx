"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, Edit, Save, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const staffFormSchema = z.object({
  username: z.string().optional(),
  email: z.string().email("请输入有效的邮箱地址").optional(),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(8, "密码至少8位").optional().or(z.literal("")),
  is_active: z.boolean().optional(),
  is_superuser: z.boolean().optional(),
});

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = parseInt(params.id as string);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // 获取员工详情
  const { data: staffData, isLoading } = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => apiClient.getStaff(staffId),
  });

  const form = useForm<z.infer<typeof staffFormSchema>>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      username: "",
      email: "",
      full_name: "",
      phone: "",
      password: "",
      is_active: true,
      is_superuser: false,
    },
  });

  // 当员工数据加载完成时，更新表单默认值
  React.useEffect(() => {
    if (staffData?.data) {
      const staff = staffData.data;
      form.reset({
        username: staff.username,
        email: staff.email,
        full_name: staff.full_name || "",
        phone: staff.phone || "",
        password: "", // 密码字段保持空白
        is_active: staff.is_active,
        is_superuser: staff.is_superuser,
      });
    }
  }, [staffData, form]);

  // 更新员工信息
  const updateStaffMutation = useMutation({
    mutationFn: (data: z.infer<typeof staffFormSchema>) =>
      apiClient.updateStaff(staffId, data),
    onSuccess: () => {
      toast.success("员工信息更新成功");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staffs"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "更新失败");
    },
  });

  // 删除员工
  const deleteStaffMutation = useMutation({
    mutationFn: () => apiClient.deleteStaff(staffId),
    onSuccess: () => {
      toast.success("员工删除成功");
      router.push("/staffs");
    },
    onError: (error: any) => {
      toast.error(error.message || "删除失败");
    },
  });

  const onSubmit = (data: z.infer<typeof staffFormSchema>) => {
    // 过滤掉空的密码字段
    const updateData = { ...data };
    if (!updateData.password || updateData.password.trim() === "") {
      delete updateData.password;
    }
    
    // 只提交有值的字段
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => {
        return value !== undefined && value !== null && value !== "";
      })
    );
    
    updateStaffMutation.mutate(filteredData);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    // 重置表单到原始数据
    if (staffData?.data) {
      const staff = staffData.data;
      form.reset({
        username: staff.username,
        email: staff.email,
        full_name: staff.full_name || "",
        phone: staff.phone || "",
        password: "",
        is_active: staff.is_active,
        is_superuser: staff.is_superuser,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载员工信息中...</div>
      </div>
    );
  }

  if (!staffData?.data) {
    return (
      <div className="text-center text-red-500 p-8">
        员工信息不存在
      </div>
    );
  }

  const staff = staffData.data;

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/staffs")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回员工列表
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {staff.full_name || staff.username}
            </h1>
            <p className="text-muted-foreground">员工详细信息</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {!isEditing ? (
            <>
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                编辑
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定要删除员工 "{staff.full_name || staff.username}" 吗？此操作无法撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteStaffMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleEditCancel}
              >
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={updateStaffMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 员工信息卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 基本信息 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent>
              {!isEditing ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-lg">
                        {staff.full_name ? staff.full_name.charAt(0) : staff.username.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-semibold">
                        {staff.full_name || staff.username}
                      </h3>
                      <p className="text-muted-foreground">{staff.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        用户名
                      </label>
                      <p className="mt-1">{staff.username}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        邮箱
                      </label>
                      <p className="mt-1">{staff.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        姓名
                      </label>
                      <p className="mt-1">{staff.full_name || "-"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        手机号
                      </label>
                      <p className="mt-1">{staff.phone || "-"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <Form {...form}>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>用户名</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>邮箱</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="full_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>姓名</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>手机号</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>密码（留空则不修改）</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 权限和状态 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>权限和状态</CardTitle>
            </CardHeader>
            <CardContent>
              {!isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      账户状态
                    </label>
                    <div className="mt-1">
                      <Badge variant={staff.is_active ? "default" : "secondary"}>
                        {staff.is_active ? "活跃" : "禁用"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      角色权限
                    </label>
                    <div className="mt-1">
                      <Badge variant={staff.is_superuser ? "default" : "secondary"}>
                        {staff.is_superuser ? "超级管理员" : "普通员工"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      员工ID
                    </label>
                    <p className="mt-1 text-sm text-muted-foreground">#{staff.id}</p>
                  </div>
                </div>
              ) : (
                <Form {...form}>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="is_active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>账户状态</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              启用或禁用此员工账户
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="is_superuser"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>超级管理员</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              授予管理员权限
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}