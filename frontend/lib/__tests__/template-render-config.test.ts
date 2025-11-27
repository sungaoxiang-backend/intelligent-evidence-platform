import { describe, it, expect } from "vitest"
import {
  DEFAULT_RENDER_CONFIG,
  generateDefaultConfigFromType,
  mergeRenderConfig,
  type TemplateRenderConfig,
} from "../template-render-config"

describe("template-render-config", () => {
  describe("DEFAULT_RENDER_CONFIG", () => {
    it("should have default cell renderers", () => {
      expect(DEFAULT_RENDER_CONFIG.cellRenderers).toBeDefined()
      expect(DEFAULT_RENDER_CONFIG.cellRenderers?.default).toBeDefined()
      expect(DEFAULT_RENDER_CONFIG.cellRenderers?.default.type).toBe("auto")
    })

    it("should have default placeholder extraction config", () => {
      expect(DEFAULT_RENDER_CONFIG.placeholderExtraction).toBeDefined()
      expect(DEFAULT_RENDER_CONFIG.placeholderExtraction?.extractFromNonTable).toBe(false)
      expect(DEFAULT_RENDER_CONFIG.placeholderExtraction?.supportedNodeTypes).toEqual([
        "tableCell",
        "tableHeader",
      ])
    })
  })

  describe("generateDefaultConfigFromType", () => {
    it("should generate element-style config for 要素式", () => {
      const config = generateDefaultConfigFromType("要素式")
      expect(config.cellRenderers).toBeDefined()
      expect(config.cellRenderers?.["multiple-placeholders"]).toBeDefined()
      expect(config.cellRenderers?.["multiple-placeholders"].type).toBe("replicable")
    })

    it("should generate narrative-style config for 陈述式", () => {
      const config = generateDefaultConfigFromType("陈述式")
      expect(config.cellRenderers).toBeDefined()
      expect(config.cellRenderers?.default.type).toBe("narrative")
    })

    it("should generate mixed-style config for 混合式", () => {
      const config = generateDefaultConfigFromType("混合式")
      expect(config.cellRenderers).toBeDefined()
      expect(config.cellRenderers?.default.type).toBe("default")
    })

    it("should generate default config for unknown type", () => {
      const config = generateDefaultConfigFromType("unknown")
      expect(config).toEqual(DEFAULT_RENDER_CONFIG)
    })

    it("should handle null category", () => {
      const config = generateDefaultConfigFromType(null)
      expect(config).toEqual(DEFAULT_RENDER_CONFIG)
    })
  })

  describe("mergeRenderConfig", () => {
    it("should merge template config with default config", () => {
      const templateConfig: Partial<TemplateRenderConfig> = {
        placeholderExtraction: {
          extractFromNonTable: true,
          supportedNodeTypes: ["paragraph", "heading"],
        },
      }

      const merged = mergeRenderConfig(templateConfig)
      expect(merged.placeholderExtraction?.extractFromNonTable).toBe(true)
      expect(merged.placeholderExtraction?.supportedNodeTypes).toEqual(["paragraph", "heading"])
      expect(merged.cellRenderers).toBeDefined() // Should keep default cell renderers
    })

    it("should return default config when template config is undefined", () => {
      const merged = mergeRenderConfig(undefined)
      expect(merged).toEqual(DEFAULT_RENDER_CONFIG)
    })

    it("should merge cell renderers", () => {
      const templateConfig: Partial<TemplateRenderConfig> = {
        cellRenderers: {
          custom: {
            type: "custom",
            matcher: {},
          },
        },
      }

      const merged = mergeRenderConfig(templateConfig)
      expect(merged.cellRenderers?.default).toBeDefined()
      expect(merged.cellRenderers?.custom).toBeDefined()
      expect(merged.cellRenderers?.custom.type).toBe("custom")
    })

    it("should override default config with template config", () => {
      const templateConfig: Partial<TemplateRenderConfig> = {
        tableRowConfig: {
          showCheckbox: true,
          checkboxPosition: "first-cell",
        },
      }

      const merged = mergeRenderConfig(templateConfig)
      expect(merged.tableRowConfig?.showCheckbox).toBe(true)
      expect(merged.tableRowConfig?.checkboxPosition).toBe("first-cell")
    })
  })
})

