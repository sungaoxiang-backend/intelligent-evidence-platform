"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import type { PartyType } from "@/lib/types";

interface CaseFiltersProps {
  users: any[];
  selectedUserId: string | null;
  isExpanded: boolean;
  onFilterChange: (filters: {
    userId?: string;
    partyName?: string;
    partyType?: string;
    partyRole?: string;
    minLoanAmount?: number;
    maxLoanAmount?: number;
  }) => void;
  onUserFilterChange: (userId: string | null) => void;
  onToggleExpand: () => void;
}

export function CaseFilters({ 
  users,
  selectedUserId,
  isExpanded,
  onFilterChange,
  onUserFilterChange,
  onToggleExpand
}: CaseFiltersProps) {
  const [partyName, setPartyName] = useState("");
  const [partyType, setPartyType] = useState<string>("");
  const [partyRole, setPartyRole] = useState<string>("");
  const [minLoanAmount, setMinLoanAmount] = useState<string>("");
  const [maxLoanAmount, setMaxLoanAmount] = useState<string>("");
  
  // 验证金额范围的有效性
  const validateLoanAmounts = (min: string, max: string): boolean => {
    const minValue = min ? parseFloat(min) : null;
    const maxValue = max ? parseFloat(max) : null;
    
    // 如果两个值都存在，检查最小值不能大于最大值
    if (minValue !== null && maxValue !== null && minValue > maxValue) {
      return false;
    }
    
    return true;
  };
  
  // 处理用户筛选变化
  const handleUserChange = (userId: string) => {
    onUserFilterChange(userId === "all" ? null : userId);
    onFilterChange({
      userId: userId === "all" ? undefined : userId,
      partyName: partyName || undefined,
      partyType: partyType || undefined,
      partyRole: partyRole || undefined,
      minLoanAmount: minLoanAmount && validateLoanAmounts(minLoanAmount, maxLoanAmount) ? parseFloat(minLoanAmount) : undefined,
      maxLoanAmount: maxLoanAmount && validateLoanAmounts(minLoanAmount, maxLoanAmount) ? parseFloat(maxLoanAmount) : undefined,
    });
  };
  
  // 处理当事人姓名变化
  const handlePartyNameChange = (value: string) => {
    setPartyName(value);
    onFilterChange({
      userId: selectedUserId || undefined,
      partyName: value || undefined,
      partyType: partyType || undefined,
      partyRole: partyRole || undefined,
      minLoanAmount: minLoanAmount && validateLoanAmounts(minLoanAmount, maxLoanAmount) ? parseFloat(minLoanAmount) : undefined,
      maxLoanAmount: maxLoanAmount && validateLoanAmounts(minLoanAmount, maxLoanAmount) ? parseFloat(maxLoanAmount) : undefined,
    });
  };
  
  // 处理当事人类型变化
  const handlePartyTypeChange = (value: string) => {
    setPartyType(value);
    onFilterChange({
      userId: selectedUserId || undefined,
      partyName: partyName || undefined,
      partyType: value || undefined,
      partyRole: partyRole || undefined,
      minLoanAmount: minLoanAmount && validateLoanAmounts(minLoanAmount, maxLoanAmount) ? parseFloat(minLoanAmount) : undefined,
      maxLoanAmount: maxLoanAmount && validateLoanAmounts(minLoanAmount, maxLoanAmount) ? parseFloat(maxLoanAmount) : undefined,
    });
  };
  
  // 处理当事人角色变化
  const handlePartyRoleChange = (value: string) => {
    setPartyRole(value);
    onFilterChange({
      userId: selectedUserId || undefined,
      partyName: partyName || undefined,
      partyType: partyType || undefined,
      partyRole: value || undefined,
      minLoanAmount: minLoanAmount && validateLoanAmounts(minLoanAmount, maxLoanAmount) ? parseFloat(minLoanAmount) : undefined,
      maxLoanAmount: maxLoanAmount && validateLoanAmounts(minLoanAmount, maxLoanAmount) ? parseFloat(maxLoanAmount) : undefined,
    });
  };
  
  // 处理最小欠款金额变化
  const handleMinLoanAmountChange = (value: string) => {
    // 验证输入值
    if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
      return; // 无效输入，不更新
    }
    
    setMinLoanAmount(value);
    
    // 只有当金额范围有效时才触发筛选
    if (validateLoanAmounts(value, maxLoanAmount)) {
      onFilterChange({
        userId: selectedUserId || undefined,
        partyName: partyName || undefined,
        partyType: partyType || undefined,
        partyRole: partyRole || undefined,
        minLoanAmount: value ? parseFloat(value) : undefined,
        maxLoanAmount: maxLoanAmount ? parseFloat(maxLoanAmount) : undefined,
      });
    }
  };
  
  // 处理最大欠款金额变化
  const handleMaxLoanAmountChange = (value: string) => {
    // 验证输入值
    if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
      return; // 无效输入，不更新
    }
    
    setMaxLoanAmount(value);
    
    // 只有当金额范围有效时才触发筛选
    if (validateLoanAmounts(minLoanAmount, value)) {
      onFilterChange({
        userId: selectedUserId || undefined,
        partyName: partyName || undefined,
        partyType: partyType || undefined,
        partyRole: partyRole || undefined,
        minLoanAmount: minLoanAmount ? parseFloat(minLoanAmount) : undefined,
        maxLoanAmount: value ? parseFloat(value) : undefined,
      });
    }
  };
  
  const handleReset = () => {
    setPartyName("");
    setPartyType("");
    setPartyRole("");
    setMinLoanAmount("");
    setMaxLoanAmount("");
    onUserFilterChange(null);
    onFilterChange({});
  };
  
  const hasFilters = selectedUserId || partyName || partyType || partyRole || minLoanAmount || maxLoanAmount;
  
  // 检查金额范围是否有效，用于显示错误提示
  const isLoanAmountValid = validateLoanAmounts(minLoanAmount, maxLoanAmount);
  
  return (
    <div className="p-2 bg-gray-50 rounded-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <h3 className="text-xs font-medium text-gray-700">筛选条件</h3>
          {hasFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="text-blue-600 hover:text-blue-800 px-1 h-6"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className={`grid gap-1 ${partyName ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
          {/* 用户筛选 */}
          <div className="space-y-1">
            <Label htmlFor="user-filter" className="text-xs">关联用户</Label>
            <Select value={selectedUserId || "all"} onValueChange={handleUserChange}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="用户" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {users.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} <span className="text-gray-400">(#{user.id})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* 当事人姓名筛选 */}
          <div className="space-y-1">
            <Label htmlFor="party-name" className="text-xs">当事人姓名</Label>
            <Input
              id="party-name"
              placeholder="姓名"
              value={partyName}
              onChange={(e) => handlePartyNameChange(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          
          {/* 当事人类型筛选 - 仅在当事人姓名有输入时显示 */}
          {partyName && (
            <div className="space-y-1">
              <Label htmlFor="party-type" className="text-xs">当事人类型</Label>
              <Select value={partyType} onValueChange={handlePartyTypeChange}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">个人</SelectItem>
                  <SelectItem value="company">公司</SelectItem>
                  <SelectItem value="individual">个体</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* 当事人角色筛选 - 仅在当事人姓名有输入时显示 */}
          {partyName && (
            <div className="space-y-1">
              <Label htmlFor="party-role" className="text-xs">当事人角色</Label>
              <Select value={partyRole} onValueChange={handlePartyRoleChange}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="creditor">债权人</SelectItem>
                  <SelectItem value="debtor">债务人</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* 欠款金额最小值 */}
          <div className="space-y-1">
            <Label htmlFor="min-loan-amount" className="text-xs">最小金额</Label>
            <Input
              id="min-loan-amount"
              type="number"
              placeholder="最小"
              value={minLoanAmount}
              onChange={(e) => handleMinLoanAmountChange(e.target.value)}
              min="0"
              step="0.01"
              className="h-7 text-xs"
            />
            {!isLoanAmountValid && (
              <div className="text-red-500 text-xs">最小金额不能大于最大金额</div>
            )}
          </div>
          
          {/* 欠款金额最大值 */}
          <div className="space-y-1">
            <Label htmlFor="max-loan-amount" className="text-xs">最大金额</Label>
            <Input
              id="max-loan-amount"
              type="number"
              placeholder="最大"
              value={maxLoanAmount}
              onChange={(e) => handleMaxLoanAmountChange(e.target.value)}
              min="0"
              step="0.01"
              className="h-7 text-xs"
            />
            {!isLoanAmountValid && (
              <div className="text-red-500 text-xs">最大金额不能小于最小金额</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}