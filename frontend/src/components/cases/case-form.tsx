"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Case, CaseCreate, CaseType, PartyType } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const caseFormSchema = z.object({
  title: z.string().min(1, "案件标题不能为空"),
  description: z.string().optional(),
  case_number: z.string().min(1, "案件编号不能为空"),
  case_type: z.nativeEnum(CaseType, {
    required_error: "请选择案件类型",
  }),
  creaditor_name: z.string().min(1, "债权人姓名不能为空"),
  creditor_type: z.nativeEnum(PartyType).optional(),
  debtor_name: z.string().min(1, "债务人姓名不能为空"),
  debtor_type: z.nativeEnum(PartyType).optional(),
  user_id: z.number().min(1, "请选择关联用户"),
  assigned_staff_id: z.number().optional(),
});

type CaseFormValues = z.infer<typeof caseFormSchema>;

interface CaseFormProps {
  case?: Case;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CASE_TYPE_OPTIONS = [
  { value: CaseType.DEBT, label: "借款纠纷" },
  { value: CaseType.CONTRACT, label: "合同纠纷" },
];

const PARTY_TYPE_OPTIONS = [
  { value: PartyType.PERSON, label: "个人" },
  { value: PartyType.COMPANY, label: "公司" },
  { value: PartyType.INDIVIDUAL, label: "个体工商户" },
];

export function CaseForm({ case: editingCase, onSuccess, onCancel }: CaseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      title: editingCase?.title || "",
      description: editingCase?.description || "",
      case_number: editingCase?.case_number || "",
      case_type: editingCase?.case_type || undefined,
      creaditor_name: editingCase?.creaditor_name || "",
      creditor_type: editingCase?.creditor_type || undefined,
      debtor_name: editingCase?.debtor_name || "",
      debtor_type: editingCase?.debtor_type || undefined,
      user_id: editingCase?.user_id || undefined,
      assigned_staff_id: editingCase?.assigned_staff_id || undefined,
    },
  });

  // 获取用户列表
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.getUsers({ skip: 0, limit: 100 }),
  });

  // 获取员工列表
  const { data: staffsData } = useQuery({
    queryKey: ["staffs"],
    queryFn: () => apiClient.getStaffs({ skip: 0, limit: 100 }),
  });

  // 创建案件
  const createCaseMutation = useMutation({
    mutationFn: (data: CaseCreate) => apiClient.createCase(data),
    onSuccess: () => {
      toast.success("案件创建成功");
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "案件创建失败");
    },
  });

  // 更新案件
  const updateCaseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CaseCreate> }) =>
      apiClient.updateCase(id, data),
    onSuccess: () => {
      toast.success("案件更新成功");
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "案件更新失败");
    },
  });

  const onSubmit = async (values: CaseFormValues) => {
    setIsSubmitting(true);
    try {
      if (editingCase) {
        await updateCaseMutation.mutateAsync({
          id: editingCase.id,
          data: values,
        });
      } else {
        await createCaseMutation.mutateAsync(values);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const users = usersData?.data || [];
  const staffs = staffsData?.data || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 案件基本信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">基本信息</h3>
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>案件标题 *</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入案件标题" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="case_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>案件编号 *</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入案件编号" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="case_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>案件类型 *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择案件类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CASE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>案件描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入案件描述"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 当事人信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">当事人信息</h3>
            
            <FormField
              control={form.control}
              name="creaditor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>债权人姓名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入债权人姓名" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="creditor_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>债权人类型</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择债权人类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PARTY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="debtor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>债务人姓名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入债务人姓名" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="debtor_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>债务人类型</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择债务人类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PARTY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* 关联信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="user_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>关联用户 *</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  defaultValue={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择关联用户" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="assigned_staff_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>分配员工</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                  defaultValue={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择分配员工" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="0">不分配</SelectItem>
                    {staffs.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id.toString()}>
                        {staff.username} ({staff.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "保存中..." : editingCase ? "更新案件" : "创建案件"}
          </Button>
        </div>
      </form>
    </Form>
  );
}