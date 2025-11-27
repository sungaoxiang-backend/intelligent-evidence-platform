/**
 * 单元格渲染器注册表
 * 支持基于配置的单元格渲染器选择
 */

import type { JSONContent } from "@tiptap/core"
import type { CellRendererConfig, TemplateRenderConfig } from "./template-render-config"
import { extractPlaceholdersFromCell } from "@/components/document-generation/replicable-cell-utils"

export type CellRendererType = 'default' | 'replicable' | 'narrative' | 'conditional' | 'custom'

/**
 * 匹配单元格渲染器配置
 */
export function matchCellRenderer(
  cellNode: JSONContent,
  config: TemplateRenderConfig,
  templateCategory?: string | null
): CellRendererConfig | null {
  const cellRenderers = config.cellRenderers || {}
  const placeholders = extractPlaceholdersFromCell(cellNode)

  // 按配置顺序评估匹配器
  for (const [matcherKey, rendererConfig] of Object.entries(cellRenderers)) {
    if (matcherKey === 'default') {
      // default 匹配器总是匹配，但要在最后评估
      continue
    }

    const matcher = rendererConfig.matcher

    // 检查占位符数量范围
    if (matcher.placeholderCount) {
      const { min, max } = matcher.placeholderCount
      const count = placeholders.length
      if (min !== undefined && count < min) continue
      if (max !== undefined && count > max) continue
    }

    // 检查占位符名称匹配
    if (matcher.placeholderNames && matcher.placeholderNames.length > 0) {
      const hasAllPlaceholders = matcher.placeholderNames.every((name) =>
        placeholders.includes(name)
      )
      if (!hasAllPlaceholders) continue
    }

    // 检查内容模式匹配
    if (matcher.contentPattern) {
      const cellText = extractCellText(cellNode)
      const pattern = new RegExp(matcher.contentPattern)
      if (!pattern.test(cellText)) continue
    }

    // 检查自定义匹配函数
    if (matcher.customMatcher) {
      if (!matcher.customMatcher(cellNode)) continue
    }

    // 所有条件都匹配，返回此渲染器配置
    return rendererConfig
  }

  // 如果没有匹配的渲染器，返回 default 或根据模板类型生成
  const defaultRenderer = cellRenderers.default
  if (defaultRenderer) {
    return defaultRenderer
  }

  // 如果没有 default，根据模板类型生成默认配置
  return generateDefaultRendererFromType(templateCategory)
}

/**
 * 从单元格节点提取文本内容
 */
function extractCellText(node: JSONContent): string {
  let text = ""
  
  if (node.type === "text" && node.text) {
    text += node.text
  }
  
  if (node.content && Array.isArray(node.content)) {
    node.content.forEach((child) => {
      text += extractCellText(child)
    })
  }
  
  return text
}

/**
 * 根据模板类型生成默认渲染器配置
 */
function generateDefaultRendererFromType(
  templateCategory?: string | null
): CellRendererConfig {
  const isElementStyle = templateCategory && 
    (templateCategory.includes("要素") || templateCategory === "要素式")
  const isNarrativeStyle = templateCategory && 
    (templateCategory.includes("陈述") || templateCategory === "陈述式")

  if (isElementStyle) {
    return {
      type: 'replicable',
      matcher: {},
      options: {
        allowReplication: true,
        replicationMode: 'row',
        showCheckbox: true,
      },
    }
  }

  if (isNarrativeStyle) {
    return {
      type: 'narrative',
      matcher: {},
      options: {
        allowReplication: true,
        replicationMode: 'paragraph',
      },
    }
  }

  return {
    type: 'default',
    matcher: {},
  }
}

/**
 * 检查单元格是否为合并单元格
 */
export function isMergedCell(cellNode: JSONContent): boolean {
  const attrs = cellNode.attrs || {}
  const colspan = attrs.colspan || 1
  const rowspan = attrs.rowspan || 1
  return colspan > 1 || rowspan > 1
}

/**
 * 获取单元格的合并信息
 */
export function getCellMergeInfo(cellNode: JSONContent): {
  colspan: number
  rowspan: number
} {
  const attrs = cellNode.attrs || {}
  return {
    colspan: attrs.colspan || 1,
    rowspan: attrs.rowspan || 1,
  }
}

