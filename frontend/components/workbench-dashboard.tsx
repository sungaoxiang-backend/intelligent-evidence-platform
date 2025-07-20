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
} from "lucide-react"

export function WorkbenchDashboard() {
  const router = useRouter()

  const todayTasks = [
    {
      id: 1,
      type: "urgent",
      title: "张三债务纠纷案 - AI标注完成，需审核",
      caseId: "C2024001",
      deadline: "今天 18:00",
      priority: "高",
      stage: "诉前",
    },
    {
      id: 2,
      type: "reminder",
      title: "李四合同违约案 - 开庭提醒",
      caseId: "C2024002",
      deadline: "明天 09:30",
      priority: "高",
      stage: "诉中",
    },
    {
      id: 3,
      type: "ai",
      title: "ABC公司案 - 证据材料AI分析中",
      caseId: "C2024003",
      deadline: "2小时后完成",
      priority: "中",
      stage: "诉前",
    },
  ]

  const quickStats = [
    { label: "今日新增案件", value: "5", change: "+2", icon: Plus, color: "text-blue-600" },
    { label: "AI处理中", value: "8", change: "+3", icon: Brain, color: "text-purple-600" },
    { label: "本月结案", value: "28", change: "+15", icon: CheckCircle, color: "text-green-600" },
    { label: "回款金额", value: "¥156万", change: "+23%", icon: DollarSign, color: "text-orange-600" },
  ]

  const recentCases = [
    {
      id: "C2024005",
      title: "某公司债务追讨案",
      client: "ABC贸易公司",
      amount: "¥50万",
      stage: "诉前",
      status: "证据材料AI智能标注",
      progress: 65,
      nextAction: "审核AI标注结果",
      aiProcessed: 8,
      totalEvidence: 12,
    },
    {
      id: "C2024004",
      title: "个人借贷纠纷案",
      client: "赵六",
      amount: "¥12万",
      stage: "诉前",
      status: "文书生成",
      progress: 85,
      nextAction: "生成起诉状",
      aiProcessed: 5,
      totalEvidence: 5,
    },
    {
      id: "C2024003",
      title: "合同违约赔偿案",
      client: "XYZ科技",
      amount: "¥80万",
      stage: "诉中",
      status: "案件已立案",
      progress: 70,
      nextAction: "准备庭审材料",
      aiProcessed: 15,
      totalEvidence: 15,
    },
  ]

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "诉前":
        return "bg-blue-100 text-blue-800"
      case "诉中":
        return "bg-orange-100 text-orange-800"
      case "诉后":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "urgent":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "reminder":
        return <Calendar className="h-4 w-4 text-blue-500" />
      case "ai":
        return <Brain className="h-4 w-4 text-purple-500" />
      default:
        return <FileText className="h-4 w-4 text-orange-500" />
    }
  }

  return (
    <div className="space-y-5">
      {/* 页面头部 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-3 lg:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">工作台</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            今天是{" "}
            {new Date().toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
            ，您有 {todayTasks.length} 项待办事项
          </p>
        </div>

        <div className="flex space-x-2">
          <Button
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg transition-all h-9 px-4"
            onClick={() => router.push("/cases")}
          >
            <Plus className="h-4 w-4 mr-2" />
            录入新案件
          </Button>
          <Button variant="outline" className="bg-transparent h-9 px-4" onClick={() => router.push("/evidence")}>
            <Upload className="h-4 w-4 mr-2" />
            批量上传证据
          </Button>
          <Button variant="outline" className="bg-transparent h-9 px-4">
            <Brain className="h-4 w-4 mr-2" />
            AI智能分析
          </Button>
        </div>
      </div>

      {/* 今日统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="card-shadow hover:card-shadow-hover transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className={`text-sm ${stat.change.startsWith("+") ? "text-green-600" : "text-red-600"}`}>
                      {stat.change} 较昨日
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-full bg-muted/50 ${stat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 今日待办 */}
        <Card className="lg:col-span-1 card-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">今日待办</CardTitle>
            <Badge variant="secondary">{todayTasks.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayTasks.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getTaskIcon(task.type)}
                    <Badge variant={task.priority === "高" ? "destructive" : "secondary"} className="text-xs">
                      {task.priority}
                    </Badge>
                    <Badge className={getStageColor(task.stage)} variant="outline">
                      {task.stage}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{task.deadline}</span>
                </div>
                <h4 className="font-medium text-sm mb-1">{task.title}</h4>
                <p className="text-xs text-muted-foreground">案件编号: {task.caseId}</p>
              </div>
            ))}

            <Button variant="ghost" className="w-full justify-center" onClick={() => router.push("/cases")}>
              查看全部待办
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* 最近案件 */}
        <Card className="lg:col-span-2 card-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">最近案件进展</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push("/cases")}>
              查看全部
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCases.map((case_) => (
                <div key={case_.id} className="p-4 border rounded-lg hover:shadow-sm transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-sm">{case_.title}</h4>
                        <Badge className={getStageColor(case_.stage)}>{case_.stage}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {case_.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>当事人: {case_.client}</span>
                        <span>金额: {case_.amount}</span>
                        <span>编号: {case_.id}</span>
                        <span>
                          AI处理: {case_.aiProcessed}/{case_.totalEvidence}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">案件进度</span>
                      <span className="font-medium">{case_.progress}%</span>
                    </div>
                    <Progress value={case_.progress} className="h-1.5" />
                    <p className="text-sm text-blue-600 flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>下一步: {case_.nextAction}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快速入口 */}
      <Card className="card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">快速操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Button
              variant="outline"
              className="h-16 flex-col space-y-1.5 bg-transparent"
              onClick={() => router.push("/cases")}
            >
              <Scale className="h-5 w-5" />
              <span className="text-sm">案件管理</span>
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col space-y-1.5 bg-transparent"
              onClick={() => router.push("/evidence")}
            >
              <Shield className="h-5 w-5" />
              <span className="text-sm">证据管理</span>
            </Button>
            <Button
              variant="outline"
              className="h-16 flex-col space-y-1.5 bg-transparent"
              onClick={() => router.push("/users")}
            >
              <Users className="h-5 w-5" />
              <span className="text-sm">当事人管理</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col space-y-1.5 bg-transparent">
              <Brain className="h-5 w-5" />
              <span className="text-sm">AI智能分析</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col space-y-1.5 bg-transparent">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm">数据报表</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

