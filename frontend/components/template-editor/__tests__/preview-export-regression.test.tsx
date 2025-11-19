"use client"

import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { DocumentPreview } from "../document-preview"
import { templateApi } from "@/lib/template-api"

describe("Preview & export regression", () => {
  const docWithAlpha = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "预览 {{alpha}} 字段" }],
      },
    ],
  }

  const docWithBeta = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "切换后 {{beta}} 字段" }],
      },
    ],
  }

  it("keeps preview mode free of placeholder chips when toggling content", async () => {
    const { rerender, container } = render(<DocumentPreview content={docWithAlpha} />)

    await waitFor(() => expect(screen.getByText(/{{alpha}}/)).toBeInTheDocument())
    expect(container.querySelector(".template-placeholder-chip")).toBeNull()

    rerender(<DocumentPreview content={docWithBeta} />)
    await waitFor(() => expect(screen.getByText(/{{beta}}/)).toBeInTheDocument())
    expect(container.querySelector(".template-placeholder-chip")).toBeNull()
  })

  it("sends raw placeholder text when exporting docx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob()),
      json: vi.fn(),
    })
    vi.stubGlobal("fetch", fetchMock)

    const sample = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "导出 {{gamma}} 保持原样" }],
        },
      ],
    }

    await templateApi.exportDocx(sample, "sample.docx")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0]
    const payload = JSON.parse(options.body)
    expect(JSON.stringify(payload.prosemirror_json)).toContain("{{gamma}}")
    expect(payload.filename).toBe("sample.docx")

    vi.unstubAllGlobals()
  })
})

