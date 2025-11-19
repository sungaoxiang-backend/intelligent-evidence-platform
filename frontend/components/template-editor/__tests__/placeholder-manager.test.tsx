"use client"

import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { PlaceholderProvider, usePlaceholderManager } from "../placeholder-manager"
import { templateApi } from "@/lib/template-api"

vi.mock("@/lib/template-api", () => ({
  templateApi: {
    getPlaceholders: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    createOrUpdatePlaceholder: vi.fn(),
    associatePlaceholderToTemplate: vi.fn(),
    updatePlaceholder: vi.fn(),
    disassociatePlaceholderFromTemplate: vi.fn(),
    deletePlaceholder: vi.fn(),
  },
}))

const createWrapper =
  (templateId: number | null = 1) =>
  ({ children }: { children: React.ReactNode }) =>
    <PlaceholderProvider templateId={templateId ?? undefined}>{children}</PlaceholderProvider>

describe("PlaceholderManager basic behavior", () => {
  it("syncs placeholders from doc content", () => {
    const { result } = renderHook(() => usePlaceholderManager(), {
      wrapper: createWrapper(1),
    })

    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello {{alpha}} and {{beta}}" }],
        },
      ],
    }

    act(() => result.current.syncFromDoc(doc))

    expect(result.current.orderedPlaceholders).toHaveLength(2)
    expect(result.current.orderedPlaceholders[0].fieldKey).toBe("alpha")
    expect(result.current.orderedPlaceholders[1].fieldKey).toBe("beta")
  })

  it("throws when templateId missing for createPlaceholder", async () => {
    const { result } = renderHook(() => usePlaceholderManager(), {
      wrapper: createWrapper(null),
    })

    await expect(
      result.current.createPlaceholder({
        placeholder_name: "alpha",
        type: "text",
      })
    ).rejects.toThrow("templateId is required for placeholder operations")
  })
})

describe("PlaceholderManager optimistic rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(templateApi.getPlaceholders as vi.Mock).mockResolvedValue({ data: [], total: 0 })
  })

  it("reverts backend snapshot when createPlaceholder fails", async () => {
    ;(templateApi.createOrUpdatePlaceholder as vi.Mock).mockRejectedValueOnce(
      new Error("create failed")
    )

    const { result } = renderHook(() => usePlaceholderManager(), {
      wrapper: createWrapper(1),
    })

    await act(async () => {
      await expect(
        result.current.createPlaceholder({
          placeholder_name: "alpha",
          type: "text",
        })
      ).rejects.toThrow("create failed")
    })

    expect(templateApi.associatePlaceholderToTemplate).not.toHaveBeenCalled()
    expect(result.current.orderedPlaceholders).toHaveLength(0)
  })

  it("restores previous label when updatePlaceholder fails", async () => {
    ;(templateApi.getPlaceholders as vi.Mock).mockResolvedValueOnce({
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
    ;(templateApi.updatePlaceholder as vi.Mock).mockRejectedValueOnce(
      new Error("update failed")
    )

    const { result } = renderHook(() => usePlaceholderManager(), {
      wrapper: createWrapper(1),
    })

    await waitFor(() => expect(result.current.orderedPlaceholders).toHaveLength(1))

    await act(async () => {
      await expect(
        result.current.updatePlaceholder("alpha", {
          placeholder_name: "beta",
          label: "被告姓名",
          type: "text",
        })
      ).rejects.toThrow("update failed")
    })

    const placeholder = result.current.orderedPlaceholders[0]
    expect(placeholder.fieldKey).toBe("alpha")
    expect(placeholder.label).toBe("原告姓名")
  })

  it("restores placeholder when detachPlaceholder fails", async () => {
    ;(templateApi.getPlaceholders as vi.Mock).mockResolvedValueOnce({
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
    ;(templateApi.disassociatePlaceholderFromTemplate as vi.Mock).mockRejectedValueOnce(
      new Error("remove failed")
    )

    const { result } = renderHook(() => usePlaceholderManager(), {
      wrapper: createWrapper(1),
    })

    await waitFor(() => expect(result.current.orderedPlaceholders).toHaveLength(1))

    await act(async () => {
      await expect(result.current.detachPlaceholder("alpha")).rejects.toThrow("remove failed")
    })

    expect(result.current.orderedPlaceholders).toHaveLength(1)
    expect(result.current.orderedPlaceholders[0].fieldKey).toBe("alpha")
  })

  it("reverts backend snapshot when deletePlaceholder fails", async () => {
    ;(templateApi.getPlaceholders as vi.Mock).mockResolvedValueOnce({
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
    ;(templateApi.deletePlaceholder as vi.Mock).mockRejectedValueOnce(new Error("delete failed"))

    const { result } = renderHook(() => usePlaceholderManager(), {
      wrapper: createWrapper(1),
    })

    await waitFor(() => expect(result.current.orderedPlaceholders).toHaveLength(1))

    await act(async () => {
      await expect(result.current.deletePlaceholder("alpha")).rejects.toThrow("delete failed")
    })

    expect(result.current.orderedPlaceholders).toHaveLength(1)
  })
})

