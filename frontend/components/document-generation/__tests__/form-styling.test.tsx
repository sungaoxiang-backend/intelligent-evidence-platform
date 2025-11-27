import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { DocumentPreviewForm } from "../document-preview-form"
import type { JSONContent } from "@tiptap/core"
import type { PlaceholderInfo } from "../placeholder-form-fields"

/**
 * 测试表单样式和输入框显示
 */
describe("表单样式和输入框显示", () => {
  const createTableTemplate = (): JSONContent => ({
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableCell",
                attrs: { colspan: 1, rowspan: 1 },
                content: [
                  {
                    type: "paragraph",
                    content: [
                      { type: "text", text: "案号：" },
                      {
                        type: "placeholder",
                        attrs: { fieldKey: "case_number" },
                      },
                    ],
                  },
                ],
              },
              {
                type: "tableCell",
                attrs: { colspan: 1, rowspan: 1 },
                content: [
                  {
                    type: "paragraph",
                    content: [
                      { type: "text", text: "案由：" },
                      {
                        type: "placeholder",
                        attrs: { fieldKey: "case_type" },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  })

  const placeholders: PlaceholderInfo[] = [
    { id: 1, name: "case_number", type: "text" },
    { id: 2, name: "case_type", type: "text" },
  ]

  it("混合式模板应该使用自动表格布局", () => {
    const template = createTableTemplate()
    const { container } = render(
      <DocumentPreviewForm
        content={template}
        placeholders={placeholders}
        formData={{}}
        templateCategory="混合式"
      />
    )

    const table = container.querySelector(".template-doc table")
    expect(table).toBeTruthy()
    
    // 检查表格样式
    const computedStyle = window.getComputedStyle(table as HTMLElement)
    expect(computedStyle.tableLayout).toBe("auto")
  })

  it("表格单元格应该有足够的最小宽度", () => {
    const template = createTableTemplate()
    const { container } = render(
      <DocumentPreviewForm
        content={template}
        placeholders={placeholders}
        formData={{}}
        templateCategory="混合式"
      />
    )

    const cells = container.querySelectorAll(".template-doc table td")
    cells.forEach((cell) => {
      const computedStyle = window.getComputedStyle(cell as HTMLElement)
      const minWidth = parseInt(computedStyle.minWidth) || 0
      expect(minWidth).toBeGreaterThanOrEqual(100)
    })
  })

  it("输入框应该有足够的最小宽度", () => {
    const template = createTableTemplate()
    const { container } = render(
      <DocumentPreviewForm
        content={template}
        placeholders={placeholders}
        formData={{}}
        templateCategory="混合式"
      />
    )

    // 等待输入框渲染
    setTimeout(() => {
      const inputs = container.querySelectorAll(".template-doc input")
      inputs.forEach((input) => {
        const computedStyle = window.getComputedStyle(input as HTMLElement)
        const minWidth = parseInt(computedStyle.minWidth) || 0
        expect(minWidth).toBeGreaterThanOrEqual(150)
      })
    }, 100)
  })
})

