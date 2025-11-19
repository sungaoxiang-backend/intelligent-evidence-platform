"use client"

import React, { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DocumentEditor } from "../document-editor"
import { PlaceholderList } from "../placeholder-list"
import { PlaceholderProvider, usePlaceholderManager } from "../placeholder-manager"
import type { JSONContent } from "@tiptap/core"
import { templateApi } from "@/lib/template-api"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!(global as any).ResizeObserver) {
  ;(global as any).ResizeObserver = ResizeObserverMock
}

vi.mock("@/lib/template-api", () => ({
  templateApi: {
    getPlaceholders: vi.fn(),
    createOrUpdatePlaceholder: vi.fn(),
    associatePlaceholderToTemplate: vi.fn(),
    updatePlaceholder: vi.fn(),
    disassociatePlaceholderFromTemplate: vi.fn(),
  },
}))

const defaultDoc: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "示例文书。" }],
    },
  ],
}

const docWithAlpha: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "包含 {{alpha}} 字段。" }],
    },
  ],
}

const TestControls = () => {
  const manager = usePlaceholderManager()
  return (
    <div className="hidden">
      <button data-testid="detach-alpha-control" onClick={() => manager.detachPlaceholder("alpha")}>
        detach-alpha
      </button>
    </div>
  )
}

const Harness = ({ initialContent }: { initialContent: JSONContent }) => {
  const [json, setJson] = useState(initialContent)
  return (
    <PlaceholderProvider templateId={1}>
      <DocumentEditor initialContent={initialContent} onChange={setJson} />
      <PlaceholderList />
      <TestControls />
      <pre data-testid="editor-json">{JSON.stringify(json)}</pre>
    </PlaceholderProvider>
  )
}

describe("Placeholder end-to-end flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(templateApi.getPlaceholders as vi.Mock).mockResolvedValue({ data: [], total: 0 })
    ;(templateApi.createOrUpdatePlaceholder as vi.Mock).mockResolvedValue({
      data: { placeholder_name: "alpha" },
    })
    ;(templateApi.associatePlaceholderToTemplate as vi.Mock).mockResolvedValue({})
    ;(templateApi.updatePlaceholder as vi.Mock).mockResolvedValue({
      data: { placeholder_name: "beta" },
    })
    ;(templateApi.disassociatePlaceholderFromTemplate as vi.Mock).mockResolvedValue({})
  })

  it("creates placeholder via list and inserts text into editor", async () => {
    render(<Harness initialContent={defaultDoc} />)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(document.querySelector(".ProseMirror")).toBeTruthy()
    })
    const editorElement = document.querySelector(".ProseMirror") as HTMLElement
    await user.click(editorElement)
    await user.click(screen.getByRole("button", { name: "新建" }))

    await user.type(screen.getByLabelText("显示名称"), "原告姓名")
    await user.type(screen.getByLabelText("字段标识"), "alpha")
    await user.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() =>
      expect(templateApi.createOrUpdatePlaceholder).toHaveBeenCalledWith(
        expect.objectContaining({ placeholder_name: "alpha" })
      )
    )

    await waitFor(() => {
      expect(screen.getByTestId("editor-json").textContent).toContain("{{alpha}}")
    })
  })

  it("renames placeholder and updates document content", async () => {
    ;(templateApi.getPlaceholders as vi.Mock).mockResolvedValue({
      data: [
        {
          id: 1,
          placeholder_name: "alpha",
          label: "原告姓名",
          type: "text",
          required: true,
        },
      ],
      total: 1,
    })

    render(<Harness initialContent={docWithAlpha} />)
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByText(/原告姓名/)).toBeInTheDocument())

    await user.click(screen.getByTitle("编辑"))
    const fieldInput = screen.getByLabelText("字段标识")
    await user.clear(fieldInput)
    await user.type(fieldInput, "beta")
    await user.click(screen.getByRole("button", { name: "保存" }))

    await waitFor(() =>
      expect(templateApi.updatePlaceholder).toHaveBeenCalledWith(
        "alpha",
        expect.objectContaining({ placeholder_name: "beta" })
      )
    )

    await waitFor(() => {
      const json = screen.getByTestId("editor-json").textContent ?? ""
      expect(json).toContain("{{beta}}")
      expect(json).not.toContain("{{alpha}}")
    })
  })

  it("deletes placeholder and removes placeholder text", async () => {
    ;(templateApi.getPlaceholders as vi.Mock).mockResolvedValue({
      data: [
        {
          id: 1,
          placeholder_name: "alpha",
          label: "原告姓名",
          type: "text",
          required: false,
        },
      ],
      total: 1,
    })

    render(<Harness initialContent={docWithAlpha} />)
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByText(/原告姓名/)).toBeInTheDocument())

    await user.click(screen.getByTestId("detach-alpha-control"))

    await waitFor(() =>
      expect(templateApi.disassociatePlaceholderFromTemplate).toHaveBeenCalledWith(1, "alpha")
    )

    await waitFor(() => {
      expect(screen.getByTestId("editor-json").textContent).not.toContain("{{alpha}}")
    })
  })
})

