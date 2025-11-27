/**
 * 模板配置加载器
 * 负责加载、解析和合并模板渲染配置
 */

import type { TemplateRenderConfig } from "./template-render-config"
import {
  DEFAULT_RENDER_CONFIG,
  generateDefaultConfigFromType,
  mergeRenderConfig,
} from "./template-render-config"

/**
 * 从模板元数据加载配置
 * 
 * @param templateMetadata 模板元数据（可能包含 renderConfig 字段）
 * @param templateCategory 模板类型（用于生成默认配置）
 * @returns 合并后的渲染配置
 */
export function loadTemplateRenderConfig(
  templateMetadata?: {
    renderConfig?: Partial<TemplateRenderConfig>
    category?: string | null
  } | null,
  templateCategory?: string | null
): TemplateRenderConfig {
  // 获取模板类型
  const category = templateMetadata?.category || templateCategory

  // 生成默认配置（基于模板类型）
  const defaultConfig = generateDefaultConfigFromType(category)

  // 如果有模板特定配置，则合并
  if (templateMetadata?.renderConfig) {
    return mergeRenderConfig(templateMetadata.renderConfig, defaultConfig)
  }

  return defaultConfig
}

/**
 * 从 JSON 字符串解析配置
 * 
 * @param configJson 配置 JSON 字符串
 * @returns 解析后的配置对象
 */
export function parseRenderConfig(configJson: string): Partial<TemplateRenderConfig> {
  try {
    return JSON.parse(configJson) as Partial<TemplateRenderConfig>
  } catch (error) {
    console.warn("Failed to parse render config:", error)
    return {}
  }
}

/**
 * 验证配置的有效性
 * 
 * @param config 要验证的配置
 * @returns 验证结果和错误信息
 */
export function validateRenderConfig(
  config: Partial<TemplateRenderConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 验证 cellRenderers
  if (config.cellRenderers) {
    Object.entries(config.cellRenderers).forEach(([key, renderer]) => {
      if (!renderer.type) {
        errors.push(`Cell renderer "${key}" missing type`)
      }
      if (!renderer.matcher) {
        errors.push(`Cell renderer "${key}" missing matcher`)
      }
    })
  }

  // 验证 conditionalRendering
  if (config.conditionalRendering) {
    config.conditionalRendering.forEach((rule, index) => {
      if (!rule.target) {
        errors.push(`Conditional rule ${index} missing target`)
      }
      if (!rule.showWhen) {
        errors.push(`Conditional rule ${index} missing showWhen`)
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * 获取配置的摘要信息（用于调试）
 * 
 * @param config 配置对象
 * @returns 配置摘要
 */
export function getConfigSummary(config: TemplateRenderConfig): {
  cellRendererCount: number
  conditionalRuleCount: number
  extractFromNonTable: boolean
  supportedNodeTypes: string[]
} {
  return {
    cellRendererCount: Object.keys(config.cellRenderers || {}).length,
    conditionalRuleCount: config.conditionalRendering?.length || 0,
    extractFromNonTable: config.placeholderExtraction?.extractFromNonTable || false,
    supportedNodeTypes: config.placeholderExtraction?.supportedNodeTypes || [],
  }
}

