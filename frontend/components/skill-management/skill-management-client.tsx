"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  AgentPromptVersionDetail,
  AgentPromptVersionSummary,
  AgentSummary,
  SkillFileNode,
  SkillSummary,
  skillManagementApi,
} from "@/lib/api-skill-management"
import {
  Settings2,
  Trash2,
  Copy,
  Check,
  SlidersHorizontal,
  BookmarkPlus,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  X,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vs } from "react-syntax-highlighter/dist/esm/styles/prism"

type ChatMessage = { role: "user" | "assistant"; content: string; createdAt: number }
type SkillIdSet = Set<string>
type SkillTreeMap = Record<string, SkillFileNode | undefined>
type SkillExpandedSet = Set<string>
type ActiveFile = { skillId: string; path: string } | null
type SessionPreset = { name: string; agentId: string; promptVersion: string; skillIds: string[]; updatedAt: number }
type ExpandedTreeNodes = Set<string>

const PRESET_STORAGE_KEY = "skill_management_session_presets_v1"

function safeLoadPresets(): SessionPreset[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean) as SessionPreset[]
  } catch {
    return []
  }
}

function safeSavePresets(presets: SessionPreset[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // ignore
  }
}

function extractSkillOutputTypes(text: string): string[] {
  const types = new Set<string>()
  const re = /<skill-output[^>]*type="([^"]+)"[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m[1]) types.add(m[1])
  }
  return Array.from(types)
}

function normalizeAssistantMarkdown(text: string): string {
  let out = text
  out = out.replace(/<\|[a-zA-Z]+\|>/g, "")
  out = out.replace(
    /<skill-output[^>]*type="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/skill-output>/g,
    (_full, type, body) => `\n\n**<skill-output type="${type}">**\n\n\`\`\`json\n${body.trim()}\n\`\`\`\n\n`
  )
  return out.trim()
}

function CopyIconButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value)
                setCopied(true)
                setTimeout(() => setCopied(false), 1400)
              } catch {
                // ignore
              }
            }}
            aria-label={label}
            title={label}
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "已复制" : label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function MarkdownMessage({ content }: { content: string }) {
  const normalized = useMemo(() => normalizeAssistantMarkdown(content), [content])
  return (
    <ReactMarkdown
      className="prose prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent dark:prose-invert"
      components={{
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "")
          const language = match?.[1]
          const raw = String(children ?? "")
          if (inline) {
            return (
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[12px]" {...props}>
                {children}
              </code>
            )
          }
          return (
            <div className="rounded-xl border overflow-hidden bg-background">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <div className="text-xs text-muted-foreground font-mono">{language || "text"}</div>
                <CopyIconButton value={raw.replace(/\n$/, "")} label="复制代码" />
              </div>
              <SyntaxHighlighter
                language={language}
                style={vs as any}
                customStyle={{ margin: 0, padding: "12px", background: "transparent" }}
                showLineNumbers={false}
              >
                {raw.replace(/\n$/, "")}
              </SyntaxHighlighter>
            </div>
          )
        },
      }}
    >
      {normalized}
    </ReactMarkdown>
  )
}

