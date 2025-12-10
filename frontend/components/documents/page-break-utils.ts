/**
 * 分页工具函数
 * 用于计算内容高度并自动分页
 */

import { A4_PAGE_HEIGHT, A4_PAGE_MARGIN, A4_CONTENT_WIDTH } from "@/components/template-editor/extensions"

/**
 * 计算内容区域的实际可用高度（减去页边距）
 */
export const A4_CONTENT_HEIGHT = A4_PAGE_HEIGHT - (A4_PAGE_MARGIN * 2) // 1123 - 192 = 931px

/**
 * 计算元素的实际高度（包括margin）
 */
export function getElementHeight(element: HTMLElement): number {
  const styles = window.getComputedStyle(element)
  const height = element.offsetHeight
  const marginTop = parseFloat(styles.marginTop) || 0
  const marginBottom = parseFloat(styles.marginBottom) || 0
  return height + marginTop + marginBottom
}

/**
 * 检查元素是否应该避免分页（如表格、图片等）
 */
export function shouldAvoidPageBreak(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase()
  // 表格、图片等元素应该尽量保持在同一页
  return ['table', 'img', 'figure'].includes(tagName)
}

/**
 * 计算内容需要多少页
 */
export function calculatePageCount(contentElement: HTMLElement): number {
  if (!contentElement) return 1
  
  const totalHeight = contentElement.scrollHeight
  const pageCount = Math.ceil(totalHeight / A4_CONTENT_HEIGHT)
  return Math.max(1, pageCount)
}

/**
 * 查找最佳分页位置
 * 尝试在段落、标题等自然断点处分页，避免在表格、图片中间分页
 */
export function findPageBreakPosition(
  container: HTMLElement,
  startOffset: number,
  maxHeight: number
): { position: number; element: HTMLElement | null } {
  let currentHeight = 0
  let lastBreakablePosition = 0
  let lastBreakableElement: HTMLElement | null = null
  
  // 遍历所有子元素
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        // 跳过编辑器内部节点
        if ((node as HTMLElement).classList.contains('ProseMirror')) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      }
    }
  )
  
  let node: Node | null = walker.nextNode()
  while (node) {
    const element = node as HTMLElement
    const elementHeight = getElementHeight(element)
    
    // 如果当前元素会导致超出页面高度
    if (currentHeight + elementHeight > maxHeight) {
      // 如果当前元素不应该分页（如表格），尝试继续查找
      if (shouldAvoidPageBreak(element)) {
        // 如果表格高度超过一页，强制分页
        if (elementHeight > maxHeight * 0.8) {
          return { position: currentHeight, element: lastBreakableElement }
        }
        // 否则继续查找
        currentHeight += elementHeight
        node = walker.nextNode()
        continue
      }
      
      // 找到可分页位置
      return { position: currentHeight, element: lastBreakableElement }
    }
    
    // 记录可分页位置（段落、标题等）
    const tagName = element.tagName.toLowerCase()
    if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'ul', 'ol', 'li'].includes(tagName)) {
      lastBreakablePosition = currentHeight + elementHeight
      lastBreakableElement = element
    }
    
    currentHeight += elementHeight
    node = walker.nextNode()
  }
  
  // 如果没有找到合适的分页位置，返回当前位置
  return { position: currentHeight, element: lastBreakableElement }
}
