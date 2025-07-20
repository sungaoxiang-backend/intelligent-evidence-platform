import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, Shield, TrendingUp } from "lucide-react"

export function Dashboard() {
  const stats = [
    { title: "总用户数", value: "1,234", icon: Users, color: "text-blue-600" },
    { title: "活跃案件", value: "89", icon: FileText, color: "text-green-600" },
    { title: "待处理证据", value: "156", icon: Shield, color: "text-orange-600" },
    { title: "本月新增", value: "45", icon: TrendingUp, color: "text-purple-600" },
  ]

  const recentCases = [
    { id: "C001", title: "劳动纠纷案", status: "进行中", priority: "高", date: "2024-01-15" },
    { id: "C002", title: "合同违约案", status: "待审核", priority: "中", date: "2024-01-14" },
    { id: "C003", title: "知识产权案", status: "已结案", priority: "低", date: "2024-01-13" },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">数据仪表盘</h1>
        <div className="text-sm text-gray-500">最后更新: {new Date().toLocaleString("zh-CN")}</div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-gray-500 mt-1">较上月 +12%</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 案件状态分布 */}
        <Card>
          <CardHeader>
            <CardTitle>案件状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">已结案</span>
                </div>
                <span className="text-sm font-medium">45%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">进行中</span>
                </div>
                <span className="text-sm font-medium">35%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm">待审核</span>
                </div>
                <span className="text-sm font-medium">20%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 最近案件 */}
        <Card>
          <CardHeader>
            <CardTitle>最近案件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCases.map((case_) => (
                <div key={case_.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{case_.title}</div>
                    <div className="text-sm text-gray-500">案件编号: {case_.id}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-xs px-2 py-1 rounded-full ${
                        case_.status === "已结案"
                          ? "bg-green-100 text-green-800"
                          : case_.status === "进行中"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {case_.status}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{case_.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
