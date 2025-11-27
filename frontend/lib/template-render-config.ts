/**
 * 模板渲染配置系统
 * 支持灵活的模板渲染配置，解耦模板类型和渲染逻辑
 */

import type { JSONContent } from "@tiptap/core"

/**
 * 单元格渲染器配置
 */
export interface CellRendererConfig {
  /** 渲染器类型 */
  type: 'default' | 'replicable' | 'narrative' | 'conditional' | 'custom' | 'auto'
  
  /** 匹配条件 */
  matcher: {
    /** 占位符数量范围 */
    placeholderCount?: { min?: number; max?: number }
    /** 占位符名称匹配 */
    placeholderNames?: string[]
    /** 单元格内容匹配（正则表达式） */
    contentPattern?: string
    /** 自定义匹配函数 */
    customMatcher?: (cellNode: JSONContent) => boolean
  }
  
  /** 渲染器选项 */
  options?: {
    /** 是否支持添加/删除 */
    allowReplication?: boolean
    /** 复制模式：'row' | 'paragraph' | 'cell' */
    replicationMode?: 'row' | 'paragraph' | 'cell'
    /** 是否显示checkbox */
    showCheckbox?: boolean
  }
}

/**
 * 条件规则
 */
export interface ConditionalRule {
  /** 目标节点（通过选择器定位） */
  target: {
    type: 'cell' | 'row' | 'paragraph' | 'section'
    selector: string  // 例如：'table-0-row-1-cell-0' 或 'placeholder:defendant_type'
  }
  
  /** 显示条件 */
  showWhen: {
    /** 表单字段条件 */
    field?: {
      name: string
      operator: 'equals' | 'notEquals' | 'contains' | 'in' | 'notIn'
      value: any
    }
    /** 组合条件（AND/OR） */
    logic?: 'and' | 'or'
    conditions?: ConditionalRule[]
  }
  
  /** 隐藏时的行为 */
  hideBehavior?: 'remove' | 'display-none' | 'collapse'
}

/**
 * 占位符提取配置
 */
export interface PlaceholderExtractionConfig {
  /** 是否从表格外提取占位符 */
  extractFromNonTable?: boolean
  /** 支持的节点类型 */
  supportedNodeTypes?: string[]
  /** 占位符格式（支持自定义正则） */
  pattern?: RegExp | string
}

/**
 * 模板渲染配置
 */
export interface TemplateRenderConfig {
  /** 单元格渲染配置 */
  cellRenderers?: {
    [matcher: string]: CellRendererConfig
  }
  
  /** 条件渲染规则 */
  conditionalRendering?: ConditionalRule[]
  
  /** 表格行配置 */
  tableRowConfig?: {
    showCheckbox?: boolean | 'auto'  // 'auto' 表示根据内容自动判断
    checkboxPosition?: 'left' | 'first-cell'
  }
  
  /** 占位符提取配置 */
  placeholderExtraction?: PlaceholderExtractionConfig
}

/**
 * 默认渲染配置
 * 保持与现有行为一致
 */
export const DEFAULT_RENDER_CONFIG: TemplateRenderConfig = {
  cellRenderers: {
    default: {
      type: 'auto',
      matcher: {},
    },
  },
  placeholderExtraction: {
    extractFromNonTable: false,
    supportedNodeTypes: ['tableCell', 'tableHeader'],
  },
  tableRowConfig: {
    showCheckbox: 'auto',
    checkboxPosition: 'left',
  },
}

/**
 * 合并配置
 * 将模板特定配置与默认配置合并
 */
export function mergeRenderConfig(
  templateConfig?: Partial<TemplateRenderConfig>,
  defaultConfig: TemplateRenderConfig = DEFAULT_RENDER_CONFIG
): TemplateRenderConfig {
  if (!templateConfig) {
    return defaultConfig
  }

  return {
    cellRenderers: {
      ...defaultConfig.cellRenderers,
      ...templateConfig.cellRenderers,
    },
    conditionalRendering: templateConfig.conditionalRendering || defaultConfig.conditionalRendering,
    tableRowConfig: {
      ...defaultConfig.tableRowConfig,
      ...templateConfig.tableRowConfig,
    },
    placeholderExtraction: {
      ...defaultConfig.placeholderExtraction,
      ...templateConfig.placeholderExtraction,
    },
  }
}

/**
 * 根据模板类型生成默认配置
 * 保持向后兼容性
 */
export function generateDefaultConfigFromType(
  templateCategory?: string | null
): TemplateRenderConfig {
  const isElementStyle = templateCategory && 
    (templateCategory.includes("要素") || templateCategory === "要素式")
  const isNarrativeStyle = templateCategory && 
    (templateCategory.includes("陈述") || templateCategory === "陈述式")
  const isMixedStyle = templateCategory && 
    (templateCategory === "混合式" || templateCategory.includes("混合"))

  if (isElementStyle) {
    return {
      ...DEFAULT_RENDER_CONFIG,
      cellRenderers: {
        'multiple-placeholders': {
          type: 'replicable',
          matcher: {
            placeholderCount: { min: 2 },
          },
          options: {
            allowReplication: true,
            replicationMode: 'row',
            showCheckbox: true,
          },
        },
        default: {
          type: 'default',
          matcher: {},
        },
      },
      // 要素式模板也需要从非表格节点提取占位符（如段落中的占位符）
      placeholderExtraction: {
        extractFromNonTable: true,
        supportedNodeTypes: ['paragraph', 'heading', 'tableCell', 'tableHeader'],
      },
    }
  }

  if (isNarrativeStyle) {
    return {
      ...DEFAULT_RENDER_CONFIG,
      cellRenderers: {
        default: {
          type: 'narrative',
          matcher: {},
          options: {
            allowReplication: true,
            replicationMode: 'paragraph',
          },
        },
      },
    }
  }

  if (isMixedStyle) {
    return {
      ...DEFAULT_RENDER_CONFIG,
      cellRenderers: {
        default: {
          type: 'default',
          matcher: {},
        },
      },
      // 混合式模板需要从非表格节点提取占位符
      placeholderExtraction: {
        extractFromNonTable: true,
        supportedNodeTypes: ['paragraph', 'heading', 'tableCell', 'tableHeader', 'bulletList', 'orderedList'],
      },
    }
  }

  return DEFAULT_RENDER_CONFIG
}

