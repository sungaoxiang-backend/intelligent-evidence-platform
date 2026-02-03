"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  SkillFileNode,
  SkillSummary,
  SkillMeta,
  SkillVersionSummary,
  SkillStatus,
  skillManagementApi,
} from "@/lib/api-skill-management"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Save,
  Clock,
  GitBranch,
  FileCode,
  RotateCcw,
} from "lucide-react"

type SkillIdSet = Set<string>
type SkillTreeMap = Record<string, SkillFileNode | undefined>
type SkillExpandedSet = Set<string>
type ActiveFile = { skillId: string; path: string } | null
type ExpandedTreeNodes = Set<string>

function basename(p: string) {
  if (!p) return ""
  const parts = p.split("/")
  return parts[parts.length - 1] || p
}

const statusColors: Record<SkillStatus, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-200",
  pending_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
}

const statusLabels: Record<SkillStatus, string> = {
  draft: "草稿",
  pending_review: "待审核",
  approved: "已批准",
  rejected: "已拒绝",
}

function StatusBadge({ status }: { status: SkillStatus }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", statusColors[status])}>
      {statusLabels[status]}
    </span>
  )
}

function TreeRow({
  depth,
  selected,
  onClick,
  leftIcon,
  label,
  right,
}: {
  depth: number
  selected?: boolean
  onClick?: () => void
  leftIcon: React.ReactNode
  label: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] cursor-pointer select-none",
        selected ? "bg-accent" : "hover:bg-muted/60"
      )}
      style={{ paddingLeft: `${10 + depth * 14}px` }}
      onClick={onClick}
    >
      <div className="shrink-0 text-muted-foreground group-hover:text-foreground">{leftIcon}</div>
      <div className="min-w-0 flex-1 truncate">{label}</div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

function SkillExplorerTree({
  skillId,
  root,
  isSkillExpanded,
  setSkillExpanded,
  expandedNodes,
  setExpandedNodes,
  activeFile,
  onOpenFile,
  skillStatus,
}: {
  skillId: string
  root: SkillFileNode | undefined
  isSkillExpanded: boolean
  setSkillExpanded: (open: boolean) => void
  expandedNodes: ExpandedTreeNodes
  setExpandedNodes: (next: ExpandedTreeNodes) => void
  activeFile: ActiveFile
  onOpenFile: (path: string) => void
  skillStatus?: SkillStatus
}) {
  const isLoaded = Boolean(root)
  const rootNode: SkillFileNode = root ?? { path: "", type: "dir", children: [] }

  const renderNode = (node: SkillFileNode, depth: number) => {
    if (node.type === "dir") {
      const key = `${skillId}::${node.path}`
      const isRoot = node.path === ""
      const open = isRoot ? isSkillExpanded : expandedNodes.has(key)
      const toggle = () => {
        if (isRoot) {
          setSkillExpanded(!isSkillExpanded)
          return
        }
        const next = new Set(expandedNodes)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        setExpandedNodes(next)
      }

      const label = (
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("truncate font-medium", isRoot && "text-[13px]")}>
            {isRoot ? skillId : basename(node.path)}
          </span>
          {isRoot && skillStatus && (
            <div className={cn("w-2 h-2 rounded-full",
              skillStatus === 'approved' ? 'bg-green-500' :
                skillStatus === 'pending_review' ? 'bg-yellow-500' :
                  skillStatus === 'rejected' ? 'bg-red-500' : 'bg-gray-300'
            )} />
          )}
        </div>
      )

      return (
        <div key={key}>
          <TreeRow
            depth={depth}
            onClick={toggle}
            leftIcon={
              <div className="flex items-center gap-1">
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {open ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
              </div>
            }
            label={label}
          />
          {open ? (
            !isRoot && node.children?.length ? (
              <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
            ) : isRoot && !isLoaded ? (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground" style={{ paddingLeft: `${10 + (depth + 1) * 14}px` }}>
                加载中...
              </div>
            ) : node.children?.length ? (
              <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
            ) : null
          ) : null}
        </div>
      )
    }

    const isSelected = activeFile?.skillId === skillId && activeFile.path === node.path
    return (
      <TreeRow
        key={`${skillId}::${node.path}`}
        depth={depth}
        selected={isSelected}
        onClick={() => onOpenFile(node.path)}
        leftIcon={<FileText className="h-4 w-4" />}
        label={<span className="font-mono truncate">{basename(node.path)}</span>}
      />
    )
  }

  return renderNode(rootNode, 0)
}

