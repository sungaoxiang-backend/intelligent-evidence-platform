import { describe, it, expect } from "vitest"
import {
  detectContentType,
  extractContentTypes,
  hasMixedContent,
  getContentTypeStats,
} from "../content-type-detector"
import type { JSONContent } from "@tiptap/core"

describe("content-type-detector", () => {
  describe("detectContentType", () => {
    it("should detect table type", () => {
      const node: JSONContent = { type: "table", content: [] }
      expect(detectContentType(node)).toBe("table")
    })

    it("should detect paragraph type", () => {
      const node: JSONContent = { type: "paragraph", content: [] }
      expect(detectContentType(node)).toBe("paragraph")
    })

    it("should detect heading type", () => {
      const node: JSONContent = { type: "heading", attrs: { level: 1 }, content: [] }
      expect(detectContentType(node)).toBe("heading")
    })

    it("should detect list type for bulletList", () => {
      const node: JSONContent = { type: "bulletList", content: [] }
      expect(detectContentType(node)).toBe("list")
    })

    it("should detect list type for orderedList", () => {
      const node: JSONContent = { type: "orderedList", content: [] }
      expect(detectContentType(node)).toBe("list")
    })

    it("should return other for unknown types", () => {
      const node: JSONContent = { type: "unknown", content: [] }
      expect(detectContentType(node)).toBe("other")
    })
  })

  describe("extractContentTypes", () => {
    it("should extract content types from document", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          { type: "paragraph", content: [] },
          { type: "table", content: [] },
          { type: "heading", attrs: { level: 1 }, content: [] },
        ],
      }

      const types = extractContentTypes(doc)
      expect(types).toHaveLength(3)
      expect(types[0].type).toBe("paragraph")
      expect(types[1].type).toBe("table")
      expect(types[2].type).toBe("heading")
    })

    it("should return empty array for null doc", () => {
      expect(extractContentTypes(null)).toEqual([])
    })

    it("should include path information", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          { type: "paragraph", content: [] },
        ],
      }

      const types = extractContentTypes(doc)
      expect(types[0].path).toEqual([0])
    })
  })

  describe("hasMixedContent", () => {
    it("should return true for mixed content", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          { type: "paragraph", content: [] },
          { type: "table", content: [] },
        ],
      }

      expect(hasMixedContent(doc)).toBe(true)
    })

    it("should return false for single content type", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          { type: "paragraph", content: [] },
          { type: "paragraph", content: [] },
        ],
      }

      expect(hasMixedContent(doc)).toBe(false)
    })

    it("should return false for null doc", () => {
      expect(hasMixedContent(null)).toBe(false)
    })
  })

  describe("getContentTypeStats", () => {
    it("should count content types", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          { type: "paragraph", content: [] },
          { type: "paragraph", content: [] },
          { type: "table", content: [] },
          { type: "heading", attrs: { level: 1 }, content: [] },
        ],
      }

      const stats = getContentTypeStats(doc)
      expect(stats.paragraph).toBe(2)
      expect(stats.table).toBe(1)
      expect(stats.heading).toBe(1)
      expect(stats.list).toBe(0)
      expect(stats.other).toBe(0)
    })

    it("should return zero stats for null doc", () => {
      const stats = getContentTypeStats(null)
      expect(stats.table).toBe(0)
      expect(stats.paragraph).toBe(0)
      expect(stats.heading).toBe(0)
      expect(stats.list).toBe(0)
      expect(stats.other).toBe(0)
    })
  })
})

