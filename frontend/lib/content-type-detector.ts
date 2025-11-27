/**
 * 内容类型检测器
 * 识别模板中的内容类型（表格、段落、标题、列表等）
 */

import type { JSONContent } from "@tiptap/core"

export type ContentType = 'table' | 'paragraph' | 'heading' | 'list' | 'other'

export interface ContentTypeInfo {
  type: ContentType
  node: JSONContent
  path: number[]
}

/**
 * 检测节点的内容类型
 */
export function detectContentType(node: JSONContent): ContentType {
  switch (node.type) {
    case 'table':
      return 'table'
    case 'paragraph':
      return 'paragraph'
    case 'heading':
      return 'heading'
    case 'bulletList':
    case 'orderedList':
    case 'listItem':
      return 'list'
    default:
      return 'other'
  }
}

/**
 * 从文档中提取所有内容类型信息
 */
export function extractContentTypes(doc: JSONContent | null): ContentTypeInfo[] {
  if (!doc) {
    return []
  }

  const results: ContentTypeInfo[] = []

  function traverse(node: JSONContent, path: number[] = []) {
    const contentType = detectContentType(node)
    
    // 只记录主要的内容类型（不记录嵌套的内容）
    if (contentType !== 'other') {
      results.push({
        type: contentType,
        node,
        path: [...path],
      })
    }

    // 递归处理子节点
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child, index) => {
        traverse(child, [...path, index])
      })
    }
  }

  traverse(doc)
  return results
}

/**
 * 检查文档是否包含混合内容
 */
export function hasMixedContent(doc: JSONContent | null): boolean {
  if (!doc) {
    return false
  }

  const contentTypes = extractContentTypes(doc)
  const uniqueTypes = new Set(contentTypes.map((info) => info.type))
  
  // 如果有多种不同的内容类型，则认为是混合内容
  return uniqueTypes.size > 1
}

/**
 * 获取文档的内容类型统计
 */
export function getContentTypeStats(doc: JSONContent | null): Record<ContentType, number> {
  const stats: Record<ContentType, number> = {
    table: 0,
    paragraph: 0,
    heading: 0,
    list: 0,
    other: 0,
  }

  if (!doc) {
    return stats
  }

  const contentTypes = extractContentTypes(doc)
  contentTypes.forEach((info) => {
    stats[info.type] = (stats[info.type] || 0) + 1
  })

  return stats
}

