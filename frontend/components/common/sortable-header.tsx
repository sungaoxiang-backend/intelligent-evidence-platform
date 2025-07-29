import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SortDirection = "asc" | "desc" | null;

interface SortableHeaderProps {
  children: React.ReactNode;
  field: string;
  currentSort: { field: string; direction: SortDirection };
  onSort: (field: string, direction: SortDirection) => void;
  className?: string;
}

export function SortableHeader({ 
  children, 
  field, 
  currentSort, 
  onSort, 
  className = "" 
}: SortableHeaderProps) {
  const isActive = currentSort.field === field;
  
  const handleClick = () => {
    let newDirection: SortDirection;
    
    if (!isActive) {
      // 如果字段未激活，设置为升序
      newDirection = "asc";
    } else if (currentSort.direction === "asc") {
      // 如果当前是升序，切换到降序
      newDirection = "desc";
    } else if (currentSort.direction === "desc") {
      // 如果当前是降序，切换回升序
      newDirection = "asc";
    } else {
      // 如果当前是null，设置为升序
      newDirection = "asc";
    }
    
    onSort(field, newDirection);
  };

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className={`h-auto p-0 font-medium hover:bg-transparent ${className}`}
    >
      <div className="flex items-center gap-1">
        {children}
        <div className="flex items-center gap-0.5">
          <ChevronUp 
            className={`h-3 w-3 ${
              isActive && currentSort.direction === "asc" 
                ? "text-blue-600" 
                : "text-gray-400"
            }`} 
          />
          <ChevronDown 
            className={`h-3 w-3 ${
              isActive && currentSort.direction === "desc" 
                ? "text-blue-600" 
                : "text-gray-400"
            }`} 
          />
        </div>
      </div>
    </Button>
  );
}

// 时间格式化函数
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).replace(/\//g, "-");
  } catch {
    return "-";
  }
} 