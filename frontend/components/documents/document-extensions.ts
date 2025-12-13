/**
 * 统一的文档编辑器扩展配置
 * 确保所有环节（编辑、预览、导出）使用相同的扩展配置
 */

import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
// import Image from "@tiptap/extension-image"
import { ImageExtension } from "./extensions/image-extension"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import HardBreak from "@tiptap/extension-hard-break"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
} from "@/components/documents/shared/editor-extensions"
import { FontSize } from "./font-size-extension"

/**
 * 创建统一的扩展配置
 * @param options 配置选项
 * @param options.resizable 表格是否可调整大小（编辑模式为 true，预览模式为 false）
 * @param options.allowTableNodeSelection 是否允许表格节点选择（仅编辑模式）
 * @param options.placeholderExtension 占位符扩展（可选，仅编辑模式）
 */
export function createDocumentExtensions(options: {
  resizable?: boolean
  allowTableNodeSelection?: boolean
  placeholderExtension?: any
} = {}) {
  const {
    resizable = false,
    allowTableNodeSelection = false,
    placeholderExtension,
  } = options

  const extensions = [
    StarterKit.configure({
      heading: false,
      paragraph: false,
      hardBreak: false,
    }),
    HardBreak.configure({
      keepMarks: true,
    }),
    ParagraphWithAttrs,
    HeadingWithAttrs,
    TableWithAttrs.configure({
      resizable,
      allowTableNodeSelection,
      HTMLAttributes: {},
    }),
    TableRow.configure({
      HTMLAttributes: {},
    }),
    TableHeader.configure({
      HTMLAttributes: {},
    }),
    TableCellWithAttrs.configure({
      HTMLAttributes: {},
    }),
    TextAlign.configure({
      types: ["heading", "paragraph", "tableCell"],
      alignments: ["left", "center", "right", "justify"],
      defaultAlignment: "left",
    }),
    Underline,
    TextStyle, // 必须在 FontSize 之前
    Color,
    ImageExtension.configure({
      inline: true,
      allowBase64: true,
    }),
    FontSize, // 依赖于 TextStyle，必须在之后加载
  ]

  // 如果提供了占位符扩展，添加到列表末尾
  if (placeholderExtension) {
    extensions.push(placeholderExtension)
  }

  return extensions
}