export function SkillManagementClient() {
  const [skills, setSkills] = useState([] as SkillSummary[])
  const [skillQuery, setSkillQuery] = useState("")

  const [skillTrees, setSkillTrees] = useState({} as SkillTreeMap)
  const [expandedSkills, setExpandedSkills] = useState(new Set() as SkillExpandedSet)
  const [expandedTreeNodes, setExpandedTreeNodes] = useState(new Set() as ExpandedTreeNodes)

  const [activeFile, setActiveFile] = useState(null as ActiveFile)
  const [fileDraft, setFileDraft] = useState("")
  const [fileIsBinary, setFileIsBinary] = useState(false)
  const [fileSaving, setFileSaving] = useState(false)

  // Meta & Versioning State
  const [currentSkillMeta, setCurrentSkillMeta] = useState<SkillMeta | null>(null)
  const [skillVersions, setSkillVersions] = useState<SkillVersionSummary[]>([])
  const [versionMessage, setVersionMessage] = useState("")
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false)
  const [versionCreating, setVersionCreating] = useState(false)

  const [error, setError] = useState("")

  // Computed
  const activeSkillId = activeFile?.skillId
  const currentSkill = useMemo(() => skills.find(s => s.id === activeSkillId), [skills, activeSkillId])

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    if (!q) return skills
    return skills.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    )
  }, [skillQuery, skills])

  async function refreshSkills(q?: string) {
    try {
      const list = await skillManagementApi.listSkills(q)
      setSkills(list)
    } catch (e: any) {
      setError(e.message)
    }
  }

  // Initial Load
  useEffect(() => {
    refreshSkills()
  }, [])

  // Load Meta/Versions when active skill changes
  useEffect(() => {
    // If we selected a file, we know which skill is active.
    // But if we just expanded a skill tree (and not selected file), we might want to see details too?
    // For now, let's link "Active details" to "Selected File's Skill" or maybe we need a dedicated "Select Skill" action?
    // The requirement says: "active/inactive status ... remove ... new status system".
    // Let's assume selecting a file sets the "Active Skill Context".
    if (!activeSkillId) {
      setCurrentSkillMeta(null)
      setSkillVersions([])
      return
    }
    refreshMeta(activeSkillId)
  }, [activeSkillId])

  async function refreshMeta(skillId: string) {
    try {
      const [meta, versions] = await Promise.all([
        skillManagementApi.getSkillMeta(skillId),
        skillManagementApi.listVersions(skillId)
      ])
      setCurrentSkillMeta(meta)
      setSkillVersions(versions)
      // Update skill list status locally if needed
      setSkills(prev => prev.map(s => s.id === skillId ? { ...s, status: meta.status } : s))
    } catch (e: any) {
      console.error("Failed to load meta", e)
    }
  }

  async function ensureSkillTreeLoaded(skillId: string) {
    if (skillTrees[skillId]) return
    const tree = await skillManagementApi.getSkillTree(skillId)
    setSkillTrees((prev) => ({ ...prev, [skillId]: tree }))
  }

  async function openFile(skillId: string, nextPath: string) {
    setError("")
    try {
      const content = await skillManagementApi.getSkillFile(skillId, nextPath)
      setActiveFile({ skillId, path: nextPath })
      setFileIsBinary(content.is_binary)
      setFileDraft(content.content || "")
    } catch (e: any) {
      setError(e?.message || "Read file failed")
    }
  }

  async function saveFile() {
    if (!activeFile || fileIsBinary) return
    setFileSaving(true)
    setError("")
    try {
      await skillManagementApi.saveSkillFile(activeFile.skillId, activeFile.path, {
        is_binary: false,
        content: fileDraft,
      })
      // Maybe toast success?
    } catch (e: any) {
      setError(e?.message || "Save file failed")
    } finally {
      setFileSaving(false)
    }
  }

  async function updateStatus(status: SkillStatus) {
    if (!activeSkillId) return
    try {
      const meta = await skillManagementApi.updateSkillStatus(activeSkillId, status)
      setCurrentSkillMeta(meta)
      setSkills(prev => prev.map(s => s.id === activeSkillId ? { ...s, status: meta.status } : s))
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function createVersion() {
    if (!activeSkillId || !versionMessage.trim()) return
    setVersionCreating(true)
    try {
      await skillManagementApi.createVersion(activeSkillId, versionMessage)
      setVersionMessage("")
      setIsVersionDialogOpen(false)
      await refreshMeta(activeSkillId)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setVersionCreating(false)
    }
  }

  async function restoreVersion(versionId: string) {
    if (!activeSkillId || !confirm(`确定要恢复到版本 ${versionId} 吗？当前未保存的更改将会丢失。`)) return
    try {
      await skillManagementApi.restoreVersion(activeSkillId, versionId)
      await refreshMeta(activeSkillId)
      // Reload file if open
      if (activeFile && activeFile.skillId === activeSkillId) {
        await openFile(activeFile.skillId, activeFile.path)
      }
      // Reload tree
      const tree = await skillManagementApi.getSkillTree(activeSkillId)
      setSkillTrees(prev => ({ ...prev, [activeSkillId]: tree }))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("zh-CN")
    } catch {
      return ""
    }
  }

  return (
    <div className="h-[calc(100vh-4.5rem)]">
      <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border bg-background">
        {/* Left: Explorer */}
        <ResizablePanel defaultSize={20} minSize={15}>
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b">
              <div className="font-medium text-sm text-foreground">技能列表</div>
              <div className="mt-2">
                <Input
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                  placeholder="搜索技能..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredSkills.map((s) => {
                  const tree = skillTrees[s.id]
                  const expanded = expandedSkills.has(s.id)
                  return (
                    <SkillExplorerTree
                      key={s.id}
                      skillId={s.id}
                      root={tree}
                      isSkillExpanded={expanded}
                      setSkillExpanded={async (open) => {
                        const next = new Set(expandedSkills)
                        if (open) {
                          next.add(s.id)
                          try {
                            await ensureSkillTreeLoaded(s.id)
                          } catch (e: any) {
                            setError(e?.message || "Load tree failed")
                          }
                        } else {
                          next.delete(s.id)
                        }
                        setExpandedSkills(next)
                      }}
                      expandedNodes={expandedTreeNodes}
                      setExpandedNodes={setExpandedTreeNodes}
                      activeFile={activeFile}
                      onOpenFile={(path) => openFile(s.id, path)}
                      skillStatus={s.status}
                    />
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Center: Editor */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="h-full flex flex-col">
            <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/10 h-10">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium truncate">
                  {activeFile ? `${activeFile.skillId}/${activeFile.path}` : "未选择文件"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeFile && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs z-10"
                    onClick={saveFile}
                    disabled={fileIsBinary || fileSaving}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {fileSaving ? "保存中..." : "保存"}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {!activeFile ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  请选择一个文件进行编辑
                </div>
              ) : fileIsBinary ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  不支持显示二进制文件内容
                </div>
              ) : (
                <Textarea
                  value={fileDraft}
                  onChange={(e) => setFileDraft(e.target.value)}
                  className="h-full w-full font-mono text-xs leading-5 resize-none border-0 focus-visible:ring-0 p-4 rounded-none"
                  spellCheck={false}
                />
              )}
            </div>
            {error && (
              <div className="px-4 py-2 bg-red-50 text-red-600 text-xs border-t border-red-100 flex items-center justify-between">
                <span>{error}</span>
                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setError("")}><span className="sr-only">Dismiss</span>×</Button>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Details & Versions */}
        <ResizablePanel defaultSize={25} minSize={20}>
          {activeSkillId ? (
            <div className="h-full flex flex-col bg-muted/5">
              {/* Header */}
              <div className="px-4 py-3 border-b bg-background">
                <div className="font-semibold text-lg">{activeSkillId}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{currentSkill?.description || "暂无描述"}</div>
              </div>

              {/* Status */}
              <div className="px-4 py-4 border-b space-y-3 bg-background/50">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">状态</div>
                <div className="flex items-center justify-between">
                  {currentSkillMeta && <StatusBadge status={currentSkillMeta.status} />}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">更改状态</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateStatus("draft")}>设为草稿</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus("pending_review")}>提交审核</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => updateStatus("approved")}>批准</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus("rejected")}>拒绝</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Versions */}
              <div className="flex-1 flex flex-col min-h-0 bg-background">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/10">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    版本历史
                  </div>
                  <Dialog open={isVersionDialogOpen} onOpenChange={setIsVersionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <GitBranch className="h-3.5 w-3.5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>创建新版本</DialogTitle>
                        <DialogDescription>
                          为当前文件创建版本快照。
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Input
                          placeholder="版本描述（例如：添加了输入验证）"
                          value={versionMessage}
                          onChange={e => setVersionMessage(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsVersionDialogOpen(false)}>取消</Button>
                        <Button onClick={createVersion} disabled={versionCreating || !versionMessage.trim()}>
                          {versionCreating ? "创建中..." : "创建快照"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <ScrollArea className="flex-1">
                  <div className="divide-y">
                    {skillVersions.length === 0 ? (
                      <div className="p-4 text-xs text-muted-foreground text-center">暂无版本历史</div>
                    ) : (
                      skillVersions.map(v => (
                        <div key={v.version} className="p-3 hover:bg-muted/30 group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-mono font-medium">{v.version}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{formatTime(v.created_at)}</div>
                              <div className="text-xs mt-1.5 break-words text-foreground/90">{v.message}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="恢复此版本"
                              onClick={() => restoreVersion(v.version)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
              <FolderOpen className="h-10 w-10 opacity-20 mb-2" />
              <div className="text-sm">请选择一个技能查看详情</div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
