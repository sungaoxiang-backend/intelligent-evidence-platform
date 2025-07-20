"use client"

import { useState, Suspense, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/pagination"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, UserPlus } from "lucide-react"
import { caseApi } from "@/lib/api"
import { userApi } from "@/lib/user-api"
import type { Case } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast"
import useSWR, { mutate } from "swr"
import { CaseTableSkeleton } from "./case-table-skeleton"
import { User } from '@/lib/types'

// SWR数据获取函数
const fetcher = async ([key, search, page, pageSize]: [string, string, number, number]) => {
  const response = await caseApi.getCases({
    page,
    pageSize,
    search,
  })
  return response
}
// CASE_TYPES 定义提前到文件顶部且唯一
const CASE_TYPES: Record<string, string> = {
  debt: "借款纠纷",
  contract: "合同纠纷"
};

// 使用Suspense的数据展示组件
function CaseTableContent({ 
  searchTerm, 
  currentPage, 
  pageSize, 
  onPageChange, 
  onPageSizeChange,
  onViewCase,
  onEditCase,
  onDeleteCase
}: {
  searchTerm: string
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onViewCase: (case_: Case) => void
  onEditCase: (case_: Case) => void
  onDeleteCase: (case_: Case) => void
}) {
  const { data, error } = useSWR(
    ['/api/cases', searchTerm, currentPage, pageSize],
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

  const cases = data?.data || []
  const total = data?.pagination?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  return (
    <>
      {/* 案件表格 */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-sm align-middle">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">关联用户</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">案件类型</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">债权人</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">债务人</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">创建时间</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">暂无数据</td></tr>
            ) : (
              cases.map((case_: Case) => (
                <tr key={case_.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3 whitespace-nowrap">{case_.creditor_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{CASE_TYPES[case_.case_type as keyof typeof CASE_TYPES] || case_.case_type}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{case_.creditor_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{case_.debtor_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{case_.created_at ? new Date(case_.created_at).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <Link href={`/cases/${case_.id}`} passHref>
                      <Button variant="outline" size="sm" className="mr-2">查看证据</Button>
                    </Link>
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => onViewCase(case_)}>查看详情</Button>
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => onEditCase(case_)}>编辑</Button>
                    <Button variant="destructive" size="sm" onClick={() => onDeleteCase(case_)}>删除</Button>
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
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            loading={false}
          />
        </div>
      )}
    </>
  )
}

export function CaseManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const { toast } = useToast()

  // 详情/编辑/删除弹窗状态
  const [viewCase, setViewCase] = useState<Case | null>(null)
  const [editCase, setEditCase] = useState<Case | null>(null)
  const [editForm, setEditForm] = useState<Partial<Case>>({})
  const [editLoading, setEditLoading] = useState(false)
  const [deleteCase, setDeleteCase] = useState<Case | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 用户相关状态
  const [users, setUsers] = useState<User[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [newUserForm, setNewUserForm] = useState({ name: "", id_card: "", phone: "" })
  const [userLoading, setUserLoading] = useState(false)

  // 用户类型枚举 - 对齐后端
  const PARTY_TYPES = {
    person: "个人",
    company: "公司", 
    individual: "个体工商户"
  } as const

  // addForm/Case/Partial<Case> 类型声明调整
  const [addForm, setAddForm] = useState<{
    user_id: number;
    case_type: keyof typeof CASE_TYPES;
    creditor_name: string;
    creditor_type?: keyof typeof PARTY_TYPES;
    debtor_name: string;
    debtor_type?: keyof typeof PARTY_TYPES;
    description: string;
  }>({
    user_id: 0,
    case_type: "debt",
    creditor_name: "",
    creditor_type: undefined,
    debtor_name: "",
    debtor_type: undefined,
    description: ""
  });
  const [addLoading, setAddLoading] = useState(false)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1)
  }

  const refreshData = () => {
    mutate(['/api/cases', searchTerm, currentPage, pageSize])
  }

  // 获取用户列表
  const fetchUsers = async (search = "") => {
    setUserLoading(true)
    try {
      const response = await userApi.getUsers({ page: 1, pageSize: 50, search })
      setUsers(response.data)
      return response.data
    } catch (error) {
      toast({ title: "获取用户失败", variant: "destructive" })
      return []
    } finally {
      setUserLoading(false)
    }
  }

  // 实时搜索用户
  const handleUserSearch = (search: string) => {
    setUserSearch(search)
    const delayDebounceFn = setTimeout(() => {
      fetchUsers(search)
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }

  // 创建新用户
  const handleCreateUser = async () => {
    const err = validateNewUser(newUserForm)
    if (err) {
      toast({ title: err, variant: "destructive" })
      return
    }
    setUserLoading(true)
    try {
      const response = await userApi.createUser({
        name: newUserForm.name.trim(),
        id_card: newUserForm.id_card.trim() || undefined,
        phone: newUserForm.phone.trim() || undefined,
      })
      
      // 添加新用户到列表并选择
      const newUser = response.data
      setUsers(prev => [...prev, newUser])
      setAddForm(prev => ({ ...prev, user_id: newUser.id, creditor_name: newUser.name }))
      setIsCreatingUser(false)
      setNewUserForm({ name: "", id_card: "", phone: "" })
      setUserSearch("") // 清空搜索
      toast({ title: "用户创建成功" })
    } catch (error: any) {
      toast({ title: "创建用户失败", description: error?.message || "", variant: "destructive" })
    } finally {
      setUserLoading(false)
    }
  }

  // 验证新用户表单
  function validateNewUser(form: typeof newUserForm) {
    if (!form.name.trim()) return "姓名为必填项"
    if (form.phone && !/^1[3-9]\d{9}$/.test(form.phone.trim())) return "手机号码格式不正确"
    if (form.id_card && !/^\d{15}$|^\d{17}[\dXx]$/.test(form.id_card.trim())) return "身份证号码格式不正确"
    return null
  }

  // 新增表单校验
  function validateAdd(form: typeof addForm) {
    if (!form.user_id) return "请选择关联用户"
    if (!form.debtor_name.trim()) return "债务人为必填项"
    return null
  }

  // 编辑表单校验
  function validateEdit(form: Partial<Case>) {
    if (!form.case_type) return "案件类型为必填项"
    if (!form.creditor_name?.trim()) return "债权人为必填项"
    if (!form.debtor_name?.trim()) return "债务人为必填项"
    return null
  }

  // 打开编辑弹窗并回显
  function openEdit(case_: Case) {
    setEditCase(case_)
    setEditForm({
      case_type: case_.case_type as keyof typeof CASE_TYPES,
      creditor_name: case_.creditor_name,
      creditor_type: case_.creditor_type as keyof typeof PARTY_TYPES,
      debtor_name: case_.debtor_name,
      debtor_type: case_.debtor_type as keyof typeof PARTY_TYPES,
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
      refreshData()
    } catch (e: any) {
      toast({ title: "修改失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setEditLoading(false)
    }
  }

  // 单条删除
  async function handleDeleteCase() {
    if (!deleteCase) return
    setDeleteLoading(true)
    try {
      await caseApi.deleteCase(deleteCase.id)
      toast({ title: "删除成功" })
      setDeleteCase(null)
      refreshData()
    } catch (e: any) {
      toast({ title: "删除失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }


  async function handleAddCase() {
    const err = validateAdd(addForm)
    if (err) {
      toast({ title: err, variant: "destructive" })
      return
    }
    setAddLoading(true)
    try {
      await caseApi.createCase(addForm)
      toast({ title: "添加成功" })
      setIsAddDialogOpen(false)
      setAddForm({
        user_id: 0,
        case_type: "debt",
        creditor_name: "",
        creditor_type: undefined,
        debtor_name: "",
        debtor_type: undefined,
        description: ""
      })
      refreshData()
    } catch (e: any) {
      toast({ title: "添加失败", description: e?.message || "", variant: "destructive" })
    } finally {
      setAddLoading(false)
    }
  }

  useEffect(() => {
    if (isAddDialogOpen) {
      fetchUsers(""); // 弹窗打开时自动加载全部用户
    }
  }, [isAddDialogOpen]);

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
              <DialogTitle>录入新案件</DialogTitle>
            </DialogHeader>
            <form className="space-y-6" onSubmit={e => { e.preventDefault(); handleAddCase() }}>
              <div className="grid grid-cols-2 gap-6">
                {/* 必填项一行展示 */}
                <div className="col-span-1">
                  <Label htmlFor="userSelect">关联用户 *</Label>
                  <Select 
                    value={addForm.user_id ? String(addForm.user_id) : ""} 
                    onValueChange={value => {
                      const user = users.find(u => String(u.id) === value)
                      if (user) {
                        setAddForm(prev => ({ ...prev, user_id: user.id, creditor_name: user.name }))
                      }
                    }}
                    disabled={userLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={userLoading ? "加载中..." : (users.length === 0 ? "暂无用户，请先创建" : "选择用户")} />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <Input
                          placeholder="搜索用户姓名或电话..."
                          value={userSearch}
                          onChange={(e) => handleUserSearch(e.target.value)}
                          className="h-8 text-sm mb-2"
                        />
                      </div>
                      {users.length === 0 ? (
                        <SelectItem value="0" disabled>
                          {userSearch ? "未找到匹配用户" : "暂无用户数据"}
                        </SelectItem>
                      ) : (
                        users.map(user => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name} {user.phone && `(${user.phone})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Label htmlFor="debtorName">债务人姓名 *</Label>
                  <Input 
                    id="debtorName" 
                    value={addForm.debtor_name} 
                    onChange={e => setAddForm({...addForm, debtor_name: e.target.value})} 
                    placeholder="请输入债务人姓名"
                  />
                </div>
                {/* 非必填项 */}
                <div>
                  <Label htmlFor="caseType">案件类型</Label>
                  <Select 
                    value={addForm.case_type} 
                    onValueChange={value => setAddForm({...addForm, case_type: value as keyof typeof CASE_TYPES})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CASE_TYPES).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="creditorName">债权人</Label>
                  <Input 
                    id="creditorName" 
                    value={addForm.creditor_name} 
                    onChange={e => setAddForm({...addForm, creditor_name: e.target.value})} 
                    placeholder="请输入债权人姓名"
                  />
                </div>
                <div>
                  <Label htmlFor="creditorType">债权人类型</Label>
                  <Select 
                    value={addForm.creditor_type || "none"} 
                    onValueChange={value => setAddForm({...addForm, creditor_type: value === "none" ? undefined : value as keyof typeof PARTY_TYPES})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择类型"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不选择</SelectItem>
                      {Object.entries(PARTY_TYPES).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="debtorType">债务人类型</Label>
                  <Select 
                    value={addForm.debtor_type || "none"} 
                    onValueChange={value => setAddForm({...addForm, debtor_type: value === "none" ? undefined : value as keyof typeof PARTY_TYPES})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择类型"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不选择</SelectItem>
                      {Object.entries(PARTY_TYPES).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">案件描述</Label>
                <Textarea 
                  id="description" 
                  value={addForm.description} 
                  onChange={e => setAddForm({...addForm, description: e.target.value})} 
                  placeholder="请输入案件的详细描述"
                  rows={4}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={addLoading}>
                  {addLoading ? "添加中..." : "添加案件"}
                </Button>
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
        <Button variant="outline" onClick={refreshData}>刷新</Button>
      </div>

      {/* 使用Suspense包裹数据展示部分 */}
      <Suspense fallback={<CaseTableSkeleton />}>
        <CaseTableContent 
          searchTerm={searchTerm}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onViewCase={setViewCase}
          onEditCase={openEdit}
          onDeleteCase={setDeleteCase}
        />
      </Suspense>

      {/* 详情 Dialog */}
      <Dialog open={!!viewCase} onOpenChange={open => { if (!open) setViewCase(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>案件详情</DialogTitle>
          </DialogHeader>
          {viewCase && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">案件标题：</span>{viewCase.title}</div>
              <div><span className="font-medium">案件类型：</span>{CASE_TYPES[viewCase.case_type as keyof typeof CASE_TYPES] || viewCase.case_type}</div>
              <div>
                <span className="font-medium">债权人：</span>
                {viewCase.creditor_name}
                {viewCase.creditor_type && PARTY_TYPES[viewCase.creditor_type as keyof typeof PARTY_TYPES]
                  ? `（${PARTY_TYPES[viewCase.creditor_type as keyof typeof PARTY_TYPES]}）`
                  : ""}
              </div>
              <div>
                <span className="font-medium">债务人：</span>
                {viewCase.debtor_name}
                {viewCase.debtor_type && PARTY_TYPES[viewCase.debtor_type as keyof typeof PARTY_TYPES]
                  ? `（${PARTY_TYPES[viewCase.debtor_type as keyof typeof PARTY_TYPES]}）`
                  : ""}
              </div>
              <div><span className="font-medium">描述：</span>{viewCase.description || '-'}</div>
              <div><span className="font-medium">创建时间：</span>{viewCase.created_at ? new Date(viewCase.created_at).toLocaleString() : '-'}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 编辑 Dialog */}
      <Dialog open={!!editCase} onOpenChange={open => { if (!open) setEditCase(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑案件</DialogTitle>
          </DialogHeader>
          <form className="space-y-5 mt-2" onSubmit={e => { e.preventDefault(); handleEditCase() }}>
            <div>
              <label className="block text-sm font-medium mb-1">案件类型 *</label>
              <Select 
                value={editForm.case_type || ""} 
                onValueChange={value => setEditForm(f => ({ ...f, case_type: value as keyof typeof CASE_TYPES }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CASE_TYPES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">债权人 *</label>
              <Input value={editForm.creditor_name || ""} onChange={e => setEditForm(f => ({ ...f, creditor_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">债权人类型</label>
              <Select 
                value={editForm.creditor_type || "none"} 
                onValueChange={value => setEditForm(f => ({ ...f, creditor_type: value === "none" ? undefined : value as keyof typeof PARTY_TYPES }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择类型"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不选择</SelectItem>
                  {Object.entries(PARTY_TYPES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">债务人 *</label>
              <Input value={editForm.debtor_name || ""} onChange={e => setEditForm(f => ({ ...f, debtor_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">债务人类型</label>
              <Select 
                value={editForm.debtor_type || "none"} 
                onValueChange={value => setEditForm(f => ({ ...f, debtor_type: value === "none" ? undefined : value as keyof typeof PARTY_TYPES }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择类型"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不选择</SelectItem>
                  {Object.entries(PARTY_TYPES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <Textarea value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setEditCase(null)}>取消</Button>
              <Button type="submit" disabled={editLoading}>{editLoading ? "保存中..." : "保存"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={!!deleteCase} onOpenChange={open => { if (!open) setDeleteCase(null) }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            确定要删除案件 "{deleteCase?.title}" 吗？此操作不可撤销。
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteCase(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteCase} disabled={deleteLoading}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}