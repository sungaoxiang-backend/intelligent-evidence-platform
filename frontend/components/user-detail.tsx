"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Edit, Save, X, Phone, Mail, DollarSign, FileText, Loader2 } from "lucide-react"
import { userApi } from "@/lib/api"
import type { User as UserType } from "@/lib/types"

interface UserDetailProps {
  userId: string
  onBack: () => void
}

export function UserDetail({ userId, onBack }: UserDetailProps) {
  const [user, setUser] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<UserType>>({
    wechat_nickname: "",
    wechat_number: "",
    wechat_avatar: "",
  })

  useEffect(() => {
    loadUserDetail()
  }, [userId])

  const loadUserDetail = async () => {
    setLoading(true)
    try {
      const response = await userApi.getUserById(userId)
      setUser(response.data)
      setEditForm(response.data)
    } catch (error) {
      console.error("加载用户详情失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const response = await userApi.updateUser(user.id.toString(), editForm)
      setUser(response.data)
      setEditing(false)
    } catch (error) {
      console.error("保存用户失败:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm(user || {})
    setEditing(false)
  }

  const getStatusColor = (status: string | undefined) => {
    if (!status) return "bg-blue-100 text-blue-800"
    
    switch (status) {
      case "活跃":
        return "bg-green-100 text-green-800"
      case "待联系":
        return "bg-orange-100 text-orange-800"
      case "已结案":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-blue-100 text-blue-800"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">用户不存在</p>
        <Button onClick={onBack} className="mt-4">
          返回列表
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack} className="h-8 bg-transparent">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
            <div className="flex items-center space-x-3 mt-1">
              <Badge variant="outline">{user.type}</Badge>
              <Badge className={getStatusColor(user.status)}>{user.status || "未知"}</Badge>
              <span className="text-sm text-muted-foreground">用户编号: {user.id}</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                保存
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              编辑
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="cases">关联案件</TabsTrigger>
          <TabsTrigger value="contact">联系记录</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 基本信息卡片 */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="text-lg">基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">姓名/公司名称</Label>
                    {editing ? (
                      <Input
                        id="name"
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">{user.name}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="type">类型</Label>
                    {editing ? (
                      <Select
                        value={editForm.type || ""}
                        onValueChange={(value) => setEditForm({ ...editForm, type: value as "个人" | "企业" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="个人">个人</SelectItem>
                          <SelectItem value="企业">企业</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium mt-1">{user.type}</p>
                    )}
                  </div>
                </div>



                {/* 微信信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="wechat_nickname">微信昵称</Label>
                    {editing ? (
                      <Input
                        id="wechat_nickname"
                        value={editForm.wechat_nickname || ""}
                        onChange={(e) => setEditForm({ ...editForm, wechat_nickname: e.target.value })}
                        placeholder="请输入微信昵称"
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">{user.wechat_nickname || "未设置"}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="wechat_number">微信号</Label>
                    {editing ? (
                      <Input
                        id="wechat_number"
                        value={editForm.wechat_number || ""}
                        onChange={(e) => setEditForm({ ...editForm, wechat_number: e.target.value })}
                        placeholder="请输入微信号"
                      />
                    ) : (
                      <p className="text-sm font-medium mt-1">{user.wechat_number || "未设置"}</p>
                    )}
                  </div>
                </div>



                <div>
                  <Label htmlFor="address">联系地址</Label>
                  {editing ? (
                    <Input
                      id="address"
                      value={editForm.address || ""}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm font-medium mt-1">{user.address}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="status">状态</Label>
                  {editing ? (
                    <Select
                      value={editForm.status || ""}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, status: value as "活跃" | "待联系" | "已结案" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="活跃">活跃</SelectItem>
                        <SelectItem value="待联系">待联系</SelectItem>
                        <SelectItem value="已结案">已结案</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={getStatusColor(user.status)} variant="outline">
                      {user.status || "未知"}
                    </Badge>
                  )}
                </div>

                <div>
                  <Label htmlFor="notes">备注信息</Label>
                  {editing ? (
                    <Textarea
                      id="notes"
                      value={editForm.notes || ""}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm mt-1 bg-muted/30 p-3 rounded-lg">{user.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 统计信息卡片 */}
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="text-lg">统计信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">关联案件</p>
                      <p className="text-lg font-bold">{user.caseCount}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">涉及金额</p>
                      <p className="text-lg font-bold">{user.totalAmount}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">注册时间</span>
                    <span className="text-sm font-medium">{user.registerDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">最后联系</span>
                    <span className="text-sm font-medium">{user.lastContact}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button size="sm" className="flex-1">
                    <Phone className="h-4 w-4 mr-2" />
                    拨打电话
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                    <Mail className="h-4 w-4 mr-2" />
                    发送邮件
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cases">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-lg">关联案件</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">暂无关联案件</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="text-lg">联系记录</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">暂无联系记录</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
