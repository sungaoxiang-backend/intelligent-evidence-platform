import React from 'react';
import { PageHeader } from './page-header';
import { TableToolbar } from './table-toolbar';
import { SpinnerFallback } from './spinner-fallback';
import { Pagination } from '../ui/pagination';
import { Button } from '../ui/button';
import { AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface ListPageProps<T extends { id: number }> {
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  data?: T[];
  loading: boolean;
  error?: Error | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  renderTable: (data: T[]) => React.ReactNode;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  additionalContent?: React.ReactNode; // 新增的 prop，用于在标题和表格之间插入内容
}

export function ListPage<T extends { id: number }>({
  title,
  subtitle,
  headerActions,
  data,
  loading,
  error,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  renderTable,
  emptyMessage = "暂无数据",
  emptyAction,
  additionalContent, // 解构新的 prop
}: ListPageProps<T>) {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight whitespace-nowrap">{title}</h2>
          {subtitle && (
            <p className="text-muted-foreground mt-2 whitespace-nowrap">{subtitle}</p>
          )}
        </div>
        {headerActions}
      </div>

      {/* 筛选器应该始终显示，不受loading状态影响 */}
      {additionalContent}

      {loading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="flex justify-center items-center min-h-[200px] text-red-500">
          {error.message || "加载失败"}
        </div>
      ) : !data?.length ? (
        <div className="flex flex-col justify-center items-center min-h-[200px] gap-4">
          <p className="text-muted-foreground">{emptyMessage}</p>
          {emptyAction}
        </div>
      ) : (
        <>
          {renderTable(data)}
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              共 {total} 条记录
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">每页显示</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => onPageSizeChange(parseInt(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">条</span>
              <div className="ml-4">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onChange={onPageChange}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 