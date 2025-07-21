"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { User, Shield, Edit, Save, X, Loader2, CheckCircle, AlertTriangle, Eye, EyeOff, Calendar } from "lucide-react"
import { authService } from "@/lib/auth"
import type { Staff } from "@/lib/config"
import { useEffect } from "react"

interface UserProfileProps {
  user: Staff
  onUserUpdate: (user: Staff) => void
}

export function UserProfile({ user, onUserUpdate }: UserProfileProps) {
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }

    if (newPassword.length < 6) {
      setError("密码长度至少6位")
      return
    }

    setUpdating(true)

    try {
      const result = await authService.updatePassword(newPassword)

      if (result.success && result.user) {
        setSuccess("密码更新成功")
        onUserUpdate(result.user)
        setNewPassword("")
        setConfirmPassword("")
        setIsPasswordDialogOpen(false)
      } else {
        setError(result.error || "更新密码失败")
      }
    } catch (error) {
      setError("网络连接失败")
    } finally {
      setUpdating(false)
    }
  }

  const resetForm = () => {
    setNewPassword("")
    setConfirmPassword("")
    setError("")
    setSuccess("")
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  useEffect(() => {
    const fetchUser = async () => {
      if (typeof window !== 'undefined') {
        const userInfo = await authService.getCurrentUser()
        if (userInfo.success && userInfo.user) {
          onUserUpdate(userInfo.user)
        }
      }
    }
    fetchUser()
  }, [onUserUpdate])

  return (
    <div className="space-y-6">
      {/* 成功消息 */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {/* 基本信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>个人信息</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 用户基本信息 */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">用户ID</Label>
                <p className="text-lg font-semibold">#{user.id}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">用户名</Label>
                <p className="text-lg font-semibold">{user.username}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">角色权限</Label>
                <div className="mt-1">
                  {user.is_superuser ? (
                    <Badge className="bg-orange-100 text-orange-800">
                      <Shield className="h-3 w-3 mr-1" />
                      超级管理员
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <User className="h-3 w-3 mr-1" />
                      普通员工
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">账户状态</Label>
                <div className="mt-1">
                  <Badge className={user.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {user.is_active ? "活跃" : "禁用"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 时间信息 */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">创建时间</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatDate(user.created_at)}</span>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">最后更新</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatDate(user.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 安全设置卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>安全设置</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">登录密码</h4>
              <p className="text-sm text-muted-foreground">定期更新密码以保障账户安全</p>
            </div>

            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Edit className="h-4 w-4 mr-2" />
                  修改密码
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>修改登录密码</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <Label htmlFor="newPassword">新密码 *</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="请输入新密码（至少6位）"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={updating}
                        required
                        minLength={6}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={updating}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">确认新密码 *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="请再次输入新密码"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={updating}
                        required
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={updating}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsPasswordDialogOpen(false)
                        resetForm()
                      }}
                      disabled={updating}
                    >
                      <X className="h-4 w-4 mr-2" />
                      取消
                    </Button>
                    <Button type="submit" disabled={updating || !newPassword || !confirmPassword}>
                      {updating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          更新中...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          保存
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
