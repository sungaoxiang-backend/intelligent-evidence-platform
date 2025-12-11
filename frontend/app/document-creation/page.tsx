"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { TemplateSelector } from "@/components/document-creation/template-selector"
import { DocumentEditor } from "@/components/documents/document-editor"
import { DocumentPreview } from "@/components/documents/document-preview"
import { EvidenceCardsList } from "@/components/document-generation/evidence-cards-list"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { caseApi } from "@/lib/api"
import useSWR from "swr"
import type { Case } from "@/lib/types"
import {
  documentsApi,
  documentDraftsApi,
  documentCreationApi,
  type Document
} from "@/lib/documents-api"
import type { JSONContent } from "@tiptap/core"
import { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import TextStyle from "@tiptap/extension-text-style"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Color from "@tiptap/extension-color"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import HardBreak from "@tiptap/extension-hard-break"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
  templateBaseStyles,
} from "@/components/template-editor/extensions"
import { createDocumentExtensions } from "@/components/documents/document-extensions"
import { normalizeContent } from "@/components/template-editor/utils"
import { cn } from "@/lib/utils"

type ViewMode = "edit" | "preview"

export default function DocumentCreationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedCaseId, setSelectedCaseId] = useState<number | undefined>()
  const [selectedTemplate, setSelectedTemplate] = useState<Document | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("edit")
  const [draftContent, setDraftContent] = useState<JSONContent | null>(null)
  const [savedDraftContent, setSavedDraftContent] = useState<JSONContent | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [cases, setCases] = useState<Case[]>([])
  const { toast } = useToast()

  // Layout state management
  const [pageLayout, setPageLayout] = useState({
    margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
    lineSpacing: 1.5
  })
  const [savedPageLayout, setSavedPageLayout] = useState({
    margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
    lineSpacing: 1.5
  })

  // 获取案件列表
  useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await caseApi.getCases({
          page: 1,
          pageSize: 100,
        })
        setCases(response.data || [])
      } catch (error) {
        console.error("Failed to load cases:", error)
        setCases([])
      }
    }
    loadCases()
  }, [])

  // 从URL参数读取caseId并自动选择案件
  useEffect(() => {
    const caseIdParam = searchParams.get('caseId')
    if (caseIdParam) {
      const caseId = Number(caseIdParam)
      if (!isNaN(caseId) && caseId > 0) {
        if (cases.length > 0) {
          const caseExists = cases.some(c => c.id === caseId)
          if (caseExists) {
            setSelectedCaseId(caseId)
          }
        } else if (cases.length === 0) {
          setSelectedCaseId(caseId)
        }
      }
    }
  }, [searchParams, cases])

  // 获取选中的案件详情
  const caseFetcher = async ([_key, caseId]: [string, number]) => {
    const response = await caseApi.getCaseById(caseId)
    return response.data
  }

  const { data: caseData } = useSWR(
    selectedCaseId ? ['/api/case', selectedCaseId] : null,
    caseFetcher,
    {
      revalidateOnFocus: false,
    }
  )

  const getCaseDisplayName = (caseItem: Case) => {
    if (caseItem.creditor_name && caseItem.debtor_name) {
      return `${caseItem.creditor_name} vs ${caseItem.debtor_name}`
    }
    if (caseItem.description) {
      return caseItem.description
    }
    return `案件 #${caseItem.id}`
  }

  const getCaseCause = (caseItem: Case) => {
    return caseItem.case_type === 'debt' ? '民间借贷纠纷' :
      caseItem.case_type === 'contract' ? '买卖合同纠纷' :
        caseItem.case_type || "未设置"
  }

  // 深拷贝函数
  const deepCopy = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj))
  }

  // 加载草稿
  const loadDraft = useCallback(async () => {
    if (!selectedCaseId || !selectedTemplate) {
      console.log("[loadDraft] 缺少必要参数，selectedCaseId:", selectedCaseId, "selectedTemplate:", selectedTemplate?.id)
      return
    }

    console.log("[loadDraft] 开始加载草稿，caseId:", selectedCaseId, "templateId:", selectedTemplate.id)
    try {
      // 先尝试加载草稿
      const response = await documentDraftsApi.getDraft(selectedCaseId, selectedTemplate.id)
      console.log("[loadDraft] API 响应:", response)
      if (response.data) {
        // 如果草稿有 content_json，使用它
        if (response.data.content_json) {
          setDraftContent(deepCopy(response.data.content_json))
          setSavedDraftContent(deepCopy(response.data.content_json))
          setHasChanges(false)

          // 加载页面布局设置
          if (response.data.page_layout) {
            console.log("[loadDraft] 从草稿加载页面布局:", response.data.page_layout)
            setPageLayout(deepCopy(response.data.page_layout))
            setSavedPageLayout(deepCopy(response.data.page_layout))
          } else {
            // 如果没有保存的布局，尝试使用模板的布局，否则使用默认值
            const templateLayout = selectedTemplate.page_layout || null
            const defaultLayout = {
              margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
              lineSpacing: 1.5
            }
            const layoutToUse = templateLayout || defaultLayout
            console.log("[loadDraft] 使用模板或默认布局:", layoutToUse)
            setPageLayout(deepCopy(layoutToUse))
            setSavedPageLayout(deepCopy(layoutToUse))
          }

          toast({
            title: "已加载草稿",
            description: "已自动加载之前保存的草稿",
          })
          return
        }
        // 向后兼容：如果只有 form_data，从模板重新生成（这种情况应该很少见）
        else if (response.data.form_data) {
          // 使用模板的 content_json 作为基础
          const templateContent = deepCopy(selectedTemplate.content_json)
          setDraftContent(templateContent)
          setSavedDraftContent(templateContent)
          setHasChanges(false)
          toast({
            title: "已加载草稿",
            description: "已自动加载之前保存的草稿（已迁移到新格式）",
          })
          return
        }
      }
    } catch (error) {
      // 草稿不存在是正常的，不显示错误
      console.log("[loadDraft] 捕获错误:", error)
      if (error instanceof Error) {
        const isNotFound = error.message.includes("404") || error.message.includes("草稿不存在")
        if (isNotFound) {
          console.log("[loadDraft] 404 错误（草稿不存在），这是正常情况，继续从模板加载")
        } else {
          console.error("[loadDraft] 加载草稿失败:", error)
        }
      }
    }

    // 如果没有草稿，从模板深拷贝 content_json
    console.log("[loadDraft] 从模板加载内容，template.content_json 存在:", !!selectedTemplate.content_json)
    if (selectedTemplate.content_json) {
      const templateContent = deepCopy(selectedTemplate.content_json)
      setDraftContent(templateContent)
      setSavedDraftContent(templateContent)
      setHasChanges(false)

      // 加载模板的页面布局设置（如果有）
      const templateLayout = selectedTemplate.page_layout || null
      const defaultLayout = {
        margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
        lineSpacing: 1.5
      }
      const layoutToUse = templateLayout || defaultLayout
      console.log("[loadDraft] 从模板加载页面布局:", layoutToUse)
      setPageLayout(deepCopy(layoutToUse))
      setSavedPageLayout(deepCopy(layoutToUse))

      console.log("[loadDraft] 已从模板加载内容")
    } else {
      console.warn("[loadDraft] 模板没有 content_json，设置为空内容")
      setDraftContent({ type: "doc", content: [] })
      setSavedDraftContent({ type: "doc", content: [] })
      const defaultLayout = {
        margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
        lineSpacing: 1.5
      }
      setPageLayout(defaultLayout)
      setSavedPageLayout(defaultLayout)
      setHasChanges(false)
    }
  }, [selectedCaseId, selectedTemplate, toast])

  // 选择模板后进入编辑模式
  const handleTemplateSelect = async (template: Document) => {
    console.log("[handleTemplateSelect] 被调用，模板ID:", template.id, "当前模板ID:", selectedTemplate?.id)

    // 如果选择的是同一个模板，不需要切换
    if (selectedTemplate?.id === template.id) {
      console.log("[handleTemplateSelect] 选择的是同一个模板，跳过")
      return
    }

    // 如果有未保存的变更，提示用户
    if (hasChanges) {
      const confirmed = window.confirm("您有未保存的变更，确定要切换模板吗？切换后当前未保存的变更将丢失。")
      if (!confirmed) {
        console.log("[handleTemplateSelect] 用户取消切换")
        return // 用户取消，不切换模板
      }
    }

    console.log("[handleTemplateSelect] 开始切换模板，重置状态")
    // 切换模板：重置状态并加载新模板
    // 先重置状态，避免旧模板的内容闪烁
    setDraftContent(null)
    setSavedDraftContent(null)
    const defaultLayout = {
      margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
      lineSpacing: 1.5
    }
    setPageLayout(defaultLayout)
    setSavedPageLayout(defaultLayout)
    setHasChanges(false)
    setSelectedTemplate(template)
    setViewMode("edit")
    console.log("[handleTemplateSelect] 模板切换完成，新模板ID:", template.id)
    // loadDraft 会在 useEffect 中自动调用
  }

  // 当案件和模板都选择后，自动加载草稿
  useEffect(() => {
    if (selectedCaseId && selectedTemplate) {
      loadDraft()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId, selectedTemplate?.id])

  // 处理内容变更（来自 DocumentEditor 的所有编辑操作）
  const handleContentChange = useCallback((json: JSONContent) => {
    setDraftContent(json)
  }, [])

  // 处理页面布局变化
  const handlePageLayoutChange = useCallback((layout: typeof pageLayout) => {
    console.log("[handlePageLayoutChange] 页面布局变更:", layout)
    setPageLayout(layout)
  }, [])

  // 使用 useRef 来存储防抖定时器，以便在保存时清除
  const changeDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 检测内容变化（使用防抖，避免过于频繁的比较）
  // 这个效果会在 draftContent 或 savedDraftContent 变化时触发
  // DocumentEditor 的所有编辑操作（包括表格拖动、内容变更、新增行或列等）都会通过 onChange 更新 draftContent
  useEffect(() => {
    if (!draftContent || !savedDraftContent) {
      setHasChanges(false)
      return
    }

    // 清除之前的定时器
    if (changeDetectionTimeoutRef.current) {
      clearTimeout(changeDetectionTimeoutRef.current)
    }

    // 使用防抖来优化性能，避免每次变更都立即比较
    // 这对于频繁的编辑操作（如拖动表格、连续输入等）特别重要
    changeDetectionTimeoutRef.current = setTimeout(() => {
      // 深度比较两个 JSON 对象是否相等
      // 使用 JSON.stringify 进行快速比较
      // 注意：这能捕获所有类型的变更，包括：
      // - 文本内容变更
      // - 格式变更（字体、颜色、对齐等）
      // - 表格结构变更（新增/删除行或列、合并/拆分单元格、列宽调整等）
      // - 段落和标题变更
      // - 所有其他 ProseMirror 节点变更
      try {
        // 规范化内容后再比较，确保比较的一致性
        const currentNormalized = normalizeContent(draftContent)
        const savedNormalized = normalizeContent(savedDraftContent)
        const currentStr = JSON.stringify(currentNormalized)
        const savedStr = JSON.stringify(savedNormalized)
        const contentHasChanges = currentStr !== savedStr

        // 同时检查页面布局是否有变更
        // 使用深度比较，确保能检测到嵌套对象的变化
        const currentLayoutStr = JSON.stringify(pageLayout)
        const savedLayoutStr = JSON.stringify(savedPageLayout)
        const layoutHasChanges = currentLayoutStr !== savedLayoutStr

        if (layoutHasChanges) {
          console.log("[变更检测] 页面布局有变更:", {
            current: pageLayout,
            saved: savedPageLayout,
            currentStr: currentLayoutStr,
            savedStr: savedLayoutStr
          })
        }

        const hasAnyChanges = contentHasChanges || layoutHasChanges
        setHasChanges(hasAnyChanges)
        changeDetectionTimeoutRef.current = null
      } catch (error) {
        // 如果序列化失败，保守地认为有变更
        console.warn("Failed to compare content:", error)
        setHasChanges(true)
        changeDetectionTimeoutRef.current = null
      }
    }, 300) // 300ms 防抖延迟，平衡响应速度和性能

    return () => {
      if (changeDetectionTimeoutRef.current) {
        clearTimeout(changeDetectionTimeoutRef.current)
        changeDetectionTimeoutRef.current = null
      }
    }
  }, [draftContent, savedDraftContent, pageLayout, savedPageLayout])

  // 离开页面保护：当有未保存的变更时，提示用户
  useEffect(() => {
    if (!hasChanges) return

    // 浏览器离开页面保护（刷新、关闭标签页等）
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // 现代浏览器会忽略自定义消息，但设置 returnValue 是必需的
      e.returnValue = "您有未保存的变更，确定要离开吗？"
      return "您有未保存的变更，确定要离开吗？"
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [hasChanges])

  // Next.js 路由离开保护（页面内路由跳转）
  // 注意：Next.js App Router 使用 useRouter，但路由拦截需要在导航组件中处理
  // 这里我们通过拦截浏览器后退按钮来提供基本保护
  useEffect(() => {
    if (!hasChanges) return

    // 拦截浏览器后退按钮
    const handlePopState = (e: PopStateEvent) => {
      if (hasChanges) {
        const confirmed = window.confirm("您有未保存的变更，确定要离开吗？")
        if (!confirmed) {
          // 阻止导航，恢复当前状态
          window.history.pushState(null, "", window.location.href)
        }
      }
    }

    // 在历史记录中添加一个状态，以便拦截后退
    window.history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [hasChanges])

  // 保存草稿
  // 这个函数会在用户点击"保存"按钮时调用
  // DocumentEditor 工具栏中的保存按钮会调用这个函数
  const handleSaveDraft = useCallback(async () => {
    if (!selectedCaseId || !selectedTemplate || !draftContent) {
      toast({
        title: "保存失败",
        description: "请先选择案件和模板",
        variant: "destructive",
      })
      return
    }

    // 如果没有变更，不需要保存
    if (!hasChanges) {
      toast({
        title: "提示",
        description: "没有需要保存的变更",
      })
      return
    }

    try {
      setIsSaving(true)
      console.log("[handleSaveDraft] 保存草稿，包含页面布局:", pageLayout)

      // 清除变更检测的防抖定时器，避免保存后立即重新检测导致 hasChanges 被设置为 true
      if (changeDetectionTimeoutRef.current) {
        clearTimeout(changeDetectionTimeoutRef.current)
        changeDetectionTimeoutRef.current = null
      }

      await documentDraftsApi.createOrUpdateDraft({
        case_id: selectedCaseId,
        document_id: selectedTemplate.id,
        content_json: draftContent,
        page_layout: pageLayout,
      })

      // 更新已保存的内容和布局，用于后续的变更检测
      // 使用函数式更新确保使用最新的值
      setSavedDraftContent(deepCopy(draftContent))
      setSavedPageLayout(deepCopy(pageLayout))

      // 立即设置 hasChanges 为 false，避免防抖延迟导致的问题
      setHasChanges(false)
      console.log("[handleSaveDraft] 保存成功，已更新 savedPageLayout 并清除变更检测定时器")

      toast({
        title: "保存成功",
        description: "草稿已保存",
      })
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "保存草稿失败",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [selectedCaseId, selectedTemplate, draftContent, hasChanges, toast])

  // 下载文档
  const handleDownload = async () => {
    if (!selectedCaseId || !selectedTemplate || !draftContent) return

    try {
      setIsLoading(true)

      // 使用与预览完全相同的扩展配置和渲染逻辑
      // 使用与预览和编辑器完全相同的扩展配置
      const extensions = createDocumentExtensions({
        resizable: false, // 导出时不需要调整大小功能
        allowTableNodeSelection: false,
      })

      // 创建临时编辑器实例，使用与预览相同的配置
      const normalizedContent = normalizeContent(draftContent)
      const tempEditor = new Editor({
        extensions,
        content: normalizedContent || { type: "doc", content: [] },
      })

      // 使用 editor.getHTML() 生成 HTML
      const htmlContent = tempEditor.getHTML()

      // 清理临时编辑器
      tempEditor.destroy()

      // 将 HTML 内容包装在完整的 HTML 文档中，并注入 CSS 样式
      const mmToPx = (mm: number) => mm * 3.7795
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${selectedTemplate.name}</title>
  <style>
    ${templateBaseStyles}
    /* PDF 导出专用样式优化 */
    body {
      margin: 0;
      padding: 0;
      background: white;
    }
    /* 应用当前布局设置 - PDF导出时使用Playwright的margin，HTML内容填满页面 */
    .template-doc-container {
      --page-margin-top: ${mmToPx(pageLayout.margins.top)}px;
      --page-margin-bottom: ${mmToPx(pageLayout.margins.bottom)}px;
      --page-margin-left: ${mmToPx(pageLayout.margins.left)}px;
      --page-margin-right: ${mmToPx(pageLayout.margins.right)}px;
      --content-line-height: ${pageLayout.lineSpacing};
      box-shadow: none !important;
      /* PDF导出时：容器填满整个页面，Playwright会在PDF页面周围添加margin */
      padding: 0 !important;
      margin: 0 !important;
      width: 794px; /* A4页面宽度 */
      min-height: auto;
    }
    .template-doc {
      line-height: var(--content-line-height) !important;
      /* 内容区域宽度 = 页面宽度 - 左右边距，内容居中 */
      width: ${794 - mmToPx(pageLayout.margins.left) - mmToPx(pageLayout.margins.right)}px;
      max-width: 100%;
      margin: 0 auto; /* 内容居中 */
      padding: 0;
      /* 关键修复：允许内容溢出容器，防止旋转图片被裁剪 */
      overflow: visible !important;
      /* 增加底部内边距，确保文档底部的旋转元素有足够的空间显示 */
      padding-bottom: 200px !important; 
    }
    .template-doc p {
      line-height: var(--content-line-height) !important;
    }
    .template-doc h1,
    .template-doc h2,
    .template-doc h3,
    .template-doc h4,
    .template-doc h5,
    .template-doc h6 {
      line-height: var(--content-line-height) !important;
    }
  </style>
</head>
<body>
  <div class="template-doc-container">
    <div class="template-doc">
      ${htmlContent}
    </div>
  </div>
</body>
</html>`

      // 导出 PDF
      const filename = `${selectedTemplate.name}_${new Date().toISOString().split('T')[0]}.pdf`
      const blob = await documentCreationApi.exportDocumentToPdf({
        html_content: fullHtml,
        filename,
        margin_top: pageLayout.margins.top,
        margin_bottom: pageLayout.margins.bottom,
        margin_left: pageLayout.margins.left,
        margin_right: pageLayout.margins.right,
        line_spacing: pageLayout.lineSpacing,
      })

      // 下载文件
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "下载成功",
        description: "文档已下载",
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: error instanceof Error ? error.message : "下载文档失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 取消编辑（清空模板选择，不保存变更）
  const handleCancel = useCallback(() => {
    // 如果有未保存的变更，提示用户
    if (hasChanges) {
      // 可以选择提示用户，或者直接取消
      // 这里直接取消，不保存变更
    }
    setSelectedTemplate(null)
    setDraftContent(null)
    setSavedDraftContent(null)
    setHasChanges(false)
    // 不再需要设置 viewMode，因为模板列表常驻显示
  }, [hasChanges])

  // 切换到预览模式
  const handlePreview = () => {
    setViewMode("preview")
  }

  // 切换到编辑模式
  const handleEdit = () => {
    setViewMode("edit")
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">
      {/* 左侧：案件信息 + 证据卡片列表 (25%) */}
      <div className="w-1/4 border-r bg-background flex flex-col flex-shrink-0">
        {/* 案件信息标题栏 */}
        <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
          <h3 className="text-sm font-semibold text-foreground">案件信息</h3>
        </div>
        {/* 案件选择器 */}
        <div className="px-3 py-2 border-b bg-background flex-shrink-0">
          <Select
            value={selectedCaseId?.toString() || ""}
            onValueChange={(value) => {
              const newCaseId = Number(value)
              setSelectedCaseId(newCaseId)
              // 切换案件时重置模板和草稿
              setSelectedTemplate(null)
              setDraftContent(null)
              setSavedDraftContent(null)
              setHasChanges(false)
              // 不再需要设置 viewMode，因为模板列表常驻显示
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="选择案件" />
            </SelectTrigger>
            <SelectContent>
              {cases.map((caseItem) => (
                <SelectItem key={caseItem.id} value={caseItem.id.toString()}>
                  {getCaseDisplayName(caseItem)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* 紧凑的案件基本信息 */}
        {selectedCaseId && caseData ? (
          <div className="p-3 border-b bg-background flex-shrink-0">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <label className="text-[10px] text-muted-foreground">案件ID</label>
                <div className="text-xs font-semibold text-foreground">#{caseData.id}</div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">案由</label>
                <div className="text-xs font-medium text-foreground truncate">{getCaseCause(caseData)}</div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">关联用户</label>
                <div className="text-xs font-medium text-foreground truncate">
                  {caseData.user?.name || 'N/A'}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">欠款金额</label>
                <div className="text-xs font-semibold text-destructive">
                  {caseData.loan_amount !== null && caseData.loan_amount !== undefined
                    ? `¥${caseData.loan_amount.toLocaleString()}`
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 border-b bg-background flex-shrink-0">
            <div className="text-xs text-muted-foreground text-center py-2">
              请选择案件查看详情
            </div>
          </div>
        )}

        {/* 证据卡片列表 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
            <h4 className="text-sm font-semibold text-foreground">证据卡片</h4>
          </div>
          <div className="flex-1 overflow-hidden p-3">
            {selectedCaseId ? (
              <EvidenceCardsList caseId={selectedCaseId} className="h-full" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs text-center px-2">
                请先选择案件
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 中间：模板列表 (25%) */}
      <div className="w-1/4 border-r bg-background flex flex-col flex-shrink-0">
        <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground">模板列表</h2>
        </div>
        {selectedCaseId ? (
          <div className="flex-1 overflow-y-auto p-3">
            <TemplateSelector
              selectedTemplateId={selectedTemplate?.id}
              onSelectTemplate={handleTemplateSelect}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center px-3">
              <p className="text-sm font-medium mb-1">请先选择案件</p>
              <p className="text-xs">选择案件后，将显示模板列表</p>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：预览编辑区域 (50%) */}
      <div className={cn(selectedCaseId ? "w-1/2" : "flex-1", "flex flex-col bg-background")}>
        {!selectedCaseId ? (
          <>
            <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">文档编辑</h2>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-sm font-medium mb-1">请先选择案件</p>
                <p className="text-xs">选择案件后，将显示模板列表和编辑区域</p>
              </div>
            </div>
          </>
        ) : !selectedTemplate ? (
          <>
            <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">文档编辑</h2>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-sm font-medium mb-1">请选择模板</p>
                <p className="text-xs">从左侧模板列表中选择一个模板开始编辑</p>
              </div>
            </div>
          </>
        ) : viewMode === "edit" ? (
          <DocumentEditor
            key={`editor-${selectedTemplate.id}-${selectedCaseId}`}
            initialContent={draftContent}
            onChange={handleContentChange}
            onSave={handleSaveDraft}
            onCancel={handleCancel}
            onExport={handleDownload}
            isSaving={isSaving}
            isDownloading={isLoading}
            canSave={hasChanges && !isSaving}
            canExport={!hasChanges && !isLoading}
            placeholderMetadata={selectedTemplate?.placeholder_metadata}
            initialPageLayout={pageLayout}
            onPageLayoutChange={handlePageLayoutChange}
          />
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">文档预览</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleEdit}
                  variant="outline"
                  className="h-7 px-3 text-xs"
                >
                  <ArrowLeft className="h-3 w-3 mr-1.5" />
                  <span>返回编辑</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={!hasChanges || isSaving}
                  variant={hasChanges && !isSaving ? "default" : "outline"}
                  className={cn(
                    "h-7 px-3 text-xs",
                    (!hasChanges || isSaving) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSaving ? "保存中..." : "保存草稿"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownload}
                  disabled={hasChanges || isLoading}
                  variant={!hasChanges && !isLoading ? "default" : "outline"}
                  className={cn(
                    "h-7 px-3 text-xs",
                    (hasChanges || isLoading) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isLoading ? "下载中..." : "下载文书"}
                </Button>
              </div>
            </div>
            <DocumentPreview
              content={draftContent}
              onEdit={handleEdit}
              pageLayout={pageLayout}
            />
          </div>
        )}
      </div>
    </div>
  )
}
