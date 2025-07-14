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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, Edit, Save, X, Upload, FileText, Trash2 } from "lucide-react";
import { CaseType, PartyType, Evidence } from "@/types";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const CASE_TYPE_LABELS = {
  [CaseType.DEBT]: "借款纠纷",
  [CaseType.CONTRACT]: "合同纠纷",
};

const PARTY_TYPE_LABELS = {
  [PartyType.PERSON]: "个人",
  [PartyType.COMPANY]: "公司",
  [PartyType.INDIVIDUAL]: "个体工商户",
};

// 修复并完善 caseFormSchema
const caseFormSchema = z.object({
  title: z.string().optional(),
  case_type: z.string().optional(),
  creditor_name: z.string().optional(),
  debtor_name: z.string().optional(),
  description: z.string().optional(),
  creditor_type: z.string().nullable().optional(),
  debtor_type: z.string().nullable().optional(), // 添加 .nullable() 来处理 null 值
  user_id: z.number().optional(),
  assigned_staff_id: z.number().optional(),
  case_number: z.string().optional(),
});

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = parseInt(params.id as string);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const { data: caseData, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => apiClient.getCase(caseId),
  });

  const { data: evidencesData, isLoading: isLoadingEvidences } = useQuery({
    queryKey: ["evidences", caseId],
    queryFn: () => apiClient.getEvidences({ case_id: caseId }),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.getUsers(),
  });

  const { data: staffsData } = useQuery({
    queryKey: ["staffs"],
    queryFn: () => apiClient.getStaffs(),
  });

  const uploadEvidenceMutation = useMutation({
    mutationFn: (file: File) => apiClient.uploadEvidence(caseId, file),
    onSuccess: () => {
      toast.success("证据上传成功");
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["evidences", caseId] });
    },
    onError: () => {
      toast.error("证据上传失败");
    },
  });

  const deleteEvidenceMutation = useMutation({
    mutationFn: (evidenceId: number) => apiClient.deleteEvidence(evidenceId),
    onSuccess: () => {
      toast.success("证据删除成功");
      queryClient.invalidateQueries({ queryKey: ["evidences", caseId] });
    },
    onError: () => {
      toast.error("证据删除失败");
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadEvidenceMutation.mutate(selectedFile);
    }
  };

  const handleDeleteEvidence = (evidenceId: number) => {
    if (confirm("确定要删除这个证据吗？")) {
      deleteEvidenceMutation.mutate(evidenceId);
    }
  };

  const form = useForm<z.infer<typeof caseFormSchema>>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      title: "",
      case_type: CaseType.DEBT,
      creditor_name: "",
      creditor_type: undefined,
      debtor_name: "",
      debtor_type: undefined,
      description: "",
      user_id: undefined,
      assigned_staff_id: undefined,
      case_number: "",
    },
  });

  // 当案件数据加载完成时，更新表单默认值
  React.useEffect(() => {
    if (caseData?.data) {
      const case_ = caseData.data;
      form.reset({
        title: case_.title,
        case_type: case_.case_type,
        creditor_name: case_.creditor_name,
        creditor_type: case_.creditor_type,
        debtor_name: case_.debtor_name,
        debtor_type: case_.debtor_type,
        description: case_.description || "",
        user_id: case_.user_id,
        assigned_staff_id: case_.assigned_staff_id,
        case_number: case_.case_number,
      });
    }
  }, [caseData, form]);

  const updateCaseMutation = useMutation({
    mutationFn: (data: z.infer<typeof caseFormSchema>) =>
      apiClient.updateCase(caseId, data),
    onSuccess: () => {
      toast.success("案件更新成功");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: () => {
      toast.error("案件更新失败");
    },
  });

  // 修复 onSubmit 函数
  const onSubmit = (data: z.infer<typeof caseFormSchema>) => {
    // 只提交有值的字段
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => {
        return value !== undefined && value !== null && value !== "";
      })
    );
    
    // 基本验证
    if (updateData.title && !updateData.title.trim()) {
      toast.error("请输入案件标题");
      return;
    }
    
    console.log('提交的数据:', updateData);
    updateCaseMutation.mutate(updateData);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  if (!caseData?.data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">案件不存在</div>
      </div>
    );
  }

  const users = usersData?.data || [];
  const staffs = staffsData?.data || [];

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/cases")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回案件列表
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          {!isEditing && (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              编辑案件
            </Button>
          )}
        </div>
      </div>

      {/* 案件标题 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {form.watch("title") || "案件详情"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isEditing ? "编辑案件信息" : "查看案件详情"}
        </p>
      </div>

      {/* 统一的表单布局 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">基本信息</h3>
              
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>案件标题 *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!isEditing}
                        className={!isEditing ? "bg-muted" : ""}
                      />
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
                      <Input
                        {...field}
                        disabled={!isEditing}
                        className={!isEditing ? "bg-muted" : ""}
                      />
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!isEditing}
                    >
                      <FormControl>
                        <SelectTrigger className={!isEditing ? "bg-muted" : ""}>
                          <SelectValue placeholder="请选择案件类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={CaseType.DEBT}>借款纠纷</SelectItem>
                        <SelectItem value={CaseType.CONTRACT}>合同纠纷</SelectItem>
                      </SelectContent>
                    </Select>
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
                name="creditor_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>债权人姓名 *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!isEditing}
                        className={!isEditing ? "bg-muted" : ""}
                      />
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
                    <Select
                      onValueChange={(value) => field.onChange(value || undefined)}
                      value={field.value || ""}
                      disabled={!isEditing}
                    >
                      <FormControl>
                        <SelectTrigger className={!isEditing ? "bg-muted" : ""}>
                          <SelectValue placeholder="请选择债权人类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="person">个人</SelectItem>
                        <SelectItem value="company">公司</SelectItem>
                        <SelectItem value="individual">个体工商户</SelectItem>
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
                      <Input
                        {...field}
                        disabled={!isEditing}
                        className={!isEditing ? "bg-muted" : ""}
                      />
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
                    <Select
                      onValueChange={(value) => field.onChange(value || undefined)}
                      value={field.value || ""}
                      disabled={!isEditing}
                    >
                      <FormControl>
                        <SelectTrigger className={!isEditing ? "bg-muted" : ""}>
                          <SelectValue placeholder="请选择债务人类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="person">个人</SelectItem>
                        <SelectItem value="company">公司</SelectItem>
                        <SelectItem value="individual">个体工商户</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* 案件描述 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">案件描述</h3>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="请输入案件描述"
                      rows={6}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-muted" : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 分配信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>关联用户</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                    value={field.value?.toString()}
                    disabled={!isEditing}
                  >
                    <FormControl>
                      <SelectTrigger className={!isEditing ? "bg-muted" : ""}>
                        <SelectValue placeholder="请选择关联用户" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">不分配</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.username}
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
                    value={field.value?.toString()}
                    disabled={!isEditing}
                  >
                    <FormControl>
                      <SelectTrigger className={!isEditing ? "bg-muted" : ""}>
                        <SelectValue placeholder="请选择分配员工" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">不分配</SelectItem>
                      {staffs.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id.toString()}>
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 编辑模式下的按钮 */}
          {isEditing && (
            <div className="flex justify-end space-x-2 pt-6">
              <Button
                type="submit"
                disabled={updateCaseMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleEditCancel}
              >
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
            </div>
          )}
        </form>
      </Form>

      {/* 证据管理 */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">证据管理</h2>
          <p className="text-muted-foreground mt-2">管理与此案件相关的证据文件</p>
        </div>

        {/* 上传证据 */}
        <div className="flex items-center space-x-2">
          <Input type="file" onChange={handleFileChange} className="max-w-xs" />
          <Button onClick={handleUpload} disabled={!selectedFile || uploadEvidenceMutation.isPending}>
            <Upload className="mr-2 h-4 w-4" />
            {uploadEvidenceMutation.isPending ? "上传中..." : "上传证据"}
          </Button>
        </div>

        {/* 证据列表 */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件名</TableHead>
                <TableHead>文件类型</TableHead>
                <TableHead>上传时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingEvidences ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">加载中...</TableCell>
                </TableRow>
              ) : evidencesData?.data && evidencesData.data.length > 0 ? (
                evidencesData.data.map((evidence: Evidence) => (
                  <TableRow key={evidence.id}>
                    <TableCell className="font-medium flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                      <a href={evidence.file_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {evidence.file_name}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{evidence.file_type}</Badge>
                    </TableCell>
                    <TableCell>{new Date(evidence.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteEvidence(evidence.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">暂无证据</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}