"use client"

import type { JSONContent } from "@tiptap/core"

const PLACEHOLDER_REGEX = /\{\{\s*([^\}]+?)\s*\}\}/g

const ensureDoc = (doc?: JSONContent | null): JSONContent => {
  if (!doc) {
    return {
      type: "doc",
      content: [],
    }
  }
  return JSON.parse(JSON.stringify(doc))
}

const cloneNode = (node: JSONContent): JSONContent => JSON.parse(JSON.stringify(node))

const convertTextNodeToPlaceholderSequence = (node: JSONContent): JSONContent[] => {
  if (typeof node.text !== "string" || node.text.length === 0) {
    return [{ ...node }]
  }

  const matches: JSONContent[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = PLACEHOLDER_REGEX.exec(node.text)) !== null) {
    const matchIndex = match.index ?? 0
    if (matchIndex > lastIndex) {
      const plainText = node.text.slice(lastIndex, matchIndex)
      if (plainText) {
        matches.push({
          ...node,
          text: plainText,
        })
      }
    }

    const fieldKey = (match[1] || "").trim()
    if (fieldKey) {
      matches.push({
        type: "placeholder",
        attrs: {
          fieldKey,
        },
      })
    } else {
      matches.push({
        ...node,
        text: match[0],
      })
    }

    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < node.text.length) {
    const trailing = node.text.slice(lastIndex)
    if (trailing) {
      matches.push({
        ...node,
        text: trailing,
      })
    }
  }

  if (matches.length === 0) {
    return [{ ...node }]
  }

  return matches
}

const convertNodesToPlaceholders = (node: JSONContent): JSONContent | JSONContent[] => {
  if (!node) return node

  if (node.type === "placeholder") {
    const fieldKey = node.attrs?.fieldKey
    if (!fieldKey) {
      return {
        type: "placeholder",
        attrs: { fieldKey: "" },
      }
    }
    return {
      type: "placeholder",
      attrs: { fieldKey },
    }
  }

  if (node.type === "text") {
    return convertTextNodeToPlaceholderSequence(node)
  }

  if (node.content && Array.isArray(node.content)) {
    const newContent: JSONContent[] = []
    node.content.forEach((child) => {
      const converted = convertNodesToPlaceholders(child)
      if (Array.isArray(converted)) {
        newContent.push(...converted)
      } else if (converted) {
        newContent.push(converted)
      }
    })
    return {
      ...node,
      content: newContent,
    }
  }

  return cloneNode(node)
}

const convertPlaceholderNodeToText = (node: JSONContent): JSONContent => {
  const fieldKey = (node.attrs?.fieldKey || "").trim()
  const text = fieldKey ? `{{${fieldKey}}}` : "{{}}"
  return {
    type: "text",
    text,
  }
}

const convertNodesToPlainText = (node: JSONContent): JSONContent => {
  if (!node) return node

  if (node.type === "placeholder") {
    return convertPlaceholderNodeToText(node)
  }

  if (node.type === "text") {
    return cloneNode(node)
  }

  if (node.content && Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content.map((child) => convertNodesToPlainText(child)),
    }
  }

  return cloneNode(node)
}

export const convertTextToPlaceholderNodes = (doc?: JSONContent | null): JSONContent => {
  const base = ensureDoc(doc)
  const converted = convertNodesToPlaceholders(base)
  return Array.isArray(converted) ? ensureDoc() : converted
}

export const convertPlaceholderNodesToText = (doc?: JSONContent | null): JSONContent => {
  const base = ensureDoc(doc)
  return convertNodesToPlainText(base)
}

export const cloneJsonContent = (doc?: JSONContent | null): JSONContent => ensureDoc(doc)


