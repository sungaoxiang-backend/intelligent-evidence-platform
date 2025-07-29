"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Edit, Trash2 } from "lucide-react"
import { staffApi } from "@/lib/staff-api"
import { ListPage } from "@/components/common/list-page"
import { usePaginatedSWR } from "@/hooks/use-paginated-swr"
import { SortableHeader, formatDateTime, type SortDirection } from "@/components/common/sortable-header"

interface Staff {
  id: number
  username: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
}

export default function StaffManagement() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [sort, setSort] = useState<{ field: string; direction: SortDirection }>({
    field: "created_at",
    direction: "desc"
  });

  const [addForm, setAddForm] = useState({
    username: "",
    password: "",
    is_active: true,
    is_superuser: false,
  })

  const [editForm, setEditForm] = useState({
    username: "",
    is_active: true,
    is_superuser: false,
  })

  // Use paginated SWR hook
  const {
    data: staff,
    loading,
    error,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    mutate
  } = usePaginatedSWR<Staff>(
    "/staff",
    (params) => staffApi.getStaff(params),
    [],
  )

  const handleAddStaff = async () => {
    try {
      await staffApi.createStaff(addForm)
      setShowAddDialog(false)
      setAddForm({
        username: "",
        password: "",
        is_active: true,
        is_superuser: false,
      })
      mutate()
    } catch (error) {
      console.error("Failed to create staff:", error)
    }
  }

  const handleEditStaff = async () => {
    if (!editingStaff) return
    
    try {
      await staffApi.updateStaff(editingStaff.id, editForm)
      setShowEditDialog(false)
      setEditingStaff(null)
      mutate()
    } catch (error) {
      console.error("Failed to update staff:", error)
    }
  }

  const handleDeleteStaff = async (id: number) => {
    if (!confirm("确定要删除这个员工吗？")) return
    
    try {
      await staffApi.deleteStaff(id)
      mutate()
    } catch (error) {
      console.error("Failed to delete staff:", error)
    }
  }

  const handleSort = (field: string, direction: SortDirection) => {
    setSort({ field, direction });
  };

  // 对数据进行排序
  const getSortedStaff = (staff: Staff[]) => {
    if (!sort.field || !sort.direction) {
      return staff;
    }

    return [...staff].sort((a, b) => {
      let aValue: any = a[sort.field as keyof Staff];
      let bValue: any = b[sort.field as keyof Staff];

      // 处理时间字段
      if (sort.field === 'created_at' || sort.field === 'updated_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // 处理字符串字段
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sort.direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  const openEditDialog = (staffMember: Staff) => {
    setEditingStaff(staffMember)
    setEditForm({
      username: staffMember.username,
      is_active: staffMember.is_active,
      is_superuser: staffMember.is_superuser,
    })
    setShowEditDialog(true)
  }

  const openAddDialog = () => {
    setShowAddDialog(true)
  }

  const renderTable = (staff: Staff[]) => {
    const sortedStaff = getSortedStaff(staff);
    
    return (
    <>
      {/* Staff Table */}
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>
                <SortableHeader
                  field="created_at"
                  currentSort={sort}
                  onSort={handleSort}
                >
                  创建时间
                </SortableHeader>
              </TableHead>
              <TableHead>
                <SortableHeader
                  field="updated_at"
                  currentSort={sort}
                  onSort={handleSort}
                >
                  更新时间
                </SortableHeader>
              </TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStaff.map((staffMember) => (
              <TableRow key={staffMember.id}>
                <TableCell className="font-medium">{staffMember.username}</TableCell>
                <TableCell>
                  {staffMember.is_superuser ? (
                    <Badge className="bg-red-100 text-red-800">超级管理员</Badge>
                  ) : (
                    <Badge variant="outline">普通员工</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {staffMember.is_active ? (
                    <Badge className="bg-green-100 text-green-800">活跃</Badge>
                  ) : (
                    <Badge variant="destructive">禁用</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatDateTime(staffMember.created_at)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {formatDateTime(staffMember.updated_at)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(staffMember)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStaff(staffMember.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
  };

  return (
    <>
      <ListPage
        title="员工管理"
        subtitle="管理系统中的所有员工信息"
        headerActions={
          <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            新增员工
          </Button>
        }
        data={staff}
        loading={loading}
        error={error}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        renderTable={renderTable}
        emptyMessage="暂无员工数据"
        emptyAction={
          <Button onClick={openAddDialog} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            创建第一个员工
          </Button>
        }
      />

      {/* Add Staff Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>新增员工</DialogTitle>
            <DialogDescription>
              创建一个新的员工记录
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                用户名
              </Label>
              <Input
                id="username"
                value={addForm.username}
                onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_active" className="text-right">
                状态
              </Label>
              <div className="col-span-3">
                <Checkbox
                  id="is_active"
                  checked={addForm.is_active}
                  onCheckedChange={(checked) => setAddForm({ ...addForm, is_active: !!checked })}
                />
                <label htmlFor="is_active" className="ml-2 text-sm">
                  活跃
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_superuser" className="text-right">
                权限
              </Label>
              <div className="col-span-3">
                <Checkbox
                  id="is_superuser"
                  checked={addForm.is_superuser}
                  onCheckedChange={(checked) => setAddForm({ ...addForm, is_superuser: !!checked })}
                />
                <label htmlFor="is_superuser" className="ml-2 text-sm">
                  超级管理员
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddStaff}>
              创建员工
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑员工</DialogTitle>
            <DialogDescription>
              修改员工信息
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-username" className="text-right">
                用户名
              </Label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-is_active" className="text-right">
                状态
              </Label>
              <div className="col-span-3">
                <Checkbox
                  id="edit-is_active"
                  checked={editForm.is_active}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: !!checked })}
                />
                <label htmlFor="edit-is_active" className="ml-2 text-sm">
                  活跃
                </label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-is_superuser" className="text-right">
                权限
              </Label>
              <div className="col-span-3">
                <Checkbox
                  id="edit-is_superuser"
                  checked={editForm.is_superuser}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, is_superuser: !!checked })}
                />
                <label htmlFor="edit-is_superuser" className="ml-2 text-sm">
                  超级管理员
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleEditStaff}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}