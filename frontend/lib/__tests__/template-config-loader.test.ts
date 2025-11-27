import { describe, it, expect } from "vitest"
import {
  loadTemplateRenderConfig,
  parseRenderConfig,
  validateRenderConfig,
  getConfigSummary,
} from "../template-config-loader"
import type { TemplateRenderConfig } from "../template-render-config"

describe("template-config-loader", () => {
  describe("loadTemplateRenderConfig", () => {
    it("should load default config when no metadata provided", () => {
      const config = loadTemplateRenderConfig()
      expect(config).toBeDefined()
      expect(config.cellRenderers).toBeDefined()
    })

    it("should generate config based on template category", () => {
      const config = loadTemplateRenderConfig({ category: "要素式" })
      expect(config.cellRenderers).toBeDefined()
      expect(config.cellRenderers?.["multiple-placeholders"]).toBeDefined()
    })

    it("should merge template config with default config", () => {
      const metadata = {
        category: "要素式",
        renderConfig: {
          placeholderExtraction: {
            extractFromNonTable: true,
            supportedNodeTypes: ["paragraph"],
          },
        },
      }

      const config = loadTemplateRenderConfig(metadata)
      expect(config.placeholderExtraction?.extractFromNonTable).toBe(true)
      expect(config.placeholderExtraction?.supportedNodeTypes).toEqual(["paragraph"])
    })

    it("should use templateCategory parameter when metadata category is missing", () => {
      const config = loadTemplateRenderConfig({}, "陈述式")
      expect(config.cellRenderers?.default.type).toBe("narrative")
    })
  })

  describe("parseRenderConfig", () => {
    it("should parse valid JSON config", () => {
      const json = JSON.stringify({
        placeholderExtraction: {
          extractFromNonTable: true,
        },
      })

      const config = parseRenderConfig(json)
      expect(config.placeholderExtraction?.extractFromNonTable).toBe(true)
    })

    it("should return empty object for invalid JSON", () => {
      const config = parseRenderConfig("invalid json")
      expect(config).toEqual({})
    })

    it("should handle empty string", () => {
      const config = parseRenderConfig("")
      expect(config).toEqual({})
    })
  })

  describe("validateRenderConfig", () => {
    it("should validate correct config", () => {
      const config: Partial<TemplateRenderConfig> = {
        cellRenderers: {
          default: {
            type: "default",
            matcher: {},
          },
        },
      }

      const result = validateRenderConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("should detect missing type in cell renderer", () => {
      const config: Partial<TemplateRenderConfig> = {
        cellRenderers: {
          default: {
            type: undefined as any,
            matcher: {},
          },
        },
      }

      const result = validateRenderConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it("should detect missing matcher in cell renderer", () => {
      const config: Partial<TemplateRenderConfig> = {
        cellRenderers: {
          default: {
            type: "default",
            matcher: undefined as any,
          },
        },
      }

      const result = validateRenderConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it("should validate conditional rules", () => {
      const config: Partial<TemplateRenderConfig> = {
        conditionalRendering: [
          {
            target: { type: "section", selector: "test" },
            showWhen: {
              field: { name: "type", operator: "equals", value: "natural" },
            },
          },
        ],
      }

      const result = validateRenderConfig(config)
      expect(result.valid).toBe(true)
    })

    it("should detect missing target in conditional rule", () => {
      const config: Partial<TemplateRenderConfig> = {
        conditionalRendering: [
          {
            target: undefined as any,
            showWhen: {
              field: { name: "type", operator: "equals", value: "natural" },
            },
          },
        ],
      }

      const result = validateRenderConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe("getConfigSummary", () => {
    it("should return config summary", () => {
      const config: TemplateRenderConfig = {
        cellRenderers: {
          default: { type: "default", matcher: {} },
          custom: { type: "custom", matcher: {} },
        },
        conditionalRendering: [
          {
            target: { type: "section", selector: "test" },
            showWhen: { field: { name: "type", operator: "equals", value: "natural" } },
          },
        ],
        placeholderExtraction: {
          extractFromNonTable: true,
          supportedNodeTypes: ["paragraph", "heading"],
        },
      }

      const summary = getConfigSummary(config)
      expect(summary.cellRendererCount).toBe(2)
      expect(summary.conditionalRuleCount).toBe(1)
      expect(summary.extractFromNonTable).toBe(true)
      expect(summary.supportedNodeTypes).toEqual(["paragraph", "heading"])
    })
  })
})

