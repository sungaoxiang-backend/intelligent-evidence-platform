import type { JSONContent } from "@tiptap/core"

export const normalizeHardBreaks = (
  node?: JSONContent | null
): JSONContent | null => {
  if (!node) return node ?? null

  const clone: JSONContent = { ...node }
  if (!clone.content) {
    return clone
  }

  const normalizedChildren: JSONContent[] = []
  for (const child of clone.content) {
    if (child.type === "text" && typeof child.text === "string" && child.text.includes("\n")) {
      const parts = child.text.split("\n")
      parts.forEach((part, idx) => {
        if (part) {
          normalizedChildren.push({
            ...child,
            text: part,
          })
        }
        if (idx < parts.length - 1) {
          normalizedChildren.push({ type: "hardBreak" })
        }
      })
    } else {
      normalizedChildren.push(
        normalizeHardBreaks(child) as JSONContent
      )
    }
  }

  return {
    ...clone,
    content: normalizedChildren,
  }
}

