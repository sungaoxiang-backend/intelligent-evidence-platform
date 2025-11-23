#!/usr/bin/env python3
"""
修复现有模板数据
将分离的占位符节点重新组织为段落格式
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.template_editor.mappers import DocxToProseMirrorMapper

def reconstruct_narrative_template(placeholders: list) -> dict:
    """
    根据占位符列表重新构建陈述式模板的ProseMirror JSON
    假设格式为：{{姓名}}，{{性别}}，{{民族}}，{{出生日期}}，{{住址}}，{{公民身份号码}}
    """
    # 定义标准的陈述式模板占位符顺序和连接文本
    standard_patterns = {
        "当事人信息": "{{姓名}}，{{性别}}，{{民族}}，{{出生日期}}，{{住址}}，{{公民身份号码}}",
        "案件基本信息": "{{案号}}，{{案由}}，{{立案日期}}，{{审理法院}}，{{审判员}}"
    }

    # 根据找到的占位符选择合适的模式
    found_placeholders = [p.get('attrs', {}).get('fieldKey', '') for p in placeholders if p.get('type') == 'placeholder']

    # 如果包含公民身份号码，使用当事人信息模式
    if '公民身份号码' in found_placeholders or '住址' in found_placeholders:
        pattern_text = standard_patterns["当事人信息"]
    # 如果包含案号，使用案件信息模式
    elif '案号' in found_placeholders or '审理法院' in found_placeholders:
        pattern_text = standard_patterns["案件基本信息"]
    else:
        # 根据实际找到的占位符动态构建
        pattern_text = ""
        for placeholder in found_placeholders:
            if pattern_text:
                pattern_text += "，"
            pattern_text += "{{" + placeholder + "}}"

    # 使用映射器解析这个模式
    mapper = DocxToProseMirrorMapper()
    nodes = mapper._parse_placeholders_in_text(pattern_text)

    # 构建完整的段落节点
    paragraph_node = {
        "type": "paragraph",
        "attrs": {},
        "content": nodes
    }

    # 返回完整的文档结构
    return {
        "type": "doc",
        "content": [paragraph_node]
    }

def test_reconstruction():
    """测试模板重构功能"""
    print("=== 测试模板重构功能 ===")

    # 模拟现有的只包含占位符的模板数据
    old_template_data = {
        "type": "doc",
        "content": [
            {
                "type": "table",
                "content": [
                    {
                        "type": "tableRow",
                        "content": [
                            {
                                "type": "tableCell",
                                "content": [
                                    {"type": "placeholder", "attrs": {"fieldKey": "姓名"}},
                                    {"type": "placeholder", "attrs": {"fieldKey": "性别"}},
                                    {"type": "placeholder", "attrs": {"fieldKey": "民族"}},
                                    {"type": "placeholder", "attrs": {"fieldKey": "出生日期"}},
                                    {"type": "placeholder", "attrs": {"fieldKey": "住址"}},
                                    {"type": "placeholder", "attrs": {"fieldKey": "公民身份号码"}}
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }

    print("旧模板结构:")
    print(f"  根节点类型: {old_template_data.get('type')}")
    print(f"  内容数量: {len(old_template_data.get('content', []))}")

    # 提取所有占位符
    all_placeholders = []

    def extract_placeholders(node):
        node_type = node.get('type')
        if node_type == 'placeholder':
            all_placeholders.append(node)
        elif 'content' in node and isinstance(node['content'], list):
            for child in node['content']:
                extract_placeholders(child)

    extract_placeholders(old_template_data)

    print(f"\n找到 {len(all_placeholders)} 个占位符:")
    for i, placeholder in enumerate(all_placeholders):
        field_key = placeholder.get('attrs', {}).get('fieldKey', '')
        print(f"  {i+1}. {field_key}")

    # 重新构建模板
    new_template_data = reconstruct_narrative_template(all_placeholders)

    print(f"\n新模板结构:")
    print(f"  根节点类型: {new_template_data.get('type')}")
    print(f"  内容数量: {len(new_template_data.get('content', []))}")

    # 检查第一个段落
    first_paragraph = new_template_data.get('content', [])[0]
    if first_paragraph.get('type') == 'paragraph':
        paragraph_content = first_paragraph.get('content', [])
        print(f"  段落包含 {len(paragraph_content)} 个节点:")

        text_sequence = ""
        for i, node in enumerate(paragraph_content):
            node_type = node.get('type')
            if node_type == 'text':
                text = node.get('text', '')
                print(f"    {i+1}. 文本: '{text}'")
                text_sequence += text
            elif node_type == 'placeholder':
                field_key = node.get('attrs', {}).get('fieldKey', '')
                print(f"    {i+1}. 占位符: {{{{{field_key}}}}}")
                text_sequence += f"{{{{{field_key}}}}}"

        print(f"\n  重构后的文本序列: {text_sequence}")

    return new_template_data

if __name__ == "__main__":
    test_reconstruction()