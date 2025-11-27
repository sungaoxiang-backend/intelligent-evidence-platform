import { describe, it, expect } from "vitest"
import {
  extractPlaceholders,
  extractPlaceholdersWithDetails,
  extractPlaceholdersFromNodeTypes,
  type ExtractedPlaceholder,
} from "../placeholder-extraction"
import type { JSONContent } from "@tiptap/core"

describe("placeholder-extraction", () => {
  const createPlaceholderNode = (fieldKey: string): JSONContent => ({
    type: "placeholder",
    attrs: { fieldKey },
  })

  const createTextNode = (text: string): JSONContent => ({
    type: "text",
    text,
  })

  const createParagraphNode = (content: JSONContent[]): JSONContent => ({
    type: "paragraph",
    content,
  })

  const createTableCellNode = (content: JSONContent[]): JSONContent => ({
    type: "tableCell",
    content,
  })

  describe("extractPlaceholders", () => {
    it("should extract placeholders from table cells by default", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  createTableCellNode([createPlaceholderNode("name")]),
                  createTableCellNode([createPlaceholderNode("date")]),
                ],
              },
            ],
          },
        ],
      }

      const placeholders = extractPlaceholders(doc)
      expect(placeholders).toEqual(["date", "name"])
    })

    it("should extract placeholders from paragraphs when extractFromNonTable is true", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          createParagraphNode([createPlaceholderNode("name")]),
          createParagraphNode([createTextNode("Date: {{date}}")]),
        ],
      }

      const placeholders = extractPlaceholders(doc, { extractFromNonTable: true })
      expect(placeholders).toContain("name")
      expect(placeholders).toContain("date")
    })

    it("should not extract from paragraphs when extractFromNonTable is false", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          createParagraphNode([createPlaceholderNode("name")]),
        ],
      }

      const placeholders = extractPlaceholders(doc, { extractFromNonTable: false })
      expect(placeholders).not.toContain("name")
    })

    it("should extract placeholders from text with {{}} format", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          createTableCellNode([createTextNode("Name: {{name}}, Date: {{date}}")]),
        ],
      }

      const placeholders = extractPlaceholders(doc)
      expect(placeholders).toContain("name")
      expect(placeholders).toContain("date")
    })

    it("should return empty array for null doc", () => {
      const placeholders = extractPlaceholders(null)
      expect(placeholders).toEqual([])
    })

    it("should deduplicate placeholders", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          createTableCellNode([createPlaceholderNode("name")]),
          createTableCellNode([createPlaceholderNode("name")]),
        ],
      }

      const placeholders = extractPlaceholders(doc)
      expect(placeholders).toEqual(["name"])
    })
  })

  describe("extractPlaceholdersWithDetails", () => {
    it("should return detailed placeholder information", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          createTableCellNode([createPlaceholderNode("name")]),
        ],
      }

      const details = extractPlaceholdersWithDetails(doc)
      expect(details).toHaveLength(1)
      expect(details[0].fieldKey).toBe("name")
      expect(details[0].nodeType).toBe("placeholder")
      expect(details[0].path).toBeDefined()
    })

    it("should include position information for text placeholders", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          createTableCellNode([createTextNode("Name: {{name}}")]),
        ],
      }

      const details = extractPlaceholdersWithDetails(doc)
      expect(details).toHaveLength(1)
      expect(details[0].fieldKey).toBe("name")
      expect(details[0].position).toBeDefined()
      expect(details[0].position?.start).toBeGreaterThanOrEqual(0)
    })
  })

  describe("extractPlaceholdersFromNodeTypes", () => {
    it("should extract only from specified node types", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          createParagraphNode([createPlaceholderNode("name")]),
          createTableCellNode([createPlaceholderNode("date")]),
        ],
      }

      const placeholders = extractPlaceholdersFromNodeTypes(doc, ["paragraph"])
      expect(placeholders).toContain("name")
      expect(placeholders).not.toContain("date")
    })

    it("should extract from multiple node types", () => {
      const doc: JSONContent = {
        type: "doc",
        content: [
          createParagraphNode([createPlaceholderNode("name")]),
          {
            type: "heading",
            attrs: { level: 1 },
            content: [createPlaceholderNode("title")],
          },
        ],
      }

      const placeholders = extractPlaceholdersFromNodeTypes(doc, ["paragraph", "heading"])
      expect(placeholders).toContain("name")
      expect(placeholders).toContain("title")
    })
  })
})

