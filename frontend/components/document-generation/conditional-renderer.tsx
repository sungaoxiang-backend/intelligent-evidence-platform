/**
 * 条件渲染组件
 * 根据条件规则显示/隐藏内容
 */

"use client"

import React, { useMemo } from "react"
import type { ConditionalRule } from "@/lib/template-render-config"
import { evaluateCondition } from "@/lib/conditional-rendering"

interface ConditionalRendererProps {
  /** 条件规则 */
  rule: ConditionalRule
  /** 表单数据 */
  formData: Record<string, any>
  /** 子元素 */
  children: React.ReactNode
  /** 自定义类名 */
  className?: string
}

/**
 * 条件渲染组件
 * 根据条件规则显示/隐藏子元素
 */
export function ConditionalRenderer({
  rule,
  formData,
  children,
  className,
}: ConditionalRendererProps) {
  const shouldShow = useMemo(() => {
    return evaluateCondition(rule, formData)
  }, [rule, formData])

  if (!shouldShow) {
    // 根据 hideBehavior 决定如何隐藏
    const hideBehavior = rule.hideBehavior || "display-none"

    if (hideBehavior === "remove") {
      return null
    }

    if (hideBehavior === "display-none") {
      return (
        <div className={className} style={{ display: "none" }}>
          {children}
        </div>
      )
    }

    if (hideBehavior === "collapse") {
      return (
        <div className={className} style={{ visibility: "hidden", height: 0, overflow: "hidden" }}>
          {children}
        </div>
      )
    }

    return null
  }

  return <div className={className}>{children}</div>
}

interface ConditionalSectionProps {
  /** 选择器（用于匹配条件规则） */
  selector: string
  /** 条件规则列表 */
  rules: ConditionalRule[]
  /** 表单数据 */
  formData: Record<string, any>
  /** 子元素 */
  children: React.ReactNode
  /** 自定义类名 */
  className?: string
}

/**
 * 条件渲染区域组件
 * 根据选择器匹配条件规则并渲染
 */
export function ConditionalSection({
  selector,
  rules,
  formData,
  children,
  className,
}: ConditionalSectionProps) {
  // 查找匹配的规则
  const matchingRule = useMemo(() => {
    return rules.find((rule) => rule.target.selector === selector)
  }, [selector, rules])

  if (!matchingRule) {
    // 如果没有匹配的规则，默认显示
    return <div className={className}>{children}</div>
  }

  return (
    <ConditionalRenderer rule={matchingRule} formData={formData} className={className}>
      {children}
    </ConditionalRenderer>
  )
}

