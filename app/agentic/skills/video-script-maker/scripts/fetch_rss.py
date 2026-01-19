#!/usr/bin/env python3
"""
RSS Feed Fetcher - 获取本地RSS服务的文章列表

Usage:
    fetch_rss.py [--base-url URL] [--feed FEED_ID] [--title KEYWORD] [--limit N] [--page N]

Examples:
    fetch_rss.py                           # 获取所有文章（默认10条）
    fetch_rss.py --limit 5                 # 获取最新5条
    fetch_rss.py --title 民间借贷          # 按标题过滤
    fetch_rss.py --feed wechat_001         # 获取指定feed源
"""

import argparse
import sys
import xml.etree.ElementTree as ET
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import URLError


DEFAULT_BASE_URL = "http://localhost:4000"
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


def fetch_rss(base_url: str, feed_id: str = None, title_include: str = None, 
              limit: int = 10, page: int = 1) -> list[dict]:
    """
    获取RSS文章列表
    
    Returns:
        List of dicts with keys: title, link, author, updated
    """
    # Build URL
    if feed_id:
        endpoint = f"/feeds/{feed_id}.atom"
    else:
        endpoint = "/feeds/all.atom"
    
    params = {}
    if title_include:
        params["title_include"] = title_include
    if limit:
        params["limit"] = limit
    if page:
        params["page"] = page
    
    url = f"{base_url}{endpoint}"
    if params:
        url += "?" + urlencode(params)
    
    # Fetch and parse
    try:
        req = Request(url, headers={"User-Agent": "RSS-Fetcher/1.0"})
        with urlopen(req, timeout=10) as response:
            xml_data = response.read()
    except URLError as e:
        print(f"❌ Failed to connect to RSS service: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Parse Atom XML
    root = ET.fromstring(xml_data)
    articles = []
    
    for entry in root.findall("atom:entry", ATOM_NS):
        title_elem = entry.find("atom:title", ATOM_NS)
        link_elem = entry.find("atom:link", ATOM_NS)
        author_elem = entry.find("atom:author/atom:name", ATOM_NS)
        updated_elem = entry.find("atom:updated", ATOM_NS)
        
        articles.append({
            "title": title_elem.text.strip() if title_elem is not None and title_elem.text else "",
            "link": link_elem.get("href", "") if link_elem is not None else "",
            "author": author_elem.text.strip() if author_elem is not None and author_elem.text else "",
            "updated": updated_elem.text.strip() if updated_elem is not None and updated_elem.text else "",
        })
    
    return articles


def main():
    parser = argparse.ArgumentParser(description="获取本地RSS服务的文章列表")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="RSS服务地址")
    parser.add_argument("--feed", help="指定feed源ID")
    parser.add_argument("--title", help="标题关键词过滤")
    parser.add_argument("--limit", type=int, default=10, help="返回条数")
    parser.add_argument("--page", type=int, default=1, help="页码")
    
    args = parser.parse_args()
    
    print(f"🔍 Fetching from {args.base_url}...")
    
    articles = fetch_rss(
        base_url=args.base_url,
        feed_id=args.feed,
        title_include=args.title,
        limit=args.limit,
        page=args.page
    )
    
    if not articles:
        print("📭 No articles found.")
        return
    
    print(f"\n📰 Found {len(articles)} articles:\n")
    for i, article in enumerate(articles, 1):
        print(f"{i}. {article['title']}")
        print(f"   🔗 {article['link']}")
        print(f"   👤 {article['author']}  📅 {article['updated'][:10] if article['updated'] else 'N/A'}")
        print()


if __name__ == "__main__":
    main()
