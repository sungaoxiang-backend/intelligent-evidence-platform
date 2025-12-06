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
    filename: Optional[str] = None
) -> bytes:
    """
    将 HTML 内容转换为 PDF
    
    Args:
        html_content: HTML 内容
        filename: PDF 文件名（可选，用于日志）
        
    Returns:
        PDF 文件的字节流
    """
    try:
        async with async_playwright() as p:
            # 启动浏览器
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # 设置内容
            await page.set_content(html_content, wait_until="networkidle")
            
            # 生成 PDF
            pdf_bytes = await page.pdf(
                format="A4",
                margin={
                    "top": "2cm",
                    "right": "2cm",
                    "bottom": "2cm",
                    "left": "2cm"
                },
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

