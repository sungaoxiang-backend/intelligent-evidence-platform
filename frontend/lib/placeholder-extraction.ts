/**
 * 增强的占位符提取功能
 * 支持从所有节点类型提取占位符，不限制在表格单元格中
 */

import type { JSONContent } from "@tiptap/core"
import type { PlaceholderExtractionConfig } from "./template-render-config"

const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g

export interface ExtractedPlaceholder {
  fieldKey: string
  nodeType: string
  path: number[]
  position?: {
    start: number
    end: number
  }
}

/**
 * 从节点中提取占位符
 */
function extractPlaceholdersFromNode(
  node: JSONContent,
  path: number[] = [],
  config: PlaceholderExtractionConfig = {},
  parentNodeType?: string
): ExtractedPlaceholder[] {
  const results: ExtractedPlaceholder[] = []
  const supportedNodeTypes = config.supportedNodeTypes || [
    'tableCell',
    'tableHeader',
    'paragraph',
    'heading',
    'listItem',
    'bulletList',
    'orderedList',
  ]

  // 如果是 placeholder 节点，直接提取（不检查父节点类型）
  if (node.type === "placeholder") {
    const fieldKey = (node.attrs as any)?.fieldKey || (node.attrs as any)?.field_key
    if (fieldKey) {
      // 检查父节点类型是否支持（如果配置了）
      if (!parentNodeType || supportedNodeTypes.includes(parentNodeType)) {
        results.push({
          fieldKey: String(fieldKey).trim(),
          nodeType: node.type,
          path,
        })
      }
    }
  }

  // 如果是文本节点，检查文本内容中的 {{placeholder}} 格式
  if (node.type === "text" && node.text) {
    // 检查父节点类型是否支持（如果配置了）
    if (!parentNodeType || supportedNodeTypes.includes(parentNodeType)) {
      const text = node.text
      let match: RegExpExecArray | null
      PLACEHOLDER_REGEX.lastIndex = 0
      
      while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
        const fieldKey = match[1].trim()
        if (fieldKey) {
          results.push({
            fieldKey,
            nodeType: node.type,
            path,
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
          })
        }
      }
    }
  }

  // 递归处理子节点（传递当前节点类型作为父节点类型）
  if (node.content && Array.isArray(node.content)) {
    node.content.forEach((child, index) => {
      const childPath = [...path, index]
      const childResults = extractPlaceholdersFromNode(child, childPath, config, node.type)
      results.push(...childResults)
    })
  }

  return results
}

/**
 * 从文档中提取所有占位符
 * 
 * @param doc ProseMirror JSON 文档
 * @param config 占位符提取配置
 * @returns 提取的占位符列表（去重）
 */
export function extractPlaceholders(
  doc: JSONContent | null,
  config: PlaceholderExtractionConfig = {}
): string[] {
  if (!doc) {
    return []
  }

  // 如果配置了 extractFromNonTable，则从所有支持的节点类型提取
  // 否则只从表格单元格提取（保持向后兼容）
  if (!config.extractFromNonTable) {
    // 只从表格单元格提取（原有行为）
    config = {
      ...config,
      supportedNodeTypes: ['tableCell', 'tableHeader'],
    }
  } else {
    // 从所有支持的节点类型提取
    config = {
      ...config,
      supportedNodeTypes: config.supportedNodeTypes || [
        'tableCell',
        'tableHeader',
        'paragraph',
        'heading',
        'listItem',
        'bulletList',
        'orderedList',
      ],
    }
  }

  const results = extractPlaceholdersFromNode(doc, [], config, undefined)
  
  // 去重并返回
  const uniquePlaceholders = new Set<string>()
  results.forEach((result) => {
    if (result.fieldKey) {
      uniquePlaceholders.add(result.fieldKey)
    }
  })

  return Array.from(uniquePlaceholders).sort()
}

/**
 * 从文档中提取占位符（包含详细信息）
 * 
 * @param doc ProseMirror JSON 文档
 * @param config 占位符提取配置
 * @returns 提取的占位符详细信息列表
 */
export function extractPlaceholdersWithDetails(
  doc: JSONContent | null,
  config: PlaceholderExtractionConfig = {}
): ExtractedPlaceholder[] {
  if (!doc) {
    return []
  }

  // 如果配置了 extractFromNonTable，则从所有支持的节点类型提取
  if (!config.extractFromNonTable) {
    config = {
      ...config,
      supportedNodeTypes: ['tableCell', 'tableHeader'],
    }
  } else {
    config = {
      ...config,
      supportedNodeTypes: config.supportedNodeTypes || [
        'tableCell',
        'tableHeader',
        'paragraph',
        'heading',
        'listItem',
        'bulletList',
        'orderedList',
      ],
    }
  }

  return extractPlaceholdersFromNode(doc, [], config, undefined)
}

/**
 * 从特定节点类型提取占位符
 * 
 * @param doc ProseMirror JSON 文档
 * @param nodeTypes 要提取的节点类型列表
 * @returns 提取的占位符列表（去重）
 */
export function extractPlaceholdersFromNodeTypes(
  doc: JSONContent | null,
  nodeTypes: string[]
): string[] {
  if (!doc) {
    return []
  }

  const config: PlaceholderExtractionConfig = {
    extractFromNonTable: true,
    supportedNodeTypes: nodeTypes,
  }

  return extractPlaceholders(doc, config)
}

