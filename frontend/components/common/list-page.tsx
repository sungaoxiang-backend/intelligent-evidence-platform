import React from 'react';
import { PageHeader } from './page-header';
import { TableToolbar } from './table-toolbar';
import { SpinnerFallback } from './spinner-fallback';
import { Pagination } from '../ui/pagination';
import { Button } from '../ui/button';
import { AlertTriangle } from 'lucide-react';

interface ListPageProps<T extends { id: number }> {
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  
  // Data and loading states
  data?: T[];
  loading: boolean;
  error?: Error | null;
  
  // Pagination
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  
  // Bulk selection
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  bulkActions?: React.ReactNode;
  
  // Table rendering
  renderTable: (data: T[]) => React.ReactNode;
  
  // Empty state
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
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
  selectedIds,
  onSelectionChange,
  bulkActions,
  renderTable,
  emptyMessage = "暂无数据",
  emptyAction
}: ListPageProps<T>) {
  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return <SpinnerFallback />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PageHeader title={title} subtitle={subtitle} actions={headerActions} />
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
            <p className="text-gray-500">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !data || data.length === 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title={title} subtitle={subtitle} actions={headerActions} />
      
      {selectedIds.length > 0 && (
        <TableToolbar selectedCount={selectedIds.length}>
          {bulkActions}
        </TableToolbar>
      )}

      {isEmpty ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{emptyMessage}</p>
            {emptyAction}
          </div>
        </div>
      ) : (
        <>
          {renderTable(data)}
          
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                显示 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, total)} 条，共 {total} 条
              </div>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={onPageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
} 