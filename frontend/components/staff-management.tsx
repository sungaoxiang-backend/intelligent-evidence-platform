"use client"

import type React from "react"

import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  Shield,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react"
import { staffApi } from "@/lib/staff-api"
import { authService } from "@/lib/auth"
import type { Staff, CreateStaffRequest } from "@/lib/config"
import useSWR, { mutate } from "swr"

// SWR数据获取函数
const fetcher = async ([key]: [string]) => {
  const result = await staffApi.getStaffs()
  return result
}

// 使用Suspense的数据展示组件
function StaffTableContent({ 
  searchTerm, 
  onDeleteStaff, 
  currentUser, 
  isSuperUser 
}: {
  searchTerm: string
  onDeleteStaff: (staff: Staff) => void
  currentUser: any
  isSuperUser: boolean
}) {
  const { data, error } = useSWR(['/api/staffs'], fetcher, {
    suspense: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  if (error) {
    throw error
  }

  const staffs = data?.data || []
  const filteredStaffs = staffs.filter((staff: Staff) => 
    staff.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>员工ID</TableHead>
          <TableHead>用户名</TableHead>
          <TableHead>角色</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead>更新时间</TableHead>
          {isSuperUser && <TableHead>操作</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredStaffs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={isSuperUser ? 7 : 6} className="text-center py-8 text-muted-foreground">
              {searchTerm ? "没有找到匹配的员工" : "暂无员工数据"}
            </TableCell>
          </TableRow>
        ) : (
          filteredStaffs.map((staff: Staff) => (
            <TableRow key={staff.id}>
              <TableCell className="font-medium">#{staff.id}</TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  {staff.is_superuser ? (
                    <Shield className="h-4 w-4 text-orange-600" />
                  ) : (
                    <User className="h-4 w-4 text-blue-600" />
                  )}
                  <span className="font-medium">{staff.username}</span>
                  {staff.id === currentUser?.id && (
                    <Badge variant="outline" className="text-xs">
                      当前用户
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {staff.is_superuser ? (
                  <Badge className="bg-orange-100 text-orange-800">超级管理员</Badge>
                ) : (
                  <Badge variant="outline">普通员工</Badge>
                )}
              </TableCell>
              <TableCell>
                {staff.is_active ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    活跃
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    禁用
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(staff.created_at)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(staff.updated_at)}</TableCell>
              {isSuperUser && (
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteStaff(staff)}
                      disabled={staff.id === currentUser?.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

// 员工计数组件
function StaffCount() {
  const { data } = useSWR(['/api/staffs'], fetcher, {
    suspense: true,
  })
  const staffs = data?.data || []
  return <span>{staffs.length}</span>
}

export function StaffManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // 创建员工表单
  const [createForm, setCreateForm] = useState<CreateStaffRequest>({
    username: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)

  // 当前用户信息
  const currentUser = authService.getUser()
  const isSuperUser = authService.isSuperUser()

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError("")
    setSuccess("")

    try {
      const result = await staffApi.createStaff(createForm)
      setSuccess(`员工 "${result.data.username}" 创建成功`)
      setCreateForm({ username: "", password: "" })
      setIsAddDialogOpen(false)
      
      // 重新验证数据
      mutate(['/api/staffs'])
    } catch (error) {
      setError("创建员工失败")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteStaff = async (staff: Staff) => {
    if (!confirm(`确定要删除员工 "${staff.username}" 吗？此操作无法撤销。`)) {
      return
    }

    try {
      await staffApi.deleteStaff(staff.id)
      setSuccess(`员工 "${staff.username}" 删除成功`)
      
      // 重新验证数据
      mutate(['/api/staffs'])
    } catch (error) {
      setError("删除员工失败")
    }
  }

  const clearMessages = () => {
    setError("")
    setSuccess("")
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">员工管理</h1>
          <p className="text-muted-foreground mt-1">管理系统员工账户和权限</p>
        </div>

        {isSuperUser && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" />
                添加员工
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加新员工</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateStaff} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="username">用户名 *</Label>
                  <Input
                    id="username"
                    placeholder="请输入用户名"
                    value={createForm.username}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
                    disabled={creating}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">密码 *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="请输入密码"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                      disabled={creating}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={creating}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false)
                      setCreateForm({ username: "", password: "" })
                      clearMessages()
                    }}
                    disabled={creating}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={creating || !createForm.username || !createForm.password}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      "添加员工"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* 成功/错误消息 */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 员工列表卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <span>员工列表</span>
              <Badge variant="secondary">
                <Suspense fallback={<Loader2 className="h-3 w-3 animate-spin" />}>
                  <StaffCount />
                </Suspense>
              </Badge>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="搜索员工用户名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              {(error || success) && (
                <Button variant="outline" size="sm" onClick={clearMessages}>
                  清除消息
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div></div>}>
            <StaffTableContent 
              searchTerm={searchTerm} 
              onDeleteStaff={handleDeleteStaff} 
              currentUser={currentUser} 
              isSuperUser={isSuperUser} 
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}