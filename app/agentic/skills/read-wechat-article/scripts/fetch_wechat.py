#!/usr/bin/env python3
"""
Fetch WeChat article content using Playwright.
Usage: python3 fetch_wechat.py <article_url>
"""

import asyncio
import sys
from playwright.async_api import async_playwright


async def fetch_wechat_article(url: str) -> str:
    """Fetch and extract content from a WeChat article."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(url, wait_until='networkidle', timeout=30000)

            # Wait for content to load
            try:
                await page.wait_for_selector('#js_content', timeout=15000)
            except:
                pass

            # Extract article content
            content = await page.evaluate('''() => {
                const el = document.getElementById("js_content");
                if (el) {
                    // Remove common non-content elements
                    const scripts = el.querySelectorAll('script, style, iframe');
                    scripts.forEach(s => s.remove());
                    return el.innerText;
                }
                return "";
            }''')

            return content.strip()

        finally:
            await browser.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 fetch_wechat.py <article_url>", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    content = asyncio.run(fetch_wechat_article(url))
    print(content)


if __name__ == "__main__":
    main()
