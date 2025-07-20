"use client"

import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Plus, Search } from "lucide-react"
import { userApi } from "@/lib/user-api"
import type { User } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast"
import useSWR, { mutate } from "swr"

// 添加表单初始值
const initialForm: { name: string; id_card: string; phone: string } = { name: "", id_card: "", phone: "" }

// SWR数据获取函数
const fetcher = async ([key, search, activeTab, page, pageSize]: [string, string, string, number, number]) => {
  const params: any = { page, pageSize, search }
  if (activeTab === "individual") params.type = "个人"
  if (activeTab === "corporate") params.type = "企业"
  if (activeTab === "active") params.status = "活跃"
  
  const res = await userApi.getUsers(params)
  return res
}

// 使用Suspense的数据展示组件
function UserTableContent({ 
  searchTerm, 
  activeTab, 
  page, 
  pageSize, 
  onSelectIds, 
  onViewUser, 
  onOpenEdit, 
  onSetDeleteUserId,
  selectedIds
}: {
  searchTerm: string
  activeTab: string
  page: number
  pageSize: number
  onSelectIds: (ids: string[]) => void
  onViewUser: (user: User) => void
  onOpenEdit: (user: User) => void
  onSetDeleteUserId: (id: string) => void
  selectedIds: string[]
}) {
  const { data, error } = useSWR(
    ['/api/users', searchTerm, activeTab, page, pageSize],
    fetcher,
    {
      suspense: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  if (error) {
    throw error
  }

  const users = data?.data || []
  const total = data?.pagination?.total || 0

  const toggleSelect = (id: string) => {
    onSelectIds(selectedIds.includes(id) 
      ? selectedIds.filter(i => i !== id) 
      : [...selectedIds, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === users.length) {
      onSelectIds([])
    } else {
      onSelectIds(users.map(u => u.id))
    }
  }

  return (
    <>
      {selectedIds.length > 0 && (
        <Button variant="destructive" size="sm" className="mb-2" onClick={() => {}} >
          批量删除（{selectedIds.length}）
        </Button>
      )}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-sm align-middle">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3">
                <Checkbox checked={selectedIds.length === users.length && users.length > 0} onCheckedChange={toggleSelectAll} />
              </th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">姓名</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">身份证号</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">联系电话</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">创建时间</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">暂无数据</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-center">
                    <Checkbox checked={selectedIds.includes(user.id)} onCheckedChange={() => toggleSelect(user.id)} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.id_card || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.phone || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.created_at ? new Date(user.created_at).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => onViewUser(user)}>查看</Button>
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => onOpenEdit(user)}>编辑</Button>
                    <Button variant="destructive" size="sm" onClick={() => onSetDeleteUserId(user.id)}>删除</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [page, setPage] = useState(1)
  const pageSize = 20
  const { toast } = useToast()
  const [addForm, setAddForm] = useState(initialForm)
  const [addLoading, setAddLoading] = useState(false)

  // 详情/编辑弹窗状态
  const [viewUser, setViewUser] = useState<User | null>(null)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; id_card: string; phone: string }>({ name: "", id_card: "", phone: "" })
  const [editLoading, setEditLoading] = useState(false)

  // 删除相关状态
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

  // 添加表单校验
  function validate(form: typeof initialForm) {
    if (!form.name.trim()) return "姓名为必填项"
    if (form.phone && !/^1[3-9]\d{9}$/.test(form.phone.trim())) return "手机号码格式不正确"
    if (form.id_card && !/^\d{15}$|^\d{17}[\dXx]$/.test(form.id_card.trim())) return "身份证号码格式不正确"
    return null
  }

  async function handleAddUser() {
    const err = validate(addForm)
    if (err) {
      toast({ title: err, variant: "destructive" })
      return
    }
    setAddLoading(true)
    try {
      await userApi.createUser({
        name: addForm.name.trim(),
        id_card: addForm.id_card.trim() || undefined,
        phone: addForm.phone.trim() || undefined,
      })
      toast({ title: "添加成功" })
      setIsAddDialogOpen(false)
      setAddForm(initialForm)
      
      // 重新验证数据
      mutate(['/api/users', searchTerm, activeTab, page, pageSize])
    } catch (e: any) {
      toast({ title: "添加失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setAddLoading(false)
    }
  }

  // 编辑表单校验
  function validateEdit(form: typeof editForm) {
    if (!form.name.trim()) return "姓名为必填项"
    if (form.phone && !/^1[3-9]\d{9}$/.test(form.phone.trim())) return "手机号码格式不正确"
    if (form.id_card && !/^\d{15}$|^\d{17}[\dXx]$/.test(form.id_card.trim())) return "身份证号码格式不正确"
    return null
  }

  // 打开编辑弹窗并回显
  function openEdit(user: User) {
    setEditUser(user)
    setEditForm({
      name: user.name || "",
      id_card: user.id_card || "",
      phone: user.phone || ""
    })
  }

  async function handleEditUser() {
    if (!editUser) return
    const err = validateEdit(editForm)
    if (err) {
      toast({ title: err, variant: "destructive" })
      return
    }
    setEditLoading(true)
    try {
      await userApi.updateUser(Number(editUser.id), {
        name: editForm.name.trim(),
        id_card: editForm.id_card.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
      })
      toast({ title: "修改成功" })
      setEditUser(null)
      
      // 重新验证数据
      mutate(['/api/users', searchTerm, activeTab, page, pageSize])
    } catch (e: any) {
      toast({ title: "修改失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setEditLoading(false)
    }
  }

  // 单条删除
  async function handleDeleteUser() {
    if (!deleteUserId) return
    setDeleteLoading(true)
    try {
      await userApi.deleteUser(Number(deleteUserId))
      toast({ title: "删除成功" })
      setDeleteUserId(null)
      setSelectedIds(selectedIds.filter(id => id !== deleteUserId))
      
      // 重新验证数据
      mutate(['/api/users', searchTerm, activeTab, page, pageSize])
    } catch (e: any) {
      toast({ title: "删除失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }

  // 批量删除
  async function handleBatchDelete() {
    if (selectedIds.length === 0) return
    setDeleteLoading(true)
    try {
      for (const id of selectedIds) {
        await userApi.deleteUser(Number(id))
      }
      toast({ title: "批量删除成功" })
      setSelectedIds([])
      setBatchDeleteOpen(false)
      
      // 重新验证数据
      mutate(['/api/users', searchTerm, activeTab, page, pageSize])
    } catch (e: any) {
      toast({ title: "批量删除失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 页面头部 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-600 mt-1">管理所有案件相关的用户信息</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) setAddForm(initialForm) }}>
          <DialogTrigger asChild>
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg">
              <Plus className="h-5 w-5 mr-2" />
              添加用户
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加新用户</DialogTitle>
            </DialogHeader>
            <form className="space-y-6" onSubmit={e => { e.preventDefault(); handleAddUser() }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userName">姓名 *</Label>
                  <Input id="userName" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="请输入姓名" />
                </div>
                <div>
                  <Label htmlFor="userIdCard">身份证号</Label>
                  <Input id="userIdCard" value={addForm.id_card} onChange={e => setAddForm(f => ({ ...f, id_card: e.target.value }))} placeholder="请输入身份证号" />
                </div>
              </div>
              <div>
                <Label htmlFor="userPhone">联系电话</Label>
                <Input id="userPhone" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="请输入联系电话" />
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" type="button" onClick={() => setIsAddDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={addLoading}>{addLoading ? "添加中..." : "添加用户"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索栏和刷新 */}
      <div className="flex items-center gap-4 mb-2">
        <Input
          className="w-72"
          placeholder="搜索姓名、手机号、身份证号..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button variant="outline" onClick={() => mutate(['/api/users', searchTerm, activeTab, page, pageSize])}>刷新</Button>
      </div>

      {/* 使用Suspense包装数据展示 */}
      <Suspense fallback={<div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div></div>}>
        <UserTableContent 
          searchTerm={searchTerm}
          activeTab={activeTab}
          page={page}
          pageSize={pageSize}
          onSelectIds={setSelectedIds}
          onViewUser={setViewUser}
          onOpenEdit={openEdit}
          onSetDeleteUserId={setDeleteUserId}
          selectedIds={selectedIds}
        />
      </Suspense>

      {/* 详情 Dialog */}
      <Dialog open={!!viewUser} onOpenChange={open => { if (!open) setViewUser(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>用户详情</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">姓名：</span>{viewUser.name}</div>
              <div><span className="font-medium">身份证号：</span>{viewUser.id_card || '-'}</div>
              <div><span className="font-medium">联系电话：</span>{viewUser.phone || '-'}</div>
              <div><span className="font-medium">ID：</span>{viewUser.id}</div>
              <div><span className="font-medium">创建时间：</span>{viewUser.created_at ? new Date(viewUser.created_at).toLocaleString() : '-'}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 编辑 Dialog */}
      <Dialog open={!!editUser} onOpenChange={open => { if (!open) setEditUser(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          <form className="space-y-5 mt-2" onSubmit={e => { e.preventDefault(); handleEditUser() }}>
            <div>
              <label className="block text-sm font-medium mb-1">姓名 *</label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">身份证号</label>
              <Input value={editForm.id_card} onChange={e => setEditForm(f => ({ ...f, id_card: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">联系电话</label>
              <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setEditUser(null)}>取消</Button>
              <Button type="submit" disabled={editLoading}>{editLoading ? "保存中..." : "保存"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={open => { if (!open) setDeleteUserId(null) }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">确定要删除该用户吗？此操作不可撤销。</div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleteLoading}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 批量删除 Dialog */}
      <Dialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>批量删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">确定要删除选中的 {selectedIds.length} 个用户吗？此操作不可撤销。</div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setBatchDeleteOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleBatchDelete} disabled={deleteLoading}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}