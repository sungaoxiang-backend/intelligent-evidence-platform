import { describe, it, expect } from "vitest"
import { generateDefaultConfigFromType } from "../template-render-config"

describe("template-render-config - 混合式模板配置", () => {
  it("混合式模板应该启用 extractFromNonTable", () => {
    const config = generateDefaultConfigFromType("混合式")
    
    expect(config.placeholderExtraction).toBeDefined()
    expect(config.placeholderExtraction?.extractFromNonTable).toBe(true)
    expect(config.placeholderExtraction?.supportedNodeTypes).toContain("paragraph")
    expect(config.placeholderExtraction?.supportedNodeTypes).toContain("heading")
    expect(config.placeholderExtraction?.supportedNodeTypes).toContain("tableCell")
  })

  it("混合式模板应该支持多种节点类型", () => {
    const config = generateDefaultConfigFromType("混合式")
    
    const supportedTypes = config.placeholderExtraction?.supportedNodeTypes || []
    expect(supportedTypes).toContain("paragraph")
    expect(supportedTypes).toContain("heading")
    expect(supportedTypes).toContain("tableCell")
    expect(supportedTypes).toContain("tableHeader")
    expect(supportedTypes).toContain("bulletList")
    expect(supportedTypes).toContain("orderedList")
  })
})

