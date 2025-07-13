"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, FolderOpen, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    {
      title: "总用户数",
      value: "1,234",
      description: "较上月增长 +12%",
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "活跃案件",
      value: "89",
      description: "较上月增长 +5%",
      icon: FileText,
      color: "text-green-600",
    },
    {
      title: "证据文件",
      value: "2,456",
      description: "较上月增长 +18%",
      icon: FolderOpen,
      color: "text-purple-600",
    },
    {
      title: "处理效率",
      value: "95.2%",
      description: "较上月提升 +2.1%",
      icon: TrendingUp,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">仪表板</h1>
        <p className="text-muted-foreground">欢迎回到智能证据平台管理系统</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>案件趋势</CardTitle>
            <CardDescription>最近6个月的案件处理情况</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              图表组件将在这里显示
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>最近活动</CardTitle>
            <CardDescription>系统最新动态</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">新案件创建</p>
                  <p className="text-xs text-muted-foreground">2分钟前</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">证据上传完成</p>
                  <p className="text-xs text-muted-foreground">5分钟前</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">用户信息更新</p>
                  <p className="text-xs text-muted-foreground">10分钟前</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}