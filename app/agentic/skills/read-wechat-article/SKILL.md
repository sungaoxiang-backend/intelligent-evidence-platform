---
name: read-wechat-article
description: Fetch and extract clean text content from WeChat public account articles. Use when given a WeChat article URL (mp.weixin.qq.com) and you need to read the full article content.
---

# Read WeChat Article

## Quick Start

Given a WeChat article URL, extract the clean text content.

```bash
python3 scripts/fetch_wechat.py "https://mp.weixin.qq.com/s/xxxxx"
```

## Usage

When user provides a WeChat article URL, execute the fetch script and return the extracted text content.

**Input:** WeChat article URL (e.g., `https://mp.weixin.qq.com/s/HsGLmyTttGGVCTVfmaaRHw`)

**Output:** Clean article text, ready for further processing (summarization, analysis, script generation, etc.)

## Implementation

The skill uses Playwright to:
1. Launch a headless Chromium browser
2. Navigate to the article URL
3. Extract content from `#js_content` element
4. Clean up script and style tags
5. Return plain text content

## Resources

### scripts/fetch_wechat.py
Core script for fetching article content. Run via Bash tool.
