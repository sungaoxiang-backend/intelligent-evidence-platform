"use client"

import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react"
import { Button } from "@/components/ui/button"
import { Save, Loader2, Hash } from "lucide-react"
import { type DocumentTemplate, type PlaceholderMetadata } from "@/lib/api/lex-docx"
import { PlaceholderConfig } from "./PlaceholderConfig"
import { cn } from "@/lib/utils"
import "@/app/lex-docx/docx-styles.css"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { handleApiError } from "@/lib/utils/error-handler"

export interface SimpleTemplateEditorRef {
  save: () => Promise<void>
}

interface SimpleTemplateEditorProps {
  template: DocumentTemplate | null
  onSave?: (content: string, placeholderMetadata: Record<string, PlaceholderMetadata>) => void | Promise<void>
  onCancel?: () => void
  onContentChange?: (content: string) => void
  className?: string
  isSaving?: boolean
}

// 验证占位符名称
function validatePlaceholderName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

export const SimpleTemplateEditor = forwardRef<SimpleTemplateEditorRef, SimpleTemplateEditorProps>(({
  template,
  onSave,
  onCancel,
  onContentChange,
  className,
  isSaving: externalIsSaving,
}, ref) => {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const isSavingState = externalIsSaving !== undefined ? externalIsSaving : isSaving
  const [showPlaceholderDialog, setShowPlaceholderDialog] = useState(false)
  const [placeholderName, setPlaceholderName] = useState("")
  const [placeholderMetadata, setPlaceholderMetadata] = useState<
    Record<string, PlaceholderMetadata>
  >({})
  const [placeholderNameError, setPlaceholderNameError] = useState("")
  const contentEditableRef = useRef<HTMLDivElement>(null)
  const [originalContent, setOriginalContent] = useState<string>("")

  // 从模板加载占位符元数据
  useEffect(() => {
    if (template?.placeholder_metadata) {
      setPlaceholderMetadata(template.placeholder_metadata)
    } else {
      setPlaceholderMetadata({})
    }
  }, [template?.placeholder_metadata])

  // 标记占位符（在内容变化后重新标记）
  const markPlaceholders = useCallback(() => {
    if (!contentEditableRef.current) return
    
    const placeholderRegex = /\{\{([^}]+)\}\}/g
    const walker = document.createTreeWalker(
      contentEditableRef.current,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    const textNodes: Text[] = []
    let node
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        if (placeholderRegex.test(node.textContent)) {
          textNodes.push(node as Text)
        }
      }
    }
    
    // 从后往前处理，避免索引偏移
    for (const textNode of textNodes.reverse()) {
      const text = textNode.textContent || ""
      const matches = Array.from(text.matchAll(placeholderRegex))
      
      if (matches.length > 0) {
        const parent = textNode.parentNode
        if (!parent) continue
        
        let lastIndex = 0
        const fragment = document.createDocumentFragment()
        
        for (const match of matches) {
          const startIndex = match.index!
          const endIndex = startIndex + match[0].length
          const fieldName = match[1].trim()
          
          // 添加占位符前的文本
          if (startIndex > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, startIndex)))
          }
          
          // 创建占位符元素
          const placeholderSpan = document.createElement("span")
          placeholderSpan.className = "lex-docx-placeholder-editor"
          placeholderSpan.setAttribute("data-placeholder", fieldName)
          placeholderSpan.setAttribute("contenteditable", "false")
          placeholderSpan.setAttribute("tabindex", "0") // 支持键盘导航
          placeholderSpan.textContent = match[0]
          
          // 添加点击事件
          placeholderSpan.addEventListener("click", (e) => {
            e.preventDefault()
            e.stopPropagation()
            setEditingPlaceholderName(fieldName)
            setPlaceholderName(fieldName)
            setShowPlaceholderDialog(true)
          })
          
          fragment.appendChild(placeholderSpan)
          lastIndex = endIndex
        }
        
        // 添加剩余文本
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)))
        }
        
        parent.replaceChild(fragment, textNode)
      }
    }
  }, [])

  // 加载模板内容到编辑器
  useEffect(() => {
    if (template?.content_html && contentEditableRef.current) {
      console.log('=== 加载模板内容到编辑器 ===')
      console.log('原始HTML长度:', template.content_html.length)
      console.log('原始HTML前500字符:', template.content_html.substring(0, 500))
      console.log('原始HTML包含表格:', template.content_html.includes('<table'))
      console.log('原始HTML包含样式:', template.content_html.includes('style='))
      
      // 处理占位符，添加可点击标记
      const processedHtml = processPlaceholdersForEditing(template.content_html)
      console.log('处理后的HTML长度:', processedHtml.length)
      console.log('处理后的HTML包含表格:', processedHtml.includes('<table'))
      console.log('处理后的HTML包含样式:', processedHtml.includes('style='))
      
      // 使用innerHTML加载内容（确保格式完整）
      contentEditableRef.current.innerHTML = processedHtml
      
      // 检查加载后的内容
      setTimeout(() => {
        if (contentEditableRef.current) {
          const loadedHtml = contentEditableRef.current.innerHTML
          console.log('加载后的innerHTML长度:', loadedHtml.length)
          console.log('加载后是否包含表格:', loadedHtml.includes('<table'))
          console.log('加载后是否包含样式:', loadedHtml.includes('style='))
          
          if (!loadedHtml.includes('<table') || !loadedHtml.includes('style=')) {
            console.error('⚠️ 警告：加载后格式丢失！')
            console.error('原始HTML包含表格:', template.content_html.includes('<table'))
            console.error('原始HTML包含样式:', template.content_html.includes('style='))
            console.error('加载后HTML前500字符:', loadedHtml.substring(0, 500))
          } else {
            console.log('✓ 格式已正确加载')
          }
        }
      }, 100)
      
      setOriginalContent(processedHtml)
      
      // 标记占位符
      markPlaceholders()
    }
  }, [template?.id, template?.content_html, markPlaceholders])

  // 处理占位符，添加可点击标记
  const processPlaceholdersForEditing = (html: string): string => {
    const placeholderRegex = /\{\{([^}]+)\}\}/g
    return html.replace(placeholderRegex, (match, fieldName) => {
      const trimmedName = fieldName.trim()
      return `<span class="lex-docx-placeholder-editor" data-placeholder="${trimmedName}" contenteditable="false" tabindex="0">${match}</span>`
    })
  }

  // 处理内容变化
  const handleContentChange = useCallback(() => {
    if (!contentEditableRef.current || !onContentChange) return
    
    const html = contentEditableRef.current.innerHTML
    onContentChange(html)
    
    // 延迟标记占位符
    setTimeout(() => {
      markPlaceholders()
    }, 50)
  }, [onContentChange, markPlaceholders])

  // 处理占位符点击和键盘事件
  const [editingPlaceholderName, setEditingPlaceholderName] = useState<string | null>(null)
  
  useEffect(() => {
    if (!contentEditableRef.current) return
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const placeholderElement = target.closest(".lex-docx-placeholder-editor") as HTMLElement
      
      if (placeholderElement) {
        e.preventDefault()
        e.stopPropagation()
        const placeholderName = placeholderElement.getAttribute("data-placeholder")
        if (placeholderName) {
          setEditingPlaceholderName(placeholderName)
          setPlaceholderName(placeholderName)
          setShowPlaceholderDialog(true)
        }
      }
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains("lex-docx-placeholder-editor")) {
        // 支持 Enter 和 Space 键打开编辑对话框
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          e.stopPropagation()
          const placeholderName = target.getAttribute("data-placeholder")
          if (placeholderName) {
            setEditingPlaceholderName(placeholderName)
            setPlaceholderName(placeholderName)
            setShowPlaceholderDialog(true)
          }
        }
      }
    }
    
    contentEditableRef.current.addEventListener("click", handleClick)
    contentEditableRef.current.addEventListener("keydown", handleKeyDown)
    return () => {
      contentEditableRef.current?.removeEventListener("click", handleClick)
      contentEditableRef.current?.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // 手动保存
  const handleSave = async () => {
    if (!contentEditableRef.current || !template) {
      return
    }

    const savingState = externalIsSaving !== undefined
    if (!savingState) {
      setIsSaving(true)
    }

    try {
      // 获取HTML内容，移除占位符标记的额外属性，恢复原始格式
      let html = contentEditableRef.current.innerHTML
      
      // 恢复占位符为原始格式 {{field_name}}
      html = html.replace(
        /<span class="lex-docx-placeholder-editor"[^>]*>(\{\{[^}]+\}\})<\/span>/g,
        "$1"
      )
      
      if (onSave) {
        await onSave(html, placeholderMetadata)
        if (!savingState) {
          toast({
            title: "保存成功",
            description: "模板内容已保存",
          })
        }
      }
    } catch (error) {
      if (!savingState) {
        handleApiError(error, "模板保存失败")
      }
      throw error
    } finally {
      if (!savingState) {
        setIsSaving(false)
      }
    }
  }

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    save: handleSave,
  }))

  // 处理插入占位符
  const handleInsertPlaceholder = () => {
    setEditingPlaceholderName(null)
    setPlaceholderName("")
    setPlaceholderNameError("")
    setShowPlaceholderDialog(true)
  }

  // 处理占位符对话框确认
  const handlePlaceholderConfirm = () => {
    if (!placeholderName.trim()) {
      setPlaceholderNameError("占位符名称不能为空")
      return
    }

    if (!validatePlaceholderName(placeholderName.trim())) {
      setPlaceholderNameError("占位符名称只能包含字母、数字和下划线，且不能以数字开头")
      return
    }

    const fieldName = placeholderName.trim()

    // 如果正在编辑现有占位符，更新元数据
    if (editingPlaceholderName && editingPlaceholderName !== fieldName) {
      // 更新占位符名称
      if (contentEditableRef.current) {
        const placeholderElements = contentEditableRef.current.querySelectorAll(
          `.lex-docx-placeholder-editor[data-placeholder="${editingPlaceholderName}"]`
        )
        placeholderElements.forEach((el) => {
          el.setAttribute("data-placeholder", fieldName)
          el.textContent = `{{${fieldName}}}`
        })
      }
      
      // 更新元数据
      if (placeholderMetadata[editingPlaceholderName]) {
        const metadata = placeholderMetadata[editingPlaceholderName]
        delete placeholderMetadata[editingPlaceholderName]
        setPlaceholderMetadata({
          ...placeholderMetadata,
          [fieldName]: metadata,
        })
      }
    }

    // 插入或更新占位符
    if (contentEditableRef.current) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        
        const placeholderSpan = document.createElement("span")
        placeholderSpan.className = "lex-docx-placeholder-editor"
        placeholderSpan.setAttribute("data-placeholder", fieldName)
        placeholderSpan.setAttribute("contenteditable", "false")
        placeholderSpan.setAttribute("tabindex", "0") // 支持键盘导航
        placeholderSpan.textContent = `{{${fieldName}}}`
        
        placeholderSpan.addEventListener("click", (e) => {
          e.preventDefault()
          e.stopPropagation()
          setEditingPlaceholderName(fieldName)
          setPlaceholderName(fieldName)
          setShowPlaceholderDialog(true)
        })
        
        range.insertNode(placeholderSpan)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }

    // 如果占位符不存在，创建默认元数据
    if (!placeholderMetadata[fieldName]) {
      setPlaceholderMetadata({
        ...placeholderMetadata,
        [fieldName]: {
          type: "text",
          label: fieldName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          required: false,
          default_value: null,
        },
      })
    }

    setShowPlaceholderDialog(false)
    setPlaceholderName("")
    setPlaceholderNameError("")
    setEditingPlaceholderName(null)
  }

  if (!template) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
        <p>请选择一个模板进行编辑</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleInsertPlaceholder}
            className="gap-2"
          >
            <Hash className="h-4 w-4" />
            插入占位符
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSavingState}
            className="gap-2"
          >
            {isSavingState ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                保存
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 编辑器内容区域 */}
      <div className="flex-1 overflow-auto p-6 bg-white">
        <div
          className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8 min-h-full"
          style={{
            fontFamily: "Times New Roman, serif",
            fontSize: "12pt",
            lineHeight: "1.5",
            color: "#000",
          }}
        >
          {/* 使用contentEditable直接编辑HTML，通过useEffect加载内容 */}
          <div
            ref={contentEditableRef}
            contentEditable
            onInput={handleContentChange}
            className="lex-docx-preview-content outline-none"
            style={{
              wordBreak: "break-word",
              minHeight: "100%",
            }}
            suppressContentEditableWarning
          />
        </div>
      </div>

      {/* 占位符配置对话框 */}
      <Dialog open={showPlaceholderDialog} onOpenChange={setShowPlaceholderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPlaceholderName ? "编辑占位符" : "插入占位符"}
            </DialogTitle>
            <DialogDescription>
              {editingPlaceholderName
                ? "修改占位符名称和配置"
                : "输入占位符名称，格式为字母、数字和下划线的组合"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 占位符名称输入（仅在插入新占位符时显示，编辑时隐藏，因为 PlaceholderConfig 会显示） */}
            {!editingPlaceholderName && (
              <div>
                <Label htmlFor="placeholder-name">占位符名称</Label>
                <Input
                  id="placeholder-name"
                  value={placeholderName}
                  onChange={(e) => {
                    setPlaceholderName(e.target.value)
                    setPlaceholderNameError("")
                  }}
                  placeholder="例如: plaintiff_name"
                  className={cn(placeholderNameError && "border-red-500")}
                />
                {placeholderNameError && (
                  <p className="text-sm text-red-500 mt-1">{placeholderNameError}</p>
                )}
              </div>
            )}
            {placeholderName.trim() && validatePlaceholderName(placeholderName.trim()) && (
              <PlaceholderConfig
                placeholderName={placeholderName.trim()}
                metadata={placeholderMetadata[placeholderName.trim()] || {
                  type: "text",
                  label: placeholderName.trim().replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                  required: false,
                  default_value: null,
                }}
                allowNameEdit={!!editingPlaceholderName}
                onNameChange={(newName) => {
                  // 验证新名称
                  if (!validatePlaceholderName(newName.trim())) {
                    setPlaceholderNameError("占位符名称只能包含字母、数字和下划线，且不能以数字开头")
                  } else {
                    setPlaceholderNameError("")
                    setPlaceholderName(newName)
                  }
                }}
                onSave={(name, metadata) => {
                  // 验证最终名称
                  if (!validatePlaceholderName(name.trim())) {
                    setPlaceholderNameError("占位符名称只能包含字母、数字和下划线，且不能以数字开头")
                    return
                  }
                  
                  const finalName = name.trim()
                  
                  // 如果正在编辑现有占位符且名称改变，需要更新占位符名称
                  if (editingPlaceholderName && editingPlaceholderName !== finalName) {
                    // 检查新名称是否已存在
                    if (placeholderMetadata[finalName] && finalName !== editingPlaceholderName) {
                      setPlaceholderNameError("该占位符名称已存在")
                      return
                    }
                    
                    // 更新编辑器中的占位符名称
                    if (contentEditableRef.current) {
                      const placeholderElements = contentEditableRef.current.querySelectorAll(
                        `.lex-docx-placeholder-editor[data-placeholder="${editingPlaceholderName}"]`
                      )
                      placeholderElements.forEach((el) => {
                        el.setAttribute("data-placeholder", finalName)
                        el.textContent = `{{${finalName}}}`
                      })
                    }
                    
                    // 如果旧名称有元数据，迁移到新名称
                    if (placeholderMetadata[editingPlaceholderName]) {
                      const newMetadata = { ...placeholderMetadata }
                      delete newMetadata[editingPlaceholderName]
                      newMetadata[finalName] = metadata
                      setPlaceholderMetadata(newMetadata)
                    } else {
                      setPlaceholderMetadata({
                        ...placeholderMetadata,
                        [finalName]: metadata,
                      })
                    }
                  } else {
                    // 检查新名称是否已存在（新建时）
                    if (!editingPlaceholderName && placeholderMetadata[finalName]) {
                      setPlaceholderNameError("该占位符名称已存在")
                      return
                    }
                    
                    // 正常保存或新建
                    setPlaceholderMetadata({
                      ...placeholderMetadata,
                      [finalName]: metadata,
                    })
                  }
                  
                  // 保存后关闭对话框
                  setShowPlaceholderDialog(false)
                  setPlaceholderName("")
                  setPlaceholderNameError("")
                  setEditingPlaceholderName(null)
                }}
                onCancel={() => {
                  setShowPlaceholderDialog(false)
                  setPlaceholderName("")
                  setPlaceholderNameError("")
                  setEditingPlaceholderName(null)
                }}
              />
            )}
            {/* PlaceholderConfig 内部已有保存和取消按钮，不需要外部按钮 */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})

SimpleTemplateEditor.displayName = "SimpleTemplateEditor"

