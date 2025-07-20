"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pagination } from "@/components/pagination"
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  MoreHorizontal,
  DollarSign,
  Calendar,
  User,
  Clock,
  FileText,
  Upload,
  Brain,
  Gavel,
  CheckCircle,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { caseApi } from "@/lib/api"
import type { Case } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast"
import { userApi } from "@/lib/user-api"

export function CaseManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const { toast } = useToast()
  // 详情/编辑/删除弹窗状态
  const [viewCase, setViewCase] = useState<Case | null>(null)
  const [editCase, setEditCase] = useState<Case | null>(null)
  const [editForm, setEditForm] = useState<Partial<Case>>({})
  const [editLoading, setEditLoading] = useState(false)
  const [deleteCaseId, setDeleteCaseId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  // 新增案件表单状态
  const [addForm, setAddForm] = useState<{ user_id: number | undefined; case_type: string; creditor_name: string; creditor_type: string; debtor_name: string; debtor_type: string; description: string }>({ user_id: undefined, case_type: "", creditor_name: "", creditor_type: "", debtor_name: "", debtor_type: "", description: "" })
  const [addLoading, setAddLoading] = useState(false)
  const [userOptions, setUserOptions] = useState<{ id: number; name: string }[]>([])
  useEffect(() => {
    if (isAddDialogOpen) {
      userApi.getUsers({ page: 1, pageSize: 100 }).then(res => {
        if (res.data) setUserOptions(res.data.map(u => ({ id: u.id as number, name: u.name })))
      })
    }
  }, [isAddDialogOpen])

  // 编辑表单校验
  function validateEdit(form: Partial<Case>) {
    if (!form.title?.trim()) return "案件标题为必填项"
    if (!form.case_type?.trim()) return "案件类型为必填项"
    if (!form.creditor_name?.trim()) return "债权人为必填项"
    if (!form.debtor_name?.trim()) return "债务人为必填项"
    return null
  }

  // 打开编辑弹窗并回显
  function openEdit(case_: Case) {
    setEditCase(case_)
    setEditForm({
      title: case_.title,
      case_type: case_.case_type,
      creditor_name: case_.creditor_name,
      creditor_type: case_.creditor_type,
      debtor_name: case_.debtor_name,
      debtor_type: case_.debtor_type,
      description: case_.description,
    })
  }

  async function handleEditCase() {
    if (!editCase) return
    const err = validateEdit(editForm)
    if (err) {
      toast({ title: err, variant: "destructive" })
      return
    }
    setEditLoading(true)
    try {
      await caseApi.updateCase(editCase.id, editForm)
      toast({ title: "修改成功" })
      setEditCase(null)
      loadCases()
    } catch (e: any) {
      toast({ title: "修改失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setEditLoading(false)
    }
  }

  // 单条删除
  async function handleDeleteCase() {
    if (!deleteCaseId) return
    setDeleteLoading(true)
    try {
      await caseApi.deleteCase(deleteCaseId)
      toast({ title: "删除成功" })
      setDeleteCaseId(null)
      loadCases()
    } catch (e: any) {
      toast({ title: "删除失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }

  function validateAdd(form: typeof addForm) {
    if (!form.user_id) return "请选择关联用户"
    if (!form.case_type) return "请选择案件类型"
    if (!form.creditor_name.trim()) return "债权人为必填项"
    if (!form.creditor_type) return "请选择债权人类型"
    if (!form.debtor_name.trim()) return "债务人为必填项"
    if (!form.debtor_type) return "请选择债务��类型"
    return null
  }

  async function handleAddCase() {
    const err = validateAdd(addForm)
    if (err) {
      toast({ title: err, variant: "destructive" })
      return
    }
    setAddLoading(true)
    try {
      await caseApi.createCase({
        ...(addForm.user_id ? { user_id: addForm.user_id } : {}),
        case_type: addForm.case_type,
        creditor_name: addForm.creditor_name.trim(),
        creditor_type: addForm.creditor_type,
        debtor_name: addForm.debtor_name.trim(),
        debtor_type: addForm.debtor_type,
        description: addForm.description.trim() || undefined,
      })
      toast({ title: "案件创建成功" })
      setIsAddDialogOpen(false)
      setAddForm({ user_id: undefined, case_type: "", creditor_name: "", creditor_type: "", debtor_name: "", debtor_type: "", description: "" })
      await loadCases()
    } catch (e: any) {
      toast({ title: "创建失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setAddLoading(false)
    }
  }

  useEffect(() => {
    loadCases()
  }, [currentPage, pageSize, searchTerm])

  const loadCases = async () => {
    setLoading(true)
    try {
      const response = await caseApi.getCases({
        page: currentPage,
        pageSize,
        search: searchTerm,
      })
      setCases(response.data)
      setTotal(response.pagination?.total || 0)
    } catch (error) {
      console.error("加载案件失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      {/* 页面头部 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-3 lg:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">案件管理</h1>
          <p className="text-muted-foreground mt-1 text-sm">管理所有债务纠纷案件</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg h-9">
              <Plus className="h-4 w-4 mr-2" />
              录入新案件
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>录入新案件 - 基础信息</DialogTitle>
            </DialogHeader>
            <form className="space-y-6" onSubmit={e => { e.preventDefault(); handleAddCase() }}>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="userSelect">关联用户 *</Label>
                  <select id="userSelect" className="w-full p-2 border rounded-md" value={addForm.user_id === undefined ? "" : addForm.user_id} onChange={e => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    const user = userOptions.find(u => u.id === val);
                    setAddForm(f => ({
                      ...f,
                      user_id: val,
                      creditor_name: user ? user.name : ""
                    }))
                  }}>
                    <option value="">请选择用户</option>
                    {userOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="caseType">案件类型 *</Label>
                  <select id="caseType" className="w-full p-2 border rounded-md" value={addForm.case_type} onChange={e => setAddForm(f => ({ ...f, case_type: e.target.value }))}>
                    <option value="">请选择案件类型</option>
                    <option value="debt">借款纠纷</option>
                    <option value="contract">合同纠纷</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="creditorName">债权人 *</Label>
                  <Input id="creditorName" value={addForm.creditor_name} onChange={e => setAddForm(f => ({ ...f, creditor_name: e.target.value }))} placeholder="请输入债权人" />
                </div>
                <div>
                  <Label htmlFor="creditorType">债权人类型 *</Label>
                  <select id="creditorType" className="w-full p-2 border rounded-md" value={addForm.creditor_type} onChange={e => setAddForm(f => ({ ...f, creditor_type: e.target.value }))}>
                    <option value="">请选择类型</option>
                    <option value="person">个人</option>
                    <option value="company">公司</option>
                    <option value="individual">个体工商户</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="debtorName">债务人 *</Label>
                  <Input id="debtorName" value={addForm.debtor_name} onChange={e => setAddForm(f => ({ ...f, debtor_name: e.target.value }))} placeholder="请输入债务人" />
                </div>
                <div>
                  <Label htmlFor="debtorType">债务人类型 *</Label>
                  <select id="debtorType" className="w-full p-2 border rounded-md" value={addForm.debtor_type} onChange={e => setAddForm(f => ({ ...f, debtor_type: e.target.value }))}>
                    <option value="">请选择类型</option>
                    <option value="person">个人</option>
                    <option value="company">公司</option>
                    <option value="individual">个体工商户</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="description">案件描述</Label>
                  <Textarea id="description" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="请详细描述案件情况、争议焦点等" rows={3} />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" type="button" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
                <Button type="submit" disabled={addLoading}>{addLoading ? "创建中..." : "创建案件"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-4 mb-2">
        <Input
          className="w-72"
          placeholder="搜索案件标题、债权人、债务人..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button variant="outline" onClick={loadCases}>刷新</Button>
      </div>

      {/* 案件表格 */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-sm align-middle">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">案件标题</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">案件类型</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">债权人</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">债务人</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">创建时间</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">加载中...</td></tr>
            ) : cases.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">暂无数据</td></tr>
            ) : (
              cases.map((case_) => (
                <tr key={case_.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3 whitespace-nowrap">{case_.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{case_.case_type}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{case_.creditor_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{case_.debtor_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{case_.created_at ? new Date(case_.created_at).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <Link href={`/cases/${case_.id}`} passHref>
                      <Button variant="outline" size="sm" className="mr-2">查看证据</Button>
                    </Link>
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => setViewCase(case_)}>查看详情</Button>
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => openEdit(case_)}>编辑</Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteCaseId(case_.id)}>删除</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页组件 */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            total={total}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            loading={loading}
          />
        </div>
      )}

      <Dialog open={!!viewCase} onOpenChange={open => { if (!open) setViewCase(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>案件详情</DialogTitle>
          </DialogHeader>
          {viewCase && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">案件标题：</span>{viewCase.title}</div>
              <div><span className="font-medium">案件类型：</span>{viewCase.case_type}</div>
              <div><span className="font-medium">债权人：</span>{viewCase.creditor_name}</div>
              <div><span className="font-medium">债权人类型：</span>{viewCase.creditor_type || '-'}</div>
              <div><span className="font-medium">债务人：</span>{viewCase.debtor_name}</div>
              <div><span className="font-medium">债务人类型：</span>{viewCase.debtor_type || '-'}</div>
              <div><span className="font-medium">案件描述：</span>{viewCase.description || '-'}</div>
              <div><span className="font-medium">创建时间：</span>{viewCase.created_at ? new Date(viewCase.created_at).toLocaleString() : '-'}</div>
              <div><span className="font-medium">更新时间：</span>{viewCase.updated_at ? new Date(viewCase.updated_at).toLocaleString() : '-'}</div>
              <div><span className="font-medium">ID：</span>{viewCase.id}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editCase} onOpenChange={open => { if (!open) setEditCase(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑案件</DialogTitle>
          </DialogHeader>
          <form className="space-y-5 mt-2" onSubmit={e => { e.preventDefault(); handleEditCase() }}>
            <div>
              <label className="block text-sm font-medium mb-1">案件标题 *</label>
              <Input value={editForm.title || ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">案件类型 *</label>
              <Input value={editForm.case_type || ""} onChange={e => setEditForm(f => ({ ...f, case_type: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">债权人 *</label>
              <Input value={editForm.creditor_name || ""} onChange={e => setEditForm(f => ({ ...f, creditor_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">债权人类型</label>
              <Input value={editForm.creditor_type || ""} onChange={e => setEditForm(f => ({ ...f, creditor_type: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">债务人 *</label>
              <Input value={editForm.debtor_name || ""} onChange={e => setEditForm(f => ({ ...f, debtor_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">债务人类型</label>
              <Input value={editForm.debtor_type || ""} onChange={e => setEditForm(f => ({ ...f, debtor_type: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">案件描述</label>
              <Textarea value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setEditCase(null)}>取消</Button>
              <Button type="submit" disabled={editLoading}>{editLoading ? "保存中..." : "保存"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteCaseId} onOpenChange={open => { if (!open) setDeleteCaseId(null) }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">确定要删除该案件吗？此操作不可撤销。</div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteCaseId(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteCase} disabled={deleteLoading}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