function basename(p: string) {
  if (!p) return ""
  const parts = p.split("/")
  return parts[parts.length - 1] || p
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
  isActiveSkill,
  onToggleActive,
  expandedNodes,
  setExpandedNodes,
  activeFile,
  onOpenFile,
}: {
  skillId: string
  root: SkillFileNode | undefined
  isSkillExpanded: boolean
  setSkillExpanded: (open: boolean) => void
  isActiveSkill: boolean
  onToggleActive: (next: boolean) => void
  expandedNodes: ExpandedTreeNodes
  setExpandedNodes: (next: ExpandedTreeNodes) => void
  activeFile: ActiveFile
  onOpenFile: (path: string) => void
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
          {isRoot && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border",
                isActiveSkill
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-muted/30 border-border text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActiveSkill ? "bg-emerald-500" : "bg-muted-foreground/50"
                )}
              />
              {isActiveSkill ? "Active" : "Inactive"}
            </span>
          )}
        </div>
      )

      const right = isRoot ? (
        <div
          className="flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <div className="text-[11px] text-muted-foreground hidden group-hover:block">激活</div>
          <Switch checked={isActiveSkill} onCheckedChange={onToggleActive} />
        </div>
      ) : null

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
            right={right}
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
  const [agents, setAgents] = useState([] as AgentSummary[])
  const [agentId, setAgentId] = useState("")

  const [promptVersions, setPromptVersions] = useState([] as AgentPromptVersionSummary[])
  const [promptVersion, setPromptVersion] = useState("")
  const [promptDetail, setPromptDetail] = useState(null as AgentPromptVersionDetail | null)
  const [promptDraft, setPromptDraft] = useState("")
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptSheetOpen, setPromptSheetOpen] = useState(false)

  const [skills, setSkills] = useState([] as SkillSummary[])
  const [skillQuery, setSkillQuery] = useState("")
  const [activeSkillIds, setActiveSkillIds] = useState(new Set() as SkillIdSet)

  const [skillTrees, setSkillTrees] = useState({} as SkillTreeMap)
  const [expandedSkills, setExpandedSkills] = useState(new Set() as SkillExpandedSet)
  const [expandedTreeNodes, setExpandedTreeNodes] = useState(new Set() as ExpandedTreeNodes)
  const [activeFile, setActiveFile] = useState(null as ActiveFile)
  const [fileDraft, setFileDraft] = useState("")
  const [fileIsBinary, setFileIsBinary] = useState(false)
  const [fileSaving, setFileSaving] = useState(false)

  const [messages, setMessages] = useState([] as ChatMessage[])
  const [input, setInput] = useState("")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [autoScroll, setAutoScroll] = useState(true)
  const [presets, setPresets] = useState([] as SessionPreset[])
  const [model, setModel] = useState<string>("")
  const [maxTurns, setMaxTurns] = useState<number>(1)

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

  const activeSkillList = useMemo(() => Array.from(activeSkillIds), [activeSkillIds])
  const activeSkillsPreview = useMemo(() => {
    const names = activeSkillList
      .map((id) => skills.find((s) => s.id === id)?.name || id)
      .slice(0, 3)
    const suffix = activeSkillList.length > 3 ? ` +${activeSkillList.length - 3}` : ""
    return names.join(", ") + suffix
  }, [activeSkillList, skills])

  async function refreshAgents() {
    const list = await skillManagementApi.listAgents()
    setAgents(list)
    if (!agentId && list.length) setAgentId(list[0].id)
  }

  async function refreshSkills(q?: string) {
    const list = await skillManagementApi.listSkills(q)
    setSkills(list)
    if (list.length && expandedSkills.size === 0) {
      const first = list[0].id
      setExpandedSkills(new Set([first]))
      try {
        await ensureSkillTreeLoaded(first)
      } catch {
        // ignore
      }
    }
  }

  async function refreshPromptVersions(nextAgentId: string) {
    const list = await skillManagementApi.listPromptVersions(nextAgentId)
    setPromptVersions(list)
    if (list.length && !list.find((v) => v.version === promptVersion)) {
      setPromptVersion(list[0].version)
    }
    if (!list.length) {
      setPromptVersion("")
      setPromptDetail(null)
      setPromptDraft("")
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        setPresets(safeLoadPresets())
        await Promise.all([refreshAgents(), refreshSkills()])
      } catch (e: any) {
        setError(e?.message || "初始化失败")
      }
    })()
  }, [])

  useEffect(() => {
    if (!agentId) return
    ;(async () => {
      try {
        await refreshPromptVersions(agentId)
      } catch (e: any) {
        setError(e?.message || "加载 Prompt 版本失败")
      }
    })()
  }, [agentId])

  useEffect(() => {
    if (!agentId || !promptVersion) return
    ;(async () => {
      try {
        const detail = await skillManagementApi.getPromptVersion(agentId, promptVersion)
        setPromptDetail(detail)
        setPromptDraft(detail.content)
        setActiveSkillIds(new Set(detail.active_skill_ids || []))
      } catch (e: any) {
        setPromptDetail(null)
        setPromptDraft("")
        setError(e?.message || "加载 Prompt 失败")
      }
    })()
  }, [agentId, promptVersion])

  useEffect(() => {
    if (presets.length === 0) return
    safeSavePresets(presets)
  }, [presets])

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
      setError(e?.message || "读取文件失败")
    }
  }

  async function savePrompt() {
    if (!agentId || !promptVersion) return
    setPromptSaving(true)
    setError("")
    try {
      const updated = await skillManagementApi.updatePromptVersion(agentId, promptVersion, {
        content: promptDraft,
        active_skill_ids: activeSkillList,
      })
      setPromptDetail(updated)
    } catch (e: any) {
      setError(e?.message || "保存 Prompt 失败")
    } finally {
      setPromptSaving(false)
    }
  }

  async function createNewPromptVersion() {
    if (!agentId) return
    const version = window.prompt("新 Prompt 版本号（仅字母/数字/._-）", `v${promptVersions.length + 1}`)
    if (!version) return
    setPromptSaving(true)
    setError("")
    try {
      const created = await skillManagementApi.createPromptVersion(agentId, {
        version,
        lang: "zh-CN",
        content: promptDraft || "",
        active_skill_ids: activeSkillList,
      })
      await refreshPromptVersions(agentId)
      setPromptVersion(created.version)
    } catch (e: any) {
      setError(e?.message || "创建版本失败")
    } finally {
      setPromptSaving(false)
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
    } catch (e: any) {
      setError(e?.message || "保存文件失败")
    } finally {
      setFileSaving(false)
    }
  }

  async function run() {
    if (!agentId || !promptVersion || !input.trim()) return
    setRunning(true)
    setError("")
    const userMessage = input.trim()
    setMessages((prev) => [...prev, { role: "user", content: userMessage, createdAt: Date.now() }])
    setInput("")
    try {
      const resp = await skillManagementApi.runPlayground({
        agent_id: agentId,
        prompt_version: promptVersion,
        // Server uses the prompt-version bound active skills; keep request minimal.
        skill_ids: [],
        message: userMessage,
        model: model || undefined,
        max_turns: maxTurns,
      })
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: resp.output || "(empty)", createdAt: Date.now() },
      ])
    } catch (e: any) {
      setError(e?.message || "运行失败")
    } finally {
      setRunning(false)
    }
  }

  const promptDirty = (promptDetail?.content ?? "") !== promptDraft
  const chatBottomId = "skill-management-chat-bottom"

  useEffect(() => {
    if (!autoScroll) return
    const el = document.getElementById(chatBottomId)
    el?.scrollIntoView({ block: "end" })
  }, [autoScroll, chatBottomId, messages.length, running])

  const formatTime = (ts: number) => {
    try {
      return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(ts)
    } catch {
      return ""
    }
  }

  return (
    <div className="h-[calc(100vh-4.5rem)]">
      <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border bg-background">
        {/* Left: Explorer */}
        <ResizablePanel defaultSize={22} minSize={16}>
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b">
              <div className="font-medium text-sm">Explorer</div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                  placeholder="搜索 skills..."
                  className="h-8"
                />
                <Badge variant="secondary" className="h-8 px-2 text-xs flex items-center">
                  {activeSkillList.length}
                </Badge>
              </div>
              {activeSkillList.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeSkillList.slice(0, 6).map((id) => (
                    <Badge key={id} variant="secondary" className="text-[11px] pr-1">
                      <span className="mr-1">{id}</span>
                      <button
                        className="rounded-sm hover:bg-muted px-1"
                        title="停用"
                        onClick={async () => {
                          if (!agentId || !promptVersion) {
                            setError("请先在 Prompt 中选择/创建版本，再绑定技能。")
                            setPromptSheetOpen(true)
                            return
                          }
                          const next = new Set(activeSkillIds)
                          next.delete(id)
                          setActiveSkillIds(next)
                          try {
                            const updated = await skillManagementApi.updatePromptVersion(agentId, promptVersion, {
                              active_skill_ids: Array.from(next),
                            })
                            setPromptDetail(updated)
                          } catch (e: any) {
                            setError(e?.message || "解绑技能失败")
                          }
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {activeSkillList.length > 6 && (
                    <Badge variant="secondary" className="text-[11px]">
                      +{activeSkillList.length - 6}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredSkills.map((s) => {
                  const tree = skillTrees[s.id]
                  const expanded = expandedSkills.has(s.id)
                  const isActive = activeSkillIds.has(s.id)
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
                            setError(e?.message || "加载技能文件树失败")
                          }
                        } else {
                          next.delete(s.id)
                        }
                        setExpandedSkills(next)
                      }}
                      isActiveSkill={isActive}
                      onToggleActive={async (nextChecked) => {
                        if (!agentId || !promptVersion) {
                          setError("请先在 Prompt 中选择/创建版本，再绑定技能。")
                          setPromptSheetOpen(true)
                          return
                        }
                        const next = new Set(activeSkillIds)
                        if (nextChecked) next.add(s.id)
                        else next.delete(s.id)
                        setActiveSkillIds(next)
                        setError("")
                        try {
                          const updated = await skillManagementApi.updatePromptVersion(agentId, promptVersion, {
                            active_skill_ids: Array.from(next),
                          })
                          setPromptDetail(updated)
                        } catch (e: any) {
                          setError(e?.message || "绑定技能失败")
                        }
                      }}
                      expandedNodes={expandedTreeNodes}
                      setExpandedNodes={setExpandedTreeNodes}
                      activeFile={activeFile}
                      onOpenFile={(path) => openFile(s.id, path)}
                    />
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center: Editor */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm">Editor</div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {activeFile ? `${activeFile.skillId}/${activeFile.path}` : "选择左侧文件开始编辑"}
                </div>
              </div>
              <Button size="sm" onClick={saveFile} disabled={!activeFile || fileIsBinary || fileSaving}>
                {fileSaving ? "保存中..." : "保存"}
              </Button>
            </div>

            <div className="flex-1 p-3">
              {!activeFile ? (
                <div className="text-sm text-muted-foreground">从左侧选择一个文件开始。</div>
              ) : fileIsBinary ? (
                <div className="text-sm text-muted-foreground">二进制文件暂不支持在线编辑。</div>
              ) : (
                <Textarea
                  value={fileDraft}
                  onChange={(e) => setFileDraft(e.target.value)}
                  className="h-full font-mono text-xs leading-5 resize-none"
                />
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Session / Debug */}
        <ResizablePanel defaultSize={28} minSize={22}>
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b flex items-center justify-between gap-2 bg-gradient-to-b from-muted/40 to-background">
              <div className="min-w-0">
                <div className="font-medium text-sm">Session</div>
                <div className="text-xs text-muted-foreground truncate">
                  {agentId ? `${agentId} · ${promptVersion || "-"}` : "未选择 Agent"}
                </div>
                {activeSkillList.length > 0 && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    Skills: {activeSkillsPreview}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>会话配置</DropdownMenuLabel>
                    <div className="px-2 py-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">Auto-scroll</div>
                        <input
                          type="checkbox"
                          checked={autoScroll}
                          onChange={(e) => setAutoScroll(e.target.checked)}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Model（可选）</div>
                        <Input
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          placeholder="例如：claude-sonnet-4-20250514"
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Max turns</div>
                        <Input
                          value={String(maxTurns)}
                          onChange={(e) => setMaxTurns(Math.max(1, Number(e.target.value || 1)))}
                          className="h-8"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        const name = window.prompt(
                          "保存为预设名称（会保存 Agent + Prompt 版本 + 激活技能集合）",
                          `${agentId || "agent"}:${promptVersion || "v"}:${activeSkillList.length}skills`
                        )
                        if (!name) return
                        const next: SessionPreset[] = [
                          { name, agentId, promptVersion, skillIds: activeSkillList, updatedAt: Date.now() },
                          ...presets.filter((p) => p.name !== name),
                        ].slice(0, 20)
                        setPresets(next)
                      }}
                    >
                      <BookmarkPlus className="h-4 w-4 mr-2" />
                      保存当前为预设
                    </DropdownMenuItem>
                    {presets.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>预设</DropdownMenuLabel>
                        {presets.slice(0, 8).map((p) => (
                          <DropdownMenuItem
                            key={p.name}
                            onClick={async () => {
                              setAgentId(p.agentId)
                              setPromptVersion(p.promptVersion)
                              setActiveSkillIds(new Set(p.skillIds))
                              const nextExpanded = new Set(expandedSkills)
                              for (const id of p.skillIds) {
                                nextExpanded.add(id)
                                try {
                                  await ensureSkillTreeLoaded(id)
                                } catch {
                                  // ignore
                                }
                              }
                              setExpandedSkills(nextExpanded)
                              if (p.agentId && p.promptVersion) {
                                try {
                                  const updated = await skillManagementApi.updatePromptVersion(
                                    p.agentId,
                                    p.promptVersion,
                                    { active_skill_ids: p.skillIds }
                                  )
                                  setPromptDetail(updated)
                                } catch {
                                  // ignore
                                }
                              }
                            }}
                          >
                            <span className="truncate">{p.name}</span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (!window.confirm("清空所有预设？")) return
                            setPresets([])
                            safeSavePresets([])
                          }}
                        >
                          清空预设
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setMessages([])}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                <Sheet open={promptSheetOpen} onOpenChange={setPromptSheetOpen}>
                  <SheetTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Settings2 className="h-4 w-4 mr-2" />
                      Prompt
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[720px] sm:max-w-none">
                    <SheetHeader>
                      <SheetTitle>Agent Prompt 配置</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">Agent</div>
                        <select
                          value={agentId}
                          onChange={(e) => setAgentId(e.target.value)}
                          className="h-8 rounded-md border bg-background px-2 text-sm"
                        >
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.id}
                            </option>
                          ))}
                        </select>
                        <div className="flex-1" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={createNewPromptVersion}
                          disabled={!agentId || promptSaving}
                        >
                          新建版本
                        </Button>
                        <Button size="sm" onClick={savePrompt} disabled={!promptDirty || promptSaving}>
                          {promptSaving ? "保存中..." : "保存"}
                        </Button>
                      </div>

                      {promptVersions.length > 0 && (
                        <Tabs value={promptVersion} onValueChange={setPromptVersion}>
                          <TabsList className="h-8">
                            {promptVersions.slice(0, 10).map((v) => (
                              <TabsTrigger key={v.version} value={v.version} className="text-xs">
                                {v.version}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </Tabs>
                      )}

                      <div className="text-xs text-muted-foreground">提示词（版本：{promptVersion || "-"}）</div>
                      <Textarea
                        value={promptDraft}
                        onChange={(e) => setPromptDraft(e.target.value)}
                        className="h-[60vh] font-mono text-xs leading-5 resize-none"
                        placeholder='<agent id="huiFa" version="2.0" lang="zh-CN">...'
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            <ScrollArea
              className="flex-1 bg-muted/20"
              onWheel={() => setAutoScroll(false)}
              onTouchMove={() => setAutoScroll(false)}
            >
              <div className="p-4 space-y-4">
                {messages.length === 0 ? (
                  <Card className="p-4 bg-background/60">
                    <div className="text-sm font-medium mb-1">开始调试</div>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <div>1) 在左侧勾选需要注册的 Skills（可多选）</div>
                      <div>2) 点击右上角 Prompt 配置，选择/新建 Prompt 版本并保存</div>
                      <div>3) 在底部输入消息，开始对话调试</div>
                    </div>
                  </Card>
                ) : (
                  messages.map((m, idx) => {
                    const isUser = m.role === "user"
                    const skillTypes = !isUser ? extractSkillOutputTypes(m.content) : []
                    return (
                      <div
                        key={idx}
                        className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}
                      >
                        {!isUser && (
                          <Avatar className="h-7 w-7 mt-1">
                            <AvatarFallback className="text-xs">A</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("max-w-[86%] space-y-1", isUser ? "items-end" : "items-start")}>
                          {!isUser && skillTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {skillTypes.map((t) => (
                                <Badge key={t} variant="secondary" className="text-[11px]">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div
                            className={cn(
                              "rounded-2xl px-3 py-2 shadow-sm border text-sm",
                              isUser
                                ? "bg-primary text-primary-foreground border-primary/20"
                                : "bg-background border-border/70"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className={cn("min-w-0", isUser ? "text-primary-foreground" : "text-foreground")}>
                                {isUser ? (
                                  <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
                                ) : (
                                  <MarkdownMessage content={m.content} />
                                )}
                              </div>
                              <div className="shrink-0 mt-0.5">
                                <CopyIconButton value={m.content} label="复制消息" />
                              </div>
                            </div>
                          </div>
                          <div className={cn("text-[11px] text-muted-foreground", isUser ? "text-right" : "text-left")}>
                            {formatTime(m.createdAt)}
                          </div>
                        </div>
                        {isUser && (
                          <Avatar className="h-7 w-7 mt-1">
                            <AvatarFallback className="text-xs">我</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )
                  })
                )}

                {running && (
                  <div className="flex gap-2 justify-start">
                    <Avatar className="h-7 w-7 mt-1">
                      <AvatarFallback className="text-xs">A</AvatarFallback>
                    </Avatar>
                    <div className="max-w-[86%]">
                      <div className="rounded-2xl px-3 py-2 shadow-sm border bg-background text-sm text-muted-foreground">
                        正在思考...
                      </div>
                    </div>
                  </div>
                )}

                <div id={chatBottomId} />
              </div>
            </ScrollArea>

              <div className="border-t p-3 space-y-2">
              {activeSkillList.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {activeSkillList.slice(0, 6).map((id) => (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {id}
                    </Badge>
                  ))}
                  {activeSkillList.length > 6 && (
                    <Badge variant="secondary" className="text-xs">
                      +{activeSkillList.length - 6}
                    </Badge>
                  )}
                </div>
              )}
              {!promptVersion && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                  还没有 Prompt 版本：点击右上角 Prompt 新建并保存。
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="对方叫张三，欠了我5万..."
                    className="min-h-[64px] resize-none bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        run()
                        setAutoScroll(true)
                      }
                    }}
                    onFocus={() => setAutoScroll(true)}
                  />
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Enter 发送 · Shift+Enter 换行
                  </div>
                </div>
                <Button
                  onClick={run}
                  disabled={running || !agentId || !promptVersion || !input.trim()}
                  className="h-auto"
                >
                  {running ? "运行中..." : "发送"}
                </Button>
              </div>
              {error && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1">
                  {error}
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
