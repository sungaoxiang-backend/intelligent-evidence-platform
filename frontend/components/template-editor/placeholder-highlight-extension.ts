"use client"

/**
 * 轻量化占位符高亮扩展
 * 
 * 设计原则：
 * 1. 仅提供视觉高亮，不阻断编辑行为
 * 2. 占位符是普通文本，可以像普通文本一样编辑
 * 3. 不设置 contenteditable="false"
 * 4. 不拦截键盘事件
 * 
 * 适用于：编辑模式
 */

import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

export const placeholderHighlightPluginKey = new PluginKey("placeholder-highlight")

// 占位符正则表达式
const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g

interface PlaceholderMatch {
  from: number
  to: number
  fieldKey: string
}

/**
 * 查找文档中的所有占位符
 */
function findPlaceholdersInDoc(doc: any): PlaceholderMatch[] {
  try {
    if (!doc) {
      console.warn('findPlaceholdersInDoc: doc is null or undefined')
      return []
    }
    
    const placeholders: PlaceholderMatch[] = []
    
    doc.descendants((node: any, pos: number) => {
      try {
        if (!node || !node.isText || !node.text) return
        
        const text = node.text
        PLACEHOLDER_REGEX.lastIndex = 0
        
        let match: RegExpExecArray | null
        while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
          const fieldKey = match[1].trim()
          if (fieldKey) {
            placeholders.push({
              from: pos + match.index,
              to: pos + match.index + match[0].length,
              fieldKey,
            })
          }
        }
      } catch (error) {
        console.error('Error processing node in findPlaceholdersInDoc:', error)
      }
    })
    
    return placeholders
  } catch (error) {
    console.error('findPlaceholdersInDoc error:', error)
    return []
  }
}

export interface PlaceholderHighlightOptions {
  /**
   * 自定义 CSS 类名
   */
  className?: string
  
  /**
   * 是否在悬停时显示提示
   */
  showTooltip?: boolean
}

/**
 * 占位符高亮扩展
 * 
 * 只做视觉装饰，不改变编辑行为
 */
export const PlaceholderHighlightExtension = Extension.create<PlaceholderHighlightOptions>({
  name: "placeholderHighlight",
  
  addOptions() {
    return {
      className: "placeholder-highlight",
      showTooltip: true,
    }
  },
  
  addProseMirrorPlugins() {
    const { className, showTooltip } = this.options
    const pluginInstance = new Plugin({
      key: placeholderHighlightPluginKey,
      
      state: {
        init(_, state) {
          try {
            if (!state || !state.doc) {
              console.warn('PlaceholderHighlight init: invalid state')
              return []
            }
            return findPlaceholdersInDoc(state.doc) || []
          } catch (error) {
            console.error('PlaceholderHighlight init error:', error)
            return []
          }
        },
        
        apply(tr, prev, _oldState, newState) {
          try {
            if (!newState || !newState.doc) {
              console.warn('PlaceholderHighlight apply: invalid newState')
              return Array.isArray(prev) ? prev : []
            }
            
            // 只在文档内容变化时重新查找占位符
            if (tr && tr.docChanged) {
              return findPlaceholdersInDoc(newState.doc) || []
            }
            
            // 确保prev是有效数组
            return Array.isArray(prev) ? prev : []
          } catch (error) {
            console.error('PlaceholderHighlight apply error:', error)
            return Array.isArray(prev) ? prev : []
          }
        },
      },
      
      props: {
        decorations(state) {
          try {
            if (!state || !state.doc) {
              console.warn('PlaceholderHighlight decorations: invalid state')
              return DecorationSet.empty
            }
            
            const placeholders = pluginInstance.getState(state)
            
            // 防御性检查
            if (!Array.isArray(placeholders) || placeholders.length === 0) {
              return DecorationSet.empty
            }
            
            const decorations: Decoration[] = []
            const docSize = state.doc.content.size
            
            for (const { from, to, fieldKey } of placeholders) {
              try {
                // ✅ 关键修复：验证位置有效性
                if (typeof from !== 'number' || typeof to !== 'number') {
                  console.warn(`Invalid position for placeholder ${fieldKey}: from=${from}, to=${to}`)
                  continue
                }
                
                if (from < 0 || to > docSize || from >= to) {
                  console.warn(`Out of range position for placeholder ${fieldKey}: from=${from}, to=${to}, docSize=${docSize}`)
                  continue
                }
                
                // ✅ 验证位置是否在有效节点内
                try {
                  state.doc.resolve(from)
                  state.doc.resolve(to)
                } catch (error) {
                  console.warn(`Cannot resolve position for placeholder ${fieldKey}:`, error)
                  continue
                }
                
                decorations.push(
                  Decoration.inline(from, to, {
                    class: className,
                    "data-placeholder-field": fieldKey,
                    ...(showTooltip && { title: `占位符: ${fieldKey}` }),
                  })
                )
              } catch (error) {
                console.error('Failed to create decoration:', error)
              }
            }
            
            if (decorations.length === 0) {
              return DecorationSet.empty
            }
            
            try {
              return DecorationSet.create(state.doc, decorations)
            } catch (error) {
              console.error('Failed to create DecorationSet:', error)
              return DecorationSet.empty
            }
          } catch (error) {
            console.error('PlaceholderHighlight decorations error:', error)
            return DecorationSet.empty
          }
        },
      },
    })
    
    return [pluginInstance]
  },
})

/**
 * 从文档 JSON 中提取占位符列表（去重）
 */
export function extractPlaceholdersFromJSON(json: any): string[] {
  const placeholders = new Set<string>()
  
  function traverse(node: any) {
    if (node.type === "text" && node.text) {
      PLACEHOLDER_REGEX.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = PLACEHOLDER_REGEX.exec(node.text)) !== null) {
        const fieldKey = match[1].trim()
        if (fieldKey) {
          placeholders.add(fieldKey)
        }
      }
    }
    
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse)
    }
  }
  
  traverse(json)
  return Array.from(placeholders).sort()
}

