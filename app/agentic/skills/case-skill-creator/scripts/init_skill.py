#!/usr/bin/env python3
"""
Skill Initializer - Creates a new skill with Claude-standard structure

Usage:
    init_skill.py <skill-name> --path <path>

Examples:
    init_skill.py wechat-evidence --path skills/
    init_skill.py contract-review --path .claude/skills/

The script creates a minimal Claude-compliant skill structure:
    skill-name/
    ├── SKILL.md              # Main skill file with TODO placeholders
    └── references/
        └── source.md         # Placeholder for original article content
"""

import sys
from pathlib import Path
import argparse
from datetime import datetime


# ============================================================================
# SKILL.MD TEMPLATE - Claude Standard Format
# ============================================================================
SKILL_TEMPLATE = """---
name: {skill_name}
description: "[TODO: 简要描述此技能的功能。当[触发条件]时使用。包括：(1) [功能1]，(2) [功能2]。]"
---

# {skill_title}

## 适用场景

[TODO: 描述何时应使用此技能]

---

## [TODO: 根据内容类型选择结构]

<!--
知识型结构：概念速查 → 规则索引 → 常见误区
能力型结构：Step 1 → Step 2 → Step 3 → 决策要点
混合型结构：第一部分(知识基础) → 第二部分(操作流程)
-->

### [内容章节]

[TODO: 组织内容，所有具体事实必须引用 references/source.md]

> 原文依据：[references/source.md](references/source.md)

---

## 原文资料

本技能基于：[references/source.md](references/source.md)

> [!CAUTION]
> 核实任何法条或事实时，必须查阅原文。
"""

# ============================================================================
# REFERENCES/SOURCE.MD TEMPLATE
# ============================================================================
SOURCE_TEMPLATE = """# 原始文章

> **来源**：[TODO: 文章标题或URL]
> **保存时间**：{timestamp}
> **保存说明**：以下内容为原文完整复制，未做任何修改

---

[TODO: 将原始文章内容完整粘贴到此处，不做任何修改]
"""


def title_case_skill_name(skill_name):
    """Convert hyphenated skill name to Title Case for display."""
    return ' '.join(word.capitalize() for word in skill_name.split('-'))


def init_skill(skill_name, path):
    """
    Initialize a new skill directory with Claude-standard structure.

    Args:
        skill_name: Name of the skill (kebab-case)
        path: Path where the skill directory should be created

    Returns:
        Path to created skill directory, or None if error
    """
    # Determine skill directory path
    skill_dir = Path(path).resolve() / skill_name

    # Check if directory already exists
    if skill_dir.exists():
        print(f"❌ Error: Skill directory already exists: {skill_dir}")
        return None

    # Create skill directory
    try:
        skill_dir.mkdir(parents=True, exist_ok=False)
        print(f"✅ Created skill directory: {skill_dir}")
    except Exception as e:
        print(f"❌ Error creating directory: {e}")
        return None

    # Get display title
    skill_title = title_case_skill_name(skill_name)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    # Create SKILL.md
    try:
        skill_content = SKILL_TEMPLATE.format(
            skill_name=skill_name,
            skill_title=skill_title
        )
        skill_md_path = skill_dir / 'SKILL.md'
        skill_md_path.write_text(skill_content)
        print("✅ Created SKILL.md")
    except Exception as e:
        print(f"❌ Error creating SKILL.md: {e}")
        return None

    # Create references/ directory with source.md placeholder
    try:
        references_dir = skill_dir / 'references'
        references_dir.mkdir(exist_ok=True)
        
        source_content = SOURCE_TEMPLATE.format(timestamp=timestamp)
        source_path = references_dir / 'source.md'
        source_path.write_text(source_content)
        print("✅ Created references/source.md")
    except Exception as e:
        print(f"❌ Error creating references: {e}")
        return None

    # Print next steps
    print(f"\n✅ Skill '{skill_name}' initialized at {skill_dir}")
    print("\n📋 Next steps:")
    print("1. Paste original article content into references/source.md")
    print("2. Analyze content type (knowledge/capability/mixed)")
    print("3. Update SKILL.md with appropriate structure")
    print("4. Ensure all facts reference source.md")

    return skill_dir


def main():
    parser = argparse.ArgumentParser(
        description='Initialize a new Claude-standard skill',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Creates a minimal skill structure:
    skill-name/
    ├── SKILL.md              # Main skill file
    └── references/
        └── source.md         # For original article content

Examples:
  %(prog)s wechat-evidence --path skills/
  %(prog)s contract-review --path .claude/skills/
"""
    )
    parser.add_argument('skill_name', help='Name of the skill (kebab-case)')
    parser.add_argument('--path', required=True, help='Output directory path')

    args = parser.parse_args()

    print(f"🚀 Initializing skill: {args.skill_name}")
    print(f"   Location: {args.path}")
    print()

    result = init_skill(args.skill_name, args.path)

    if result:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
