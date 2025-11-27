import { describe, it, expect } from "vitest"
import {
  matchCellRenderer,
  isMergedCell,
  getCellMergeInfo,
} from "../cell-renderer-registry"
import type { JSONContent } from "@tiptap/core"
import type { TemplateRenderConfig } from "../template-render-config"

describe("cell-renderer-registry", () => {
  const createCellNode = (placeholders: string[] = [], attrs: any = {}): JSONContent => ({
    type: "tableCell",
    attrs,
    content: placeholders.map((name) => ({
      type: "paragraph",
      content: [
        {
          type: "placeholder",
          attrs: { fieldKey: name },
        },
      ],
    })),
  })

  describe("matchCellRenderer", () => {
    it("should match renderer by placeholder count", () => {
      const config: TemplateRenderConfig = {
        cellRenderers: {
          "multiple-placeholders": {
            type: "replicable",
            matcher: {
              placeholderCount: { min: 2 },
            },
            options: {
              allowReplication: true,
            },
          },
          default: {
            type: "default",
            matcher: {},
          },
        },
      }

      const cellWithMultiple = createCellNode(["name", "date"])
      const renderer = matchCellRenderer(cellWithMultiple, config)
      expect(renderer?.type).toBe("replicable")

      const cellWithOne = createCellNode(["name"])
      const defaultRenderer = matchCellRenderer(cellWithOne, config)
      expect(defaultRenderer?.type).toBe("default")
    })

    it("should match renderer by placeholder names", () => {
      const config: TemplateRenderConfig = {
        cellRenderers: {
          "defendant-type": {
            type: "conditional",
            matcher: {
              placeholderNames: ["defendant_type"],
            },
            options: {},
          },
          default: {
            type: "default",
            matcher: {},
          },
        },
      }

      const cellWithDefendantType = createCellNode(["defendant_type"])
      const renderer = matchCellRenderer(cellWithDefendantType, config)
      expect(renderer?.type).toBe("conditional")

      const cellWithOther = createCellNode(["name"])
      const defaultRenderer = matchCellRenderer(cellWithOther, config)
      expect(defaultRenderer?.type).toBe("default")
    })

    it("should match renderer by content pattern", () => {
      const config: TemplateRenderConfig = {
        cellRenderers: {
          "text-cell": {
            type: "narrative",
            matcher: {
              contentPattern: "诉讼请求",
            },
            options: {},
          },
          default: {
            type: "default",
            matcher: {},
          },
        },
      }

      const cellWithText: JSONContent = {
        type: "tableCell",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "诉讼请求：",
              },
            ],
          },
        ],
      }

      const renderer = matchCellRenderer(cellWithText, config)
      expect(renderer?.type).toBe("narrative")
    })

    it("should return default renderer when no matcher matches", () => {
      const config: TemplateRenderConfig = {
        cellRenderers: {
          "specific": {
            type: "replicable",
            matcher: {
              placeholderCount: { min: 5 },
            },
            options: {},
          },
          default: {
            type: "default",
            matcher: {},
          },
        },
      }

      const cell = createCellNode(["name"])
      const renderer = matchCellRenderer(cell, config)
      expect(renderer?.type).toBe("default")
    })

    it("should generate default renderer from template type when no config", () => {
      const config: TemplateRenderConfig = {
        cellRenderers: {},
      }

      const cell = createCellNode(["name"])
      const elementRenderer = matchCellRenderer(cell, config, "要素式")
      expect(elementRenderer?.type).toBe("replicable")

      const narrativeRenderer = matchCellRenderer(cell, config, "陈述式")
      expect(narrativeRenderer?.type).toBe("narrative")
    })
  })

  describe("isMergedCell", () => {
    it("should detect merged cells by colspan", () => {
      const cell: JSONContent = {
        type: "tableCell",
        attrs: { colspan: 2, rowspan: 1 },
        content: [],
      }

      expect(isMergedCell(cell)).toBe(true)
    })

    it("should detect merged cells by rowspan", () => {
      const cell: JSONContent = {
        type: "tableCell",
        attrs: { colspan: 1, rowspan: 2 },
        content: [],
      }

      expect(isMergedCell(cell)).toBe(true)
    })

    it("should return false for non-merged cells", () => {
      const cell: JSONContent = {
        type: "tableCell",
        attrs: { colspan: 1, rowspan: 1 },
        content: [],
      }

      expect(isMergedCell(cell)).toBe(false)
    })
  })

  describe("getCellMergeInfo", () => {
    it("should return merge information", () => {
      const cell: JSONContent = {
        type: "tableCell",
        attrs: { colspan: 3, rowspan: 2 },
        content: [],
      }

      const info = getCellMergeInfo(cell)
      expect(info.colspan).toBe(3)
      expect(info.rowspan).toBe(2)
    })

    it("should return default values when attrs are missing", () => {
      const cell: JSONContent = {
        type: "tableCell",
        attrs: {},
        content: [],
      }

      const info = getCellMergeInfo(cell)
      expect(info.colspan).toBe(1)
      expect(info.rowspan).toBe(1)
    })
  })
})

