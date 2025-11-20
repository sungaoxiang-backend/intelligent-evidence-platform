"""
占位符替换逻辑测试
"""
import pytest
from app.document_generation.services import document_generation_service


class TestPlaceholderReplacement:
    """测试占位符替换功能"""
    
    def test_replace_simple_placeholder(self):
        """测试替换简单占位符"""
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "原告：{{plaintiff_name}}"}
                    ]
                }
            ]
        }
        
        form_data = {"plaintiff_name": "张三"}
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data
        )
        
        # 验证占位符被替换
        text = result["content"][0]["content"][0]["text"]
        assert text == "原告：张三"
    
    def test_replace_multiple_placeholders(self):
        """测试替换多个占位符"""
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "原告：{{plaintiff}}，被告：{{defendant}}，金额：{{amount}}"}
                    ]
                }
            ]
        }
        
        form_data = {
            "plaintiff": "张三",
            "defendant": "李四",
            "amount": "10000"
        }
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data
        )
        
        text = result["content"][0]["content"][0]["text"]
        assert text == "原告：张三，被告：李四，金额：10000"
    
    def test_keep_unfilled_placeholders(self):
        """测试未填写的占位符保持原样"""
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "原告：{{plaintiff}}，地址：{{address}}"}
                    ]
                }
            ]
        }
        
        # 只填写了 plaintiff，address 未填写
        form_data = {"plaintiff": "张三"}
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data
        )
        
        text = result["content"][0]["content"][0]["text"]
        assert text == "原告：张三，地址：{{address}}"  # address 保留占位符
    
    def test_replace_in_nested_content(self):
        """测试在嵌套结构中替换占位符"""
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "原告：{{plaintiff}}"}
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "被告：{{defendant}}"}
                    ]
                },
                {
                    "type": "heading",
                    "attrs": {"level": 1},
                    "content": [
                        {"type": "text", "text": "案件编号：{{case_number}}"}
                    ]
                }
            ]
        }
        
        form_data = {
            "plaintiff": "张三",
            "defendant": "李四",
            "case_number": "2024-001"
        }
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data
        )
        
        # 验证所有层级的占位符都被替换
        assert "张三" in result["content"][0]["content"][0]["text"]
        assert "李四" in result["content"][1]["content"][0]["text"]
        assert "2024-001" in result["content"][2]["content"][0]["text"]
    
    def test_replace_with_spaces_in_placeholder(self):
        """测试占位符中有空格的情况"""
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "金额：{{ amount }}元"}
                    ]
                }
            ]
        }
        
        form_data = {"amount": "10000"}
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data
        )
        
        text = result["content"][0]["content"][0]["text"]
        assert text == "金额：10000元"
    
    def test_replace_with_special_characters(self):
        """测试包含特殊字符的值"""
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "地址：{{address}}"}
                    ]
                }
            ]
        }
        
        form_data = {"address": "北京市朝阳区xx路100号（单元1-2-3）"}
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data
        )
        
        text = result["content"][0]["content"][0]["text"]
        assert text == "地址：北京市朝阳区xx路100号（单元1-2-3）"
    
    def test_replace_with_number_value(self):
        """测试数字类型的值"""
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "金额：{{amount}}元"}
                    ]
                }
            ]
        }
        
        form_data = {"amount": 10000}  # 数字类型
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data
        )
        
        text = result["content"][0]["content"][0]["text"]
        assert text == "金额：10000元"
    
    def test_replace_with_list_value(self):
        """测试数组类型的值（用于checkbox）"""
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "选项：{{options}}"}
                    ]
                }
            ]
        }
        
        form_data = {"options": ["选项1", "选项2", "选项3"]}
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data
        )
        
        text = result["content"][0]["content"][0]["text"]
        # 数组应该被转换为逗号分隔的字符串
        assert "选项1" in text
        assert "选项2" in text
        assert "选项3" in text
    
    def test_replace_empty_string(self):
        """测试空字符串值"""
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "备注：{{note}}"}
                    ]
                }
            ]
        }
        
        form_data = {"note": ""}  # 空字符串
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data
        )
        
        text = result["content"][0]["content"][0]["text"]
        # 空字符串应该替换占位符为空
        assert text == "备注："
    
    def test_no_modification_to_original(self):
        """测试不修改原始 JSON（深拷贝）"""
        original_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "原告：{{plaintiff}}"}
                    ]
                }
            ]
        }
        
        form_data = {"plaintiff": "张三"}
        
        # 调用替换函数
        result = document_generation_service._replace_placeholders_in_json(
            original_json,
            form_data
        )
        
        # 验证原始 JSON 未被修改
        original_text = original_json["content"][0]["content"][0]["text"]
        assert original_text == "原告：{{plaintiff}}"
        
        # 验证结果已被修改
        result_text = result["content"][0]["content"][0]["text"]
        assert result_text == "原告：张三"
    
    def test_replace_radio_with_all_options(self):
        """测试单选字段显示所有选项和选中状态"""
        # 创建 Mock 占位符对象
        class MockPlaceholder:
            def __init__(self, name, type_, options):
                self.placeholder_name = name
                self.type = type_
                self.options = options
        
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "性别：{{applicant_gender}}"}
                    ]
                }
            ]
        }
        
        form_data = {"applicant_gender": "male"}
        
        placeholders = [
            MockPlaceholder("applicant_gender", "radio", [
                {"label": "男", "value": "male"},
                {"label": "女", "value": "female"}
            ])
        ]
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data,
            placeholders
        )
        
        # 验证占位符被替换为所有选项，并标记选中状态
        text = result["content"][0]["content"][0]["text"]
        assert text == "性别：☑ 男  ☐ 女"
    
    def test_replace_checkbox_with_all_options(self):
        """测试复选框字段显示所有选项和选中状态"""
        # 创建 Mock 占位符对象
        class MockPlaceholder:
            def __init__(self, name, type_, options):
                self.placeholder_name = name
                self.type = type_
                self.options = options
        
        prosemirror_json = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {"type": "text", "text": "住所地：{{applicant_residence}}"}
                    ]
                }
            ]
        }
        
        form_data = {"applicant_residence": ["factory", "park"]}
        
        placeholders = [
            MockPlaceholder("applicant_residence", "checkbox", [
                {"label": "工厂", "value": "factory"},
                {"label": "园区", "value": "park"},
                {"label": "市区", "value": "downtown"}
            ])
        ]
        
        result = document_generation_service._replace_placeholders_in_json(
            prosemirror_json,
            form_data,
            placeholders
        )
        
        # 验证占位符被替换为所有选项，并标记选中状态
        text = result["content"][0]["content"][0]["text"]
        assert text == "住所地：☑ 工厂  ☑ 园区  ☐ 市区"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

