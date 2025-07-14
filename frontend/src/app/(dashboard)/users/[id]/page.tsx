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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, Edit, Save, X, Trash2, Loader2 } from "lucide-react";
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

const userFormSchema = z.object({
  name: z.string().min(1, "姓名不能为空").max(100, "姓名长度不能超过100个字符"),
  id_card: z.string().optional().refine((val) => {
    if (!val || val.trim() === '') return true;
    const cleaned = val.trim();
    // 检查长度
    if (![15, 18].includes(cleaned.length)) {
      return false;
    }
    // 检查格式
    if (cleaned.length === 18) {
      return /^\d{17}[\dXx]$/.test(cleaned);
    } else {
      return /^\d{15}$/.test(cleaned);
    }
  }, {
    message: "身份证号码格式不正确（应为15位或18位数字，18位身份证最后一位可以是X）"
  }),
  phone: z.string().optional().refine((val) => {
    if (!val || val.trim() === '') return true;
    const cleaned = val.replace(/[\s\-\(\)]/g, '');
    return /^1[3-9]\d{9}$/.test(cleaned);
  }, {
    message: "手机号码格式不正确（应为11位数字，以1开头）"
  })
});

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = parseInt(params.id as string);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // 获取用户详情
  const { data: userData, isLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => apiClient.getUser(userId),
  });

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      id_card: "",
      phone: "",
    },
  });

  // 当用户数据加载完成时，更新表单默认值
  React.useEffect(() => {
    if (userData?.data) {
      const user = userData.data;
      form.reset({
        name: user.name,
        id_card: user.id_card || "",
        phone: user.phone || "",
      });
    }
  }, [userData, form]);

  // 更新用户信息
  const updateUserMutation = useMutation({
    mutationFn: (data: z.infer<typeof userFormSchema>) =>
      apiClient.updateUser(userId, data),
    onSuccess: () => {
      toast.success("用户信息更新成功");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["user", userId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "更新失败");
    },
  });

  // 删除用户
  const deleteUserMutation = useMutation({
    mutationFn: () => apiClient.deleteUser(userId),
    onSuccess: () => {
      toast.success("用户删除成功");
      router.push("/users");
    },
    onError: (error: any) => {
      toast.error(error.message || "删除失败");
    },
  });

  const onSubmit = (data: z.infer<typeof userFormSchema>) => {
    // 只提交有值的字段
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => {
        return value !== undefined && value !== null && value !== "";
      })
    );
    
    updateUserMutation.mutate(filteredData);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    // 重置表单到原始数据
    if (userData?.data) {
      const user = userData.data;
      form.reset({
        name: user.name,
        id_card: user.id_card || "",
        phone: user.phone || "",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!userData?.data) {
    return (
      <div className="text-center text-red-500 p-8">
        用户信息不存在
      </div>
    );
  }

  const user = userData.data;

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/users")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回用户列表
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {user.name}
            </h1>
            <p className="text-muted-foreground">用户详细信息</p>
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
                      确定要删除用户 "{user.name}" 吗？此操作无法撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteUserMutation.mutate()}
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
                disabled={updateUserMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 用户信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          {!isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    姓名
                  </label>
                  <p className="mt-1 text-lg font-medium">{user.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    身份证号
                  </label>
                  <p className="mt-1">{user.id_card || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    手机号
                  </label>
                  <p className="mt-1">{user.phone || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    用户ID
                  </label>
                  <p className="mt-1 text-sm text-muted-foreground">#{user.id}</p>
                </div>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
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
                    name="id_card"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>身份证号</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            maxLength={18}
                            placeholder="请输入15位或18位身份证号码"
                            onChange={(e) => {
                              // 只允许输入数字和X
                              const value = e.target.value.replace(/[^\dXx]/g, '').toUpperCase();
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>手机号</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          maxLength={11}
                          placeholder="请输入11位手机号码"
                          onChange={(e) => {
                            // 只允许输入数字
                            const value = e.target.value.replace(/[^\d]/g, '');
                            field.onChange(value);
                          }}
                        />
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
  );
}