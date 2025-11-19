import { Editor } from "@tiptap/core"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import { PlaceholderExtension } from "../placeholder-extension"
import { extractPlaceholdersFromDoc } from "../placeholder-manager"

const createEditor = (content: string) =>
  new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      PlaceholderExtension.configure({
        getPlaceholderMetaById: () => undefined,
        onPlaceholderClick: () => {},
        onPlaceholderHover: () => {},
        onPlaceholderSelect: () => {},
        onPlaceholderDelete: () => {},
        getSelectedId: () => null,
        getHighlightedId: () => null,
      }),
    ],
    content,
  })

describe("PlaceholderExtension serialization", () => {
  it("keeps placeholder text untouched in editor JSON", () => {
    const editor = createEditor("<p>Hello {{foo}} world</p>")

    const json = editor.getJSON()
    const paragraph = json.content?.[0]
    const textNode = paragraph?.content?.[0]

    expect(textNode?.text).toBe("Hello {{foo}} world")

    editor.destroy()
  })

  it("inserts placeholder text without altering braces", () => {
    const editor = createEditor("<p>Start </p>")
    editor.chain().focus().insertContent("{{bar}}").run()

    const json = editor.getJSON()
    const combinedText = json.content?.[0]?.content?.map((node) => node.text || "").join("")

    expect(combinedText).toContain("{{bar}}")

    editor.destroy()
  })
})

describe("extractPlaceholdersFromDoc helper", () => {
  it("detects placeholder positions in ProseMirror JSON", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "前缀 {{alpha}} 中缀 {{beta}} 后缀" },
          ],
        },
      ],
    }

    const placeholders = extractPlaceholdersFromDoc(json)

    expect(placeholders).toHaveLength(2)
    expect(placeholders[0].fieldKey).toBe("alpha")
    expect(placeholders[1].fieldKey).toBe("beta")
    expect(placeholders[0].from).toBeLessThan(placeholders[1].from)
  })
})

