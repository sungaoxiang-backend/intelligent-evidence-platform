import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { DocumentPreview } from "../document-preview"

const SAMPLE_DOC = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "预览 {{alpha}} 内容。" },
      ],
    },
  ],
}

describe("DocumentPreview", () => {
  it("renders raw placeholder braces without interactive chip", async () => {
    const { container } = render(<DocumentPreview content={SAMPLE_DOC} />)

    await waitFor(() => {
      expect(screen.getByText(/{{alpha}}/)).toBeInTheDocument()
    })

    expect(container.querySelector(".template-placeholder-chip")).toBeNull()
  })
})

