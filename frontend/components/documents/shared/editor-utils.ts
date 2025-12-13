import type { JSONContent } from "@tiptap/core"

/**
 * 清理空文本节点
 * tiptap 不允许空的文本节点，需要移除它们
 */
export const removeEmptyTextNodes = (
  node?: JSONContent | null
): JSONContent | null => {
  if (!node) return node ?? null

  // 如果是文本节点且为空，返回 null（表示应该被移除）
  if (node.type === "text") {
    // 检查文本是否为空或只包含空白字符
    if (!node.text || (typeof node.text === "string" && node.text.trim() === "")) {
      return null
    }
    return node
  }

  const clone: JSONContent = { ...node }
  
  // 如果没有内容数组，直接返回（保留节点但无内容）
  if (!clone.content || clone.content.length === 0) {
    return clone
  }

  // 递归处理子节点
  const cleanedChildren: JSONContent[] = []
  for (const child of clone.content) {
    const cleaned = removeEmptyTextNodes(child)
    // 只添加非 null 的子节点
    if (cleaned !== null) {
      cleanedChildren.push(cleaned)
    }
  }

  // 返回清理后的节点，即使内容数组为空也是有效的（某些节点类型允许空内容）
  return {
    ...clone,
    content: cleanedChildren,
  }
}

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

/**
 * 规范化内容：先清理空文本节点，再处理硬换行
 */
export const normalizeContent = (
  node?: JSONContent | null
): JSONContent | null => {
  if (!node) return node ?? null
  
  // 先清理空文本节点
  const cleaned = removeEmptyTextNodes(node)
  if (!cleaned) return null
  
  // 再处理硬换行
  return normalizeHardBreaks(cleaned)
}

