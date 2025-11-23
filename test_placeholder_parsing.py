#!/usr/bin/env python3
"""
测试占位符解析功能
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.template_editor.mappers import DocxToProseMirrorMapper

def test_placeholder_parsing():
    """测试占位符解析功能"""
    mapper = DocxToProseMirrorMapper()

    # 测试文本："{{姓名}}，{{性别}}，{{民族}}，{{出生日期}}，{{住址}}，{{公民身份号码}}"
    test_text = "{{姓名}}，{{性别}}，{{民族}}，{{出生日期}}，{{住址}}，{{公民身份号码}}"

    print(f"测试文本: {test_text}")

    # 调用占位符解析方法
    result = mapper._parse_placeholders_in_text(test_text)

    print(f"\n解析结果:")
    for i, node in enumerate(result):
        print(f"  [{i}] {node}")

    print(f"\n解析出的节点数量: {len(result)}")

    # 验证结果
    expected_pattern = [
        {"type": "placeholder", "attrs": {"fieldKey": "姓名"}},
        {"type": "text", "text": "，"},
        {"type": "placeholder", "attrs": {"fieldKey": "性别"}},
        {"type": "text", "text": "，"},
        {"type": "placeholder", "attrs": {"fieldKey": "民族"}},
        {"type": "text", "text": "，"},
        {"type": "placeholder", "attrs": {"fieldKey": "出生日期"}},
        {"type": "text", "text": "，"},
        {"type": "placeholder", "attrs": {"fieldKey": "住址"}},
        {"type": "text", "text": "，"},
        {"type": "placeholder", "attrs": {"fieldKey": "公民身份号码"}}
    ]

    print(f"\n期望的节点数量: {len(expected_pattern)}")

    # 检查数量是否匹配
    if len(result) == len(expected_pattern):
        print("✅ 节点数量匹配")

        # 详细比较每个节点
        for i, (actual, expected) in enumerate(zip(result, expected_pattern)):
            if actual.get("type") == expected["type"]:
                if expected["type"] == "placeholder":
                    actual_field = actual.get("attrs", {}).get("fieldKey")
                    expected_field = expected["attrs"]["fieldKey"]
                    if actual_field == expected_field:
                        print(f"✅ 节点 {i}: 占位符 {actual_field} 正确")
                    else:
                        print(f"❌ 节点 {i}: 占位符不匹配，期望 {expected_field}，实际 {actual_field}")
                elif expected["type"] == "text":
                    actual_text = actual.get("text")
                    expected_text = expected["text"]
                    if actual_text == expected_text:
                        print(f"✅ 节点 {i}: 文本 '{actual_text}' 正确")
                    else:
                        print(f"❌ 节点 {i}: 文本不匹配，期望 '{expected_text}'，实际 '{actual_text}'")
            else:
                print(f"❌ 节点 {i}: 类型不匹配，期望 {expected['type']}，实际 {actual.get('type')}")
    else:
        print("❌ 节点数量不匹配")

if __name__ == "__main__":
    test_placeholder_parsing()