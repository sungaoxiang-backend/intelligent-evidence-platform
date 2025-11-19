import "@testing-library/jest-dom"

if (typeof window !== "undefined") {
  ;(window as any).tippy = () => ({
    destroy() {},
    hide() {},
    setProps() {},
    setContent() {},
    show() {},
  })

  if (typeof window.document !== "undefined") {
    window.document.elementFromPoint = () => {
      if (window.document.body) {
        return window.document.body
      }
      const fallback = window.document.createElement("div")
      return fallback
    }
  }
}

if (typeof Element !== "undefined") {
  if (!Element.prototype.getClientRects) {
    Element.prototype.getClientRects = function () {
      const rect = {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
      }
      const list: any = [rect]
      list.item = () => rect
      return list
    }
  }
  if (!Element.prototype.getBoundingClientRect) {
    Element.prototype.getBoundingClientRect = function () {
      return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 } as any
    }
  }
}

