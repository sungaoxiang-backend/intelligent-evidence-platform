import {
  buildParagraphStyle,
  buildTableStyle,
  buildCellStyle,
} from "../extensions"

describe("template editor extensions style helpers", () => {
  it("buildParagraphStyle returns expected css string", () => {
    const style = buildParagraphStyle({
      textAlign: "center",
      indent: 24,
      firstLineIndent: 12,
      lineHeight: 18,
      spacing: { before: 6, after: 8 },
      list: { type: "ordered", level: 1 },
    })

    expect(style).toContain("text-align: center")
    expect(style).toContain("margin-left")
    expect(style).toContain("text-indent")
    expect(style).toContain("line-height")
    expect(style).toContain("margin-top")
    expect(style).toContain("margin-bottom")
    expect(style).toContain("display: list-item")
    expect(style).toContain("list-style-type: decimal")
  })

  it("buildTableStyle handles layout and width", () => {
    const style = buildTableStyle({
      tableLayout: "fixed",
      tableWidth: { width: 5000, type: "dxa" },
    })

    expect(style).toContain("table-layout: fixed")
    expect(style).toContain("width")
  })

  it("buildCellStyle handles background color and width", () => {
    const style = buildCellStyle({
      backgroundColor: "#ABCDEF",
      cellWidth: { width: 2400, type: "dxa" },
    })

    expect(style).toContain("background-color: #ABCDEF")
    expect(style).toContain("width")
  })

  it("buildCellStyle maps center vertical alignment to middle", () => {
    const style = buildCellStyle({
      verticalAlign: "center",
    })

    expect(style).toContain("vertical-align: middle")
  })
})

