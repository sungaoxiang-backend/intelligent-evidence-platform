"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  FileText,
  Users,
  Shield,
  ArrowRight,
  Calendar,
  DollarSign,
  Scale,
  Brain,
  Upload,
  BarChart2,
  PieChart,
} from "lucide-react"
import useSWR from "swr"
import { caseApi, userApi } from "@/lib/api"
import { useEffect, useState } from "react"

export function WorkbenchDashboard() {
  const router = useRouter()

  // 统计数据
  const { data: caseData } = useSWR(["dashboard-cases"], async () => {
    const res = await caseApi.getCases({ page: 1, pageSize: 10 })
    return res
  })
  const { data: userData } = useSWR(["dashboard-users"], async () => {
    const res = await userApi.getUsers({ page: 1, pageSize: 10 })
    return res
  })

  // 最近数据
  const recentCases = caseData?.data || []
  const recentEvidences: any[] = []
  const recentUsers = userData?.data || []

  return (
    <div className="space-y-8 pb-12">
      {/* 平台使用说明 */}
      <Card className="card-shadow">
        <CardHeader>
          <CardTitle className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Shield className="h-7 w-7 text-blue-600" /> 汇法律 智能证物平台
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-blue max-w-none text-base">
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded px-4 py-2">
              <Scale className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-blue-700 dark:text-blue-300">智能证物管理 · AI辅助分析 · 一站式法律数据平台</span>
            </div>
            <p>
              <b>汇法律 智能证物平台</b> 为法律服务、案件管理、证据管理等场景提供智能化、结构化的证物管理与AI辅助分析能力。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="flex items-center gap-1 text-lg font-semibold mb-2"><FileText className="h-5 w-5 text-blue-500" /> 主要功能</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>案件管理：</b> 创建、编辑、分配、进度跟踪</li>
                  <li><b>证据管理：</b> 批量上传、AI分类、特征提取</li>
                  <li><b>用户/员工管理：</b> 权限分级、信息维护</li>
                  <li><b>AI智能分析：</b> 自动分类、关键信息抽取</li>
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-1 text-lg font-semibold mb-2"><Users className="h-5 w-5 text-green-500" /> 快速上手</h3>
                <ul className="list-decimal pl-5 space-y-1">
                  <li>左侧导航进入各业务模块</li>
                  <li>案件管理中可新建案件</li>
                  <li>证据管理中批量上传证据，体验AI自动分类</li>
                  <li>点击统计卡片可跳转详情</li>
                </ul>
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded px-4 py-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="text-yellow-800 dark:text-yellow-200 text-sm">AI分析结果仅供参考，最终以人工审核为准。如遇系统异常请联系管理员。</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片和最新数据列表可保留，放在说明下方 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="card-shadow hover:card-shadow-hover transition-shadow cursor-pointer group" onClick={() => router.push("/cases") }>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1 group-hover:text-foreground transition-colors">案件总数</p>
              <p className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">{caseData?.pagination?.total ?? "-"}</p>
            </div>
            <div className="p-3 rounded-full bg-muted/50 text-blue-600 group-hover:bg-primary/20 transition-colors">
              <Scale className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-shadow hover:card-shadow-hover transition-shadow cursor-pointer group" onClick={() => router.push("/users") }>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1 group-hover:text-foreground transition-colors">用户总数</p>
              <p className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
                {(userData as any)?.pagination?.total ?? "-"}
              </p>
            </div>
            <div className="p-3 rounded-full bg-muted/50 text-green-600 group-hover:bg-primary/20 transition-colors">
              <Users className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {/* 最近案件 */}
        <Card className="card-shadow h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">最新案件</CardTitle>
            <button className="text-sm text-blue-600 hover:underline" onClick={() => router.push("/cases")}>全部</button>
          </CardHeader>
          <CardContent className="flex-1">
            {recentCases.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">暂无案件数据</div>
            ) : (
              <div className="space-y-3">
                {recentCases.map((case_) => (
                  <div key={case_.id} className="p-3 border rounded-lg hover:shadow-sm transition-shadow cursor-pointer" onClick={() => router.push(`/cases`)}>
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="font-medium text-sm">{case_.title}</span>
                      <span className="text-xs text-muted-foreground">#{case_.id}</span>
                      <span className="text-xs text-muted-foreground">{case_.created_at ? new Date(case_.created_at).toLocaleString() : "-"}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>债权人: {case_.creditor_name}</span>
                      <span>债务人: {case_.debtor_name}</span>
                      <span>类型: {case_.case_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近用户 */}
        <Card className="card-shadow h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">最新用户</CardTitle>
            <button className="text-sm text-blue-600 hover:underline" onClick={() => router.push("/users")}>全部</button>
          </CardHeader>
          <CardContent className="flex-1">
            {recentUsers.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">暂无用户数据</div>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div key={user.id} className="p-3 border rounded-lg hover:shadow-sm transition-shadow cursor-pointer" onClick={() => router.push(`/users`)}>
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="font-medium text-sm">{user.name}</span>
                      <span className="text-xs text-muted-foreground">#{user.id}</span>
                      <span className="text-xs text-muted-foreground">{user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>手机号: {user.phone || '-'}</span>
                      <span>类型: {user.type || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

