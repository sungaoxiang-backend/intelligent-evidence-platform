---
name: video-script-maker
description: 从本地RSS获取法律文章并生成A/B/C三种类型的视频脚本。用于：(1)用户请求制作视频脚本 (2)从RSS检索法律文章 (3)分析文章提取Case/Misconception/Gap原子 (4)按模板生成适合短视频的法律科普脚本
---

# Video Script Maker

从本地RSS服务获取法律公众号文章，提取核心原子内容，按A/B/C三种模板生成短视频脚本。

## 工作流程

```
1. RSS检索 → 2. 文章读取(playwright) → 3. 原子提取 → 4. 脚本生成
```

### Step 1: RSS检索

使用 `scripts/fetch_rss.py` 或直接请求本地RSS服务获取文章列表。

**RSS服务地址**: `http://localhost:4000`

| 端点 | 说明 |
|-----|------|
| `/feeds/all.atom` | 获取所有文章 |
| `/feeds/{feed_id}.atom` | 获取指定feed源文章 |

**查询参数**:
- `title_include=关键词` - 标题过滤
- `limit=10&page=1` - 分页

**返回格式**: Atom XML，每个`<entry>`包含:
- `<title>` - 文章标题
- `<link href="...">` - 文章链接
- `<author><name>` - 作者/公众号名

### Step 2: 文章读取

使用 **playwright** 读取微信公众号文章内容（不使用直接web fetch）。

流程：
1. 打开文章链接
2. 等待页面加载完成
3. 提取正文内容（`#js_content`选择器）
4. 返回文章文本

### Step 3: 原子提取

分析文章内容，识别可转化为脚本的原子类型。详见 [atom-extraction-guide.md](references/atom-extraction-guide.md)。

**原子类型**:
- **Case Atom** → A类脚本（案件复盘）
- **Misconception Atom** → B类脚本（咨询误解）
- **Gap Atom** → C类脚本（缺口模板）

**优先级**: C > B > A（缺口/门槛最短、最可量产）

### Step 4: 脚本生成

根据提取的原子类型，按对应模板生成脚本。详见 [script-templates.md](references/script-templates.md)。

每种模板都有**5条固定槽位**，必须按顺序填写。

## 模板快速参考

| 类型 | 用途 | 核心槽位 |
|-----|------|---------|
| **A-案件复盘** | 讲真实案例 | 案情→误判→真卡点→规则→下一步 |
| **B-咨询误解** | 拆常见问题 | 原话→误解→纠偏→风险→自查 |
| **C-缺口模板** | 讲关键缺口 | 定义→后果→门槛→方向→自查 |

## 不适用文章处理

当文章无法提取任何原子时，输出:
- `DROP` - 丢弃
- `RESEARCH` - 仅入选题库

并返回原因标签: `NO_RULE` / `NO_GAP` / `NO_CASE` / `TOO_TUTORIAL`

## 输出约束 (Constraints)

1. **绝对禁止**任何开场白、解释性文本或结束语（如"我根据..."、"为您生成..."）。
2. **只输出** `video-script` 代码块。
3. 所有的思考和分析过程必须包裹在 `<think>` 标签中。

## 资源

- [script-templates.md](references/script-templates.md) - A/B/C完整模板定义
- [atom-extraction-guide.md](references/atom-extraction-guide.md) - 原子提取规则与评分
- [fetch_rss.py](scripts/fetch_rss.py) - RSS获取脚本
