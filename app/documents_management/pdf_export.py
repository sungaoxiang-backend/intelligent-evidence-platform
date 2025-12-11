"""
PDF 导出工具
使用 Playwright 将 HTML 转换为 PDF
"""
import asyncio
from typing import Optional
from loguru import logger
from playwright.async_api import async_playwright, Browser, Page


async def html_to_pdf(
    html_content: str,
    filename: Optional[str] = None,
    margin_top: Optional[float] = None,
    margin_bottom: Optional[float] = None,
    margin_left: Optional[float] = None,
    margin_right: Optional[float] = None,
) -> bytes:
    """
    将 HTML 内容转换为 PDF
    
    Args:
        html_content: HTML 内容
        filename: PDF 文件名（可选，用于日志）
        margin_top: 上边距（mm，默认25.4mm = 1英寸）
        margin_bottom: 下边距（mm，默认25.4mm = 1英寸）
        margin_left: 左边距（mm，默认25.4mm = 1英寸）
        margin_right: 右边距（mm，默认25.4mm = 1英寸）
        
    Returns:
        PDF 文件的字节流
    """
    try:
        # 默认边距为 25.4mm (1英寸)
        default_margin = 25.4
        
        # 构建边距字典，将mm转换为cm（Playwright使用cm单位）
        margin_dict = {
            "top": f"{(margin_top if margin_top is not None else default_margin) / 10:.2f}cm",
            "right": f"{(margin_right if margin_right is not None else default_margin) / 10:.2f}cm",
            "bottom": f"{(margin_bottom if margin_bottom is not None else default_margin) / 10:.2f}cm",
            "left": f"{(margin_left if margin_left is not None else default_margin) / 10:.2f}cm",
        }
        
        async with async_playwright() as p:
            # 启动浏览器
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # 设置内容
            await page.set_content(html_content, wait_until="networkidle")
            
            # 生成 PDF，使用传入的边距设置
            pdf_bytes = await page.pdf(
                format="A4",
                margin=margin_dict,
                print_background=True,
            )
            
            await browser.close()
            
            logger.info(f"PDF 生成成功: {len(pdf_bytes)} bytes" + (f" - {filename}" if filename else ""))
            return pdf_bytes
            
    except Exception as e:
        logger.error(f"PDF 生成失败: {str(e)}")
        raise


# 同步包装函数（用于在同步上下文中调用）
def html_to_pdf_sync(
    html_content: str,
    filename: Optional[str] = None
) -> bytes:
    """
    同步版本的 HTML 转 PDF（内部使用异步实现）
    
    Args:
        html_content: HTML 内容
        filename: PDF 文件名（可选）
        
    Returns:
        PDF 文件的字节流
    """
    return asyncio.run(html_to_pdf(html_content, filename))

