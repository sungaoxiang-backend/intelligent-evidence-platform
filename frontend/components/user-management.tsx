"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Eye } from "lucide-react";
import { userApi } from "@/lib/user-api";
import { ListPage } from "@/components/common/list-page";
import { usePaginatedSWR } from "@/hooks/use-paginated-swr";
import { SortableHeader, formatDateTime, type SortDirection } from "@/components/common/sortable-header";
import type { User } from "@/lib/types";

export default function UserManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sort, setSort] = useState<{ field: string; direction: SortDirection }>({
    field: "created_at",
    direction: "desc"
  });

  // 用户ID筛选状态
  const [userIdFilter, setUserIdFilter] = useState("");

  // Use paginated SWR hook with sorting and filtering
  const {
    data: users,
    loading,
    error,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    mutate
  } = usePaginatedSWR<User>(
    "/users",
    (params) => {
      const apiParams: any = {
        ...params,
        sort_by: sort.field,
        sort_order: sort.direction || "desc", // 提供默认值，避免null
        user_id: userIdFilter ? parseInt(userIdFilter) : undefined,
      };
      console.log("🔍 User Management API Params:", apiParams);
      return userApi.getUsers(apiParams);
    },
    [sort.field, sort.direction, userIdFilter], // Add userIdFilter as dependency
    20, // initialPageSize
    {
      // 优化刷新策略：平衡性能和实时性
      revalidateOnFocus: true,       // 页面获得焦点时重新验证
      revalidateOnReconnect: true,   // 网络重连时重新验证
      revalidateIfStale: true,       // 数据过期时自动重新验证
      dedupingInterval: 10000,       // 10秒内重复请求会被去重
    }
  );


  const handleSort = (field: string, direction: SortDirection) => {
    setSort({ field, direction });
  };

  // 处理用户ID筛选
  const handleUserIdFilterChange = (value: string) => {
    console.log("🔍 User ID Filter Change:", value);
    console.log("🔍 Parsed user_id:", value ? parseInt(value) : undefined);
    setUserIdFilter(value);
    setPage(1); // 重置到第一页
  };

  // 初始化筛选器状态，从URL参数恢复筛选条件
  useEffect(() => {
    const userId = searchParams.get('user_id');
    if (userId) {
      setUserIdFilter(userId);
    }
  }, [searchParams]);

  // 移除客户端排序逻辑，使用服务端排序
  const sortedUsers = users || [];
  
  // 调试：显示当前筛选状态
  console.log("🔍 Current filter state:", {
    userIdFilter,
    usersCount: users?.length || 0,
    total
  });

  const handleViewUserCases = (userId: number) => {
    router.push(`/cases?user_id=${userId}`);
  };

  const renderTable = (users: User[]) => {
    return (
    <>
      {/* Users Table */}
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20 min-w-20">用户ID</TableHead>
              <TableHead>头像</TableHead>
              <TableHead>昵称</TableHead>
              <TableHead>
                <SortableHeader
                  field="created_at"
                  currentSort={sort}
                  onSort={handleSort}
                >
                  创建时间
                </SortableHeader>
              </TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                {/* ID */}
                <TableCell className="font-mono text-sm text-gray-600 whitespace-nowrap">
                  #{user.id}
                </TableCell>
                {/* 头像预览 */}
                <TableCell>
                  <div className="flex items-center">
                    {user.wechat_avatar ? (
                      <img 
                        src={user.wechat_avatar} 
                        alt="头像" 
                        className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => {
                          // 头像加载失败时显示默认头像
                          const target = e.currentTarget as HTMLImageElement;
                          target.src = "/api/placeholder/40/40";
                          target.className = "w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500";
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                        {user.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                </TableCell>
                
                {/* 姓名 */}
                <TableCell className="font-medium">{user.name}</TableCell>
                
                {/* 创建时间 */}
                <TableCell className="text-sm text-gray-600">
                  {formatDateTime(user.created_at)}
                </TableCell>
                
                {/* 操作按钮 */}
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewUserCases(user.id)}
                    className="flex items-center text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    查看案件
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
  };

  return (
    <>
      <ListPage
        title="用户管理"
        subtitle="管理系统中的所有用户信息"
        additionalContent={
          <div className="w-full mb-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">通过用户ID筛选：</label>
                <Input
                  type="text"
                  placeholder="输入用户ID"
                  value={userIdFilter}
                  onChange={(e) => handleUserIdFilterChange(e.target.value)}
                  className="w-48"
                />
              </div>
              {userIdFilter && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUserIdFilterChange("")}
                  className="text-gray-600"
                >
                  清除
                </Button>
              )}
            </div>
          </div>
        }
        data={users}
        loading={loading}
        error={error}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        renderTable={renderTable}
        emptyMessage="暂无用户数据"
      />
    </>
  );
}