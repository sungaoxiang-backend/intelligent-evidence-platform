"use client"

import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react"
import { Button } from "@/components/ui/button"
import { Hash } from "lucide-react"
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
  // 保存插入占位符时的光标位置
  const savedRangeRef = useRef<Range | null>(null)

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
    
    // 首先，移除所有已存在的占位符标记，恢复为纯文本格式
    // 这样可以避免嵌套问题
    const existingPlaceholders = contentEditableRef.current.querySelectorAll(
      ".lex-docx-placeholder-editor"
    )
    existingPlaceholders.forEach((el) => {
      const placeholderText = el.textContent || ""
      const textNode = document.createTextNode(placeholderText)
      el.parentNode?.replaceChild(textNode, el)
    })
    
    const placeholderRegex = /\{\{([^}]+)\}\}/g
    const walker = document.createTreeWalker(
      contentEditableRef.current,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // 跳过已经在占位符span内的文本节点
          const parent = node.parentElement
          if (parent && parent.classList.contains("lex-docx-placeholder-editor")) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        },
      }
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
        
        // 检查父节点是否已经是占位符span
        if (parent instanceof HTMLElement && parent.classList.contains("lex-docx-placeholder-editor")) {
          continue
        }
        
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
  // 注意：这里只处理纯文本格式的占位符，不处理已经是span的占位符（避免嵌套）
  const processPlaceholdersForEditing = (html: string): string => {
    // 先移除所有已存在的占位符标记（如果HTML中已经包含）
    let cleaned = html.replace(
      /<span class="lex-docx-placeholder-editor"[^>]*>(\{\{[^}]+\}\})<\/span>/g,
      "$1"
    )
    
    // 然后只处理纯文本格式的占位符
    const placeholderRegex = /\{\{([^}]+)\}\}/g
    return cleaned.replace(placeholderRegex, (match, fieldName) => {
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
      
      console.log('=== 保存前HTML ===')
      console.log('HTML长度:', html.length)
      console.log('包含占位符span:', html.includes('lex-docx-placeholder-editor'))
      console.log('占位符元数据数量:', Object.keys(placeholderMetadata).length)
      
      // 恢复占位符为原始格式 {{field_name}}
      // 匹配所有可能的占位符span，包括嵌套的情况
      // 使用非贪婪匹配，确保只匹配最内层的span
      let previousHtml = ""
      let iterationCount = 0
      while (html !== previousHtml && iterationCount < 10) {
        previousHtml = html
        html = html.replace(
          /<span[^>]*class="[^"]*lex-docx-placeholder-editor[^"]*"[^>]*>(\{\{[^}]+\}\})<\/span>/gi,
          "$1"
        )
        iterationCount++
      }
      
      // 处理可能的嵌套情况（如果还有span标签包裹占位符）
      html = html.replace(
        /<span[^>]*>(\{\{[^}]+\}\})<\/span>/g,
        "$1"
      )
      
      console.log('=== 保存后HTML ===')
      console.log('HTML长度:', html.length)
      console.log('包含占位符:', html.includes('{{'))
      // 提取所有占位符
      const placeholderMatches = html.match(/\{\{([^}]+)\}\}/g)
      console.log('占位符列表:', placeholderMatches)
      
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
    // 保存当前光标位置
    if (contentEditableRef.current) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        // 检查选择范围是否在编辑器内
        if (contentEditableRef.current.contains(range.commonAncestorContainer)) {
          // 克隆 Range 对象，因为原始的 Range 在 DOM 变化后可能失效
          savedRangeRef.current = range.cloneRange()
        } else {
          savedRangeRef.current = null
        }
      } else {
        // 如果没有选择范围，尝试在编辑器末尾创建范围
        const range = document.createRange()
        range.selectNodeContents(contentEditableRef.current)
        range.collapse(false) // 折叠到末尾
        savedRangeRef.current = range
      }
    }
    
    setEditingPlaceholderName(null)
    setPlaceholderName("")
    setPlaceholderNameError("")
    setShowPlaceholderDialog(true)
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
      {/* 工具栏 - 只显示插入占位符按钮，取消和保存按钮由父组件提供 */}
      <div className="flex items-center justify-start p-4 border-b bg-white">
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
                : "输入占位符名称并配置字段属性"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 直接显示完整配置表单，与编辑模式一致 */}
            <PlaceholderConfig
              placeholderName={editingPlaceholderName || placeholderName.trim() || ""}
              metadata={editingPlaceholderName 
                ? placeholderMetadata[editingPlaceholderName]
                : (placeholderName.trim() && placeholderMetadata[placeholderName.trim()]) || {
                    type: "text",
                    label: placeholderName.trim() 
                      ? placeholderName.trim().replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
                      : "",
                    required: false,
                    default_value: undefined,
                  }
              }
              allowNameEdit={true}
                onNameChange={(newName) => {
                  // 验证新名称
                  if (newName.trim() && !validatePlaceholderName(newName.trim())) {
                    setPlaceholderNameError("占位符名称只能包含字母、数字和下划线，且不能以数字开头")
                  } else {
                    setPlaceholderNameError("")
                    setPlaceholderName(newName)
                  }
                }}
                onSave={(name, metadata) => {
                  // 验证最终名称
                  const trimmedName = name.trim()
                  if (!trimmedName) {
                    setPlaceholderNameError("占位符名称不能为空")
                    return
                  }
                  if (!validatePlaceholderName(trimmedName)) {
                    setPlaceholderNameError("占位符名称只能包含字母、数字和下划线，且不能以数字开头")
                    return
                  }
                  
                  const finalName = trimmedName
                  
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
                  
                  // 如果是新建占位符，插入到编辑器
                  if (!editingPlaceholderName) {
                    // 先关闭对话框，避免焦点问题
                    setShowPlaceholderDialog(false)
                    setPlaceholderName("")
                    setPlaceholderNameError("")
                    setEditingPlaceholderName(null)
                    
                    // 延迟插入，确保对话框已关闭，焦点可以回到编辑器
                    setTimeout(() => {
                      if (contentEditableRef.current) {
                        // 确保编辑器获得焦点
                        contentEditableRef.current.focus()
                        
                        const selection = window.getSelection()
                        let range: Range | null = null
                        
                        // 优先使用保存的光标位置
                        if (savedRangeRef.current) {
                          try {
                            // 验证保存的范围是否仍然有效
                            const savedRange = savedRangeRef.current
                            if (contentEditableRef.current.contains(savedRange.commonAncestorContainer)) {
                              range = savedRange
                            } else {
                              // 如果保存的范围无效，尝试恢复
                              // 通过查找最近的文本节点来恢复位置
                              const container = savedRange.commonAncestorContainer
                              if (container && contentEditableRef.current.contains(container)) {
                                range = savedRange.cloneRange()
                              }
                            }
                          } catch (e) {
                            // 如果恢复失败，使用当前选择
                            console.warn("恢复保存的光标位置失败:", e)
                          }
                        }
                        
                        // 如果没有保存的范围或恢复失败，尝试获取当前选择范围
                        if (!range && selection && selection.rangeCount > 0) {
                          range = selection.getRangeAt(0)
                          // 检查选择范围是否在编辑器内
                          if (!contentEditableRef.current.contains(range.commonAncestorContainer)) {
                            range = null
                          }
                        }
                        
                        // 如果仍然没有有效的选择范围，在编辑器末尾插入
                        if (!range) {
                          range = document.createRange()
                          range.selectNodeContents(contentEditableRef.current)
                          range.collapse(false) // 折叠到末尾
                        }
                        
                        // 删除选择的内容（如果有）
                        range.deleteContents()
                        
                        // 创建占位符元素
                        const placeholderSpan = document.createElement("span")
                        placeholderSpan.className = "lex-docx-placeholder-editor"
                        placeholderSpan.setAttribute("data-placeholder", finalName)
                        placeholderSpan.setAttribute("contenteditable", "false")
                        placeholderSpan.setAttribute("tabindex", "0")
                        placeholderSpan.textContent = `{{${finalName}}}`
                        
                        // 添加点击事件
                        placeholderSpan.addEventListener("click", (e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setEditingPlaceholderName(finalName)
                          setPlaceholderName(finalName)
                          setShowPlaceholderDialog(true)
                        })
                        
                        // 插入占位符
                        range.insertNode(placeholderSpan)
                        
                        // 将光标移动到占位符之后
                        const newRange = document.createRange()
                        newRange.setStartAfter(placeholderSpan)
                        newRange.collapse(true)
                        
                        // 更新选择，确保光标在正确位置
                        if (selection) {
                          selection.removeAllRanges()
                          selection.addRange(newRange)
                        }
                        
                        // 清除保存的范围
                        savedRangeRef.current = null
                        
                        // 触发内容变化事件，确保占位符被标记
                        if (onContentChange) {
                          onContentChange(contentEditableRef.current.innerHTML)
                        }
                        
                        // 立即标记占位符，确保DOM已更新
                        requestAnimationFrame(() => {
                          markPlaceholders()
                          // 再次确保焦点在编辑器上
                          if (contentEditableRef.current) {
                            contentEditableRef.current.focus()
                            // 将光标移动到占位符之后
                            const finalRange = document.createRange()
                            const insertedPlaceholder = contentEditableRef.current.querySelector(
                              `.lex-docx-placeholder-editor[data-placeholder="${finalName}"]`
                            )
                            if (insertedPlaceholder) {
                              finalRange.setStartAfter(insertedPlaceholder)
                              finalRange.collapse(true)
                              const finalSelection = window.getSelection()
                              if (finalSelection) {
                                finalSelection.removeAllRanges()
                                finalSelection.addRange(finalRange)
                              }
                            }
                          }
                        })
                      }
                    }, 100)
                  } else {
                    // 编辑现有占位符，直接关闭对话框
                    setShowPlaceholderDialog(false)
                    setPlaceholderName("")
                    setPlaceholderNameError("")
                    setEditingPlaceholderName(null)
                  }
                }}
                onCancel={() => {
                  setShowPlaceholderDialog(false)
                  setPlaceholderName("")
                  setPlaceholderNameError("")
                  setEditingPlaceholderName(null)
                  // 清除保存的光标位置
                  savedRangeRef.current = null
                }}
              />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})

SimpleTemplateEditor.displayName = "SimpleTemplateEditor"

