"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Case, CaseType, PartyType } from "@/types";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const CASE_TYPE_LABELS = {
  [CaseType.DEBT]: "借款纠纷",
  [CaseType.CONTRACT]: "合同纠纷",
};

const PARTY_TYPE_LABELS = {
  [PartyType.PERSON]: "个人",
  [PartyType.COMPANY]: "公司",
  [PartyType.INDIVIDUAL]: "个体工商户",
};

export default function CasesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

  const router = useRouter();
  const queryClient = useQueryClient();

  // 获取案件列表
  const { data: casesData, isLoading } = useQuery({
    queryKey: ["cases", currentPage, pageSize],
    queryFn: () =>
      apiClient.getCases({
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      }),
  });

  // 删除案件
  const deleteCaseMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteCase(id),
    onSuccess: () => {
      toast.success("案件删除成功");
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: () => {
      toast.error("案件删除失败");
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这个案件吗？")) {
      deleteCaseMutation.mutate(id);
    }
  };

  const handleView = (id: number) => {
    router.push(`/cases/${id}`);
  };

  const handleCreate = () => {
    router.push("/cases/new");
  };

  const cases = casesData?.data || [];
  const pagination = casesData?.pagination;

  // 过滤案件
  const filteredCases = cases.filter((case_: Case) =>
    case_.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    case_.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    case_.creaditor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    case_.debtor_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">案件管理</h1>
          <p className="text-muted-foreground">管理和查看所有案件信息</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新建案件
        </Button>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索案件标题、编号、当事人..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* 案件列表 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案件编号</TableHead>
              <TableHead>案件标题</TableHead>
              <TableHead>案件类型</TableHead>
              <TableHead>债权人</TableHead>
              <TableHead>债务人</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  加载中...
                </TableCell>
              </TableRow>
            ) : filteredCases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  暂无案件数据
                </TableCell>
              </TableRow>
            ) : (
              filteredCases.map((case_) => (
                <TableRow key={case_.id} onClick={() => handleView(case_.id)} className="cursor-pointer">
                  <TableCell className="font-medium">
                    {case_.case_number}
                  </TableCell>
                  <TableCell>{case_.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CASE_TYPE_LABELS[case_.case_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{case_.creaditor_name}</div>
                      {case_.creditor_type && (
                        <div className="text-sm text-muted-foreground">
                          {PARTY_TYPE_LABELS[case_.creditor_type]}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{case_.debtor_name}</div>
                      {case_.debtor_type && (
                        <div className="text-sm text-muted-foreground">
                          {PARTY_TYPE_LABELS[case_.debtor_type]}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(case_.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {pagination && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
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
                onClick={() => currentPage < pagination.pages && setCurrentPage(currentPage + 1)}
                className={currentPage >= pagination.pages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}