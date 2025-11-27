/**
 * 条件渲染系统
 * 支持基于表单数据的条件显示/隐藏
 */

import type { ConditionalRule } from "./template-render-config"

/**
 * 评估字段条件
 */
function evaluateFieldCondition(
  field: ConditionalRule["showWhen"]["field"],
  formData: Record<string, any>
): boolean {
  if (!field) {
    return true
  }

  const fieldValue = formData[field.name]
  const conditionValue = field.value

  switch (field.operator) {
    case "equals":
      return fieldValue === conditionValue
    case "notEquals":
      return fieldValue !== conditionValue
    case "contains":
      if (typeof fieldValue === "string" && typeof conditionValue === "string") {
        return fieldValue.includes(conditionValue)
      }
      return false
    case "in":
      if (Array.isArray(conditionValue)) {
        return conditionValue.includes(fieldValue)
      }
      return false
    case "notIn":
      if (Array.isArray(conditionValue)) {
        return !conditionValue.includes(fieldValue)
      }
      return true
    default:
      return false
  }
}

/**
 * 评估条件规则
 * 
 * @param rule 条件规则
 * @param formData 表单数据
 * @returns 是否应该显示目标节点
 */
export function evaluateCondition(
  rule: ConditionalRule,
  formData: Record<string, any>
): boolean {
  const { showWhen } = rule

  // 如果有字段条件，先评估字段条件
  if (showWhen.field) {
    return evaluateFieldCondition(showWhen.field, formData)
  }

  // 如果有组合条件
  if (showWhen.conditions && showWhen.conditions.length > 0) {
    const logic = showWhen.logic || "and"
    const results = showWhen.conditions.map((condition) =>
      evaluateCondition(condition, formData)
    )

    if (logic === "and") {
      return results.every((result) => result)
    } else if (logic === "or") {
      return results.some((result) => result)
    }
  }

  // 默认返回 true（如果没有条件，则显示）
  return true
}

/**
 * 评估多个条件规则
 * 
 * @param rules 条件规则列表
 * @param formData 表单数据
 * @returns 每个规则对应的显示状态映射
 */
export function evaluateConditions(
  rules: ConditionalRule[],
  formData: Record<string, any>
): Map<string, boolean> {
  const results = new Map<string, boolean>()

  rules.forEach((rule) => {
    const selector = rule.target.selector
    const shouldShow = evaluateCondition(rule, formData)
    results.set(selector, shouldShow)
  })

  return results
}

/**
 * 获取条件规则依赖的字段列表
 * 用于优化：只在这些字段变化时重新评估条件
 * 
 * @param rules 条件规则列表
 * @returns 依赖的字段名称列表
 */
export function getConditionDependencies(rules: ConditionalRule[]): string[] {
  const dependencies = new Set<string>()

  function extractDependencies(rule: ConditionalRule) {
    if (rule.showWhen.field) {
      dependencies.add(rule.showWhen.field.name)
    }
    if (rule.showWhen.conditions) {
      rule.showWhen.conditions.forEach(extractDependencies)
    }
  }

  rules.forEach(extractDependencies)
  return Array.from(dependencies)
}

/**
 * 条件评估缓存
 * 用于优化性能，避免重复评估相同的条件
 */
export class ConditionEvaluationCache {
  private cache = new Map<string, { result: boolean; formDataHash: string }>()
  private maxCacheSize = 100

  /**
   * 获取缓存的评估结果
   */
  get(selector: string, formDataHash: string): boolean | null {
    const cached = this.cache.get(selector)
    if (cached && cached.formDataHash === formDataHash) {
      return cached.result
    }
    return null
  }

  /**
   * 设置缓存的评估结果
   */
  set(selector: string, formDataHash: string, result: boolean): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(selector, { result, formDataHash })
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 生成表单数据的哈希值（用于缓存键）
   */
  static hashFormData(formData: Record<string, any>): string {
    // 简单哈希：只考虑条件依赖的字段
    const relevantFields = Object.keys(formData).sort()
    return relevantFields
      .map((key) => `${key}:${JSON.stringify(formData[key])}`)
      .join("|")
  }
}

