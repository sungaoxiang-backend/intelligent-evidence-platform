"""
文书生成 Schemas 测试
"""
import pytest
from datetime import datetime
from pydantic import ValidationError

from app.document_generation.schemas import (
    DocumentGenerationCreateRequest,
    DocumentGenerationUpdateRequest,
    DocumentGenerationExportRequest,
    DocumentGenerationResponse,
    CaseBasicInfo,
    TemplateBasicInfo,
    PlaceholderInfo,
    TemplateDetailInfo,
    DocumentGenerationDetailResponse,
)


class TestDocumentGenerationCreateRequest:
    """测试创建文书生成记录请求 Schema"""
    
    def test_valid_request(self):
        """测试有效的创建请求"""
        data = {
            "case_id": 1,
            "template_id": 2
        }
        request = DocumentGenerationCreateRequest(**data)
        assert request.case_id == 1
        assert request.template_id == 2
    
    def test_missing_case_id(self):
        """测试缺少 case_id"""
        data = {"template_id": 2}
        with pytest.raises(ValidationError) as exc_info:
            DocumentGenerationCreateRequest(**data)
        assert "case_id" in str(exc_info.value)
    
    def test_missing_template_id(self):
        """测试缺少 template_id"""
        data = {"case_id": 1}
        with pytest.raises(ValidationError) as exc_info:
            DocumentGenerationCreateRequest(**data)
        assert "template_id" in str(exc_info.value)
    
    def test_invalid_case_id_zero(self):
        """测试 case_id 为 0（应该失败）"""
        data = {"case_id": 0, "template_id": 1}
        with pytest.raises(ValidationError) as exc_info:
            DocumentGenerationCreateRequest(**data)
        assert "greater than 0" in str(exc_info.value).lower()
    
    def test_invalid_case_id_negative(self):
        """测试 case_id 为负数（应该失败）"""
        data = {"case_id": -1, "template_id": 1}
        with pytest.raises(ValidationError) as exc_info:
            DocumentGenerationCreateRequest(**data)
        assert "greater than 0" in str(exc_info.value).lower()
    
    def test_invalid_template_id_zero(self):
        """测试 template_id 为 0（应该失败）"""
        data = {"case_id": 1, "template_id": 0}
        with pytest.raises(ValidationError) as exc_info:
            DocumentGenerationCreateRequest(**data)
        assert "greater than 0" in str(exc_info.value).lower()


class TestDocumentGenerationUpdateRequest:
    """测试更新文书生成草稿请求 Schema"""
    
    def test_valid_update_request_simple(self):
        """测试有效的更新请求（简单数据）"""
        data = {
            "form_data": {
                "name": "张三",
                "date": "2024-01-01"
            }
        }
        request = DocumentGenerationUpdateRequest(**data)
        assert request.form_data["name"] == "张三"
        assert request.form_data["date"] == "2024-01-01"
    
    def test_valid_update_request_complex(self):
        """测试有效的更新请求（复杂数据）"""
        data = {
            "form_data": {
                "name": "张三",
                "amount": 10000,
                "checkbox_values": ["option1", "option2"],
                "nested": {"key": "value"}
            }
        }
        request = DocumentGenerationUpdateRequest(**data)
        assert request.form_data["amount"] == 10000
        assert isinstance(request.form_data["checkbox_values"], list)
        assert isinstance(request.form_data["nested"], dict)
    
    def test_empty_form_data(self):
        """测试空的 form_data"""
        data = {"form_data": {}}
        request = DocumentGenerationUpdateRequest(**data)
        assert request.form_data == {}
    
    def test_missing_form_data(self):
        """测试缺少 form_data"""
        with pytest.raises(ValidationError) as exc_info:
            DocumentGenerationUpdateRequest()
        assert "form_data" in str(exc_info.value)


class TestDocumentGenerationExportRequest:
    """测试导出文书请求 Schema"""
    
    def test_with_filename(self):
        """测试带文件名的请求"""
        data = {"filename": "起诉状_案件1"}
        request = DocumentGenerationExportRequest(**data)
        assert request.filename == "起诉状_案件1"
    
    def test_without_filename(self):
        """测试不带文件名的请求（应使用默认值）"""
        request = DocumentGenerationExportRequest()
        assert request.filename is None
    
    def test_filename_too_long(self):
        """测试文件名过长（超过 200 字符）"""
        data = {"filename": "a" * 201}
        with pytest.raises(ValidationError) as exc_info:
            DocumentGenerationExportRequest(**data)
        assert "at most 200" in str(exc_info.value).lower()
    
    def test_filename_max_length(self):
        """测试文件名最大长度（200 字符刚好）"""
        data = {"filename": "a" * 200}
        request = DocumentGenerationExportRequest(**data)
        assert len(request.filename) == 200


class TestDocumentGenerationResponse:
    """测试文书生成记录响应 Schema"""
    
    def test_valid_response(self):
        """测试有效的响应"""
        data = {
            "id": 1,
            "case_id": 10,
            "template_id": 20,
            "form_data": {"name": "张三"},
            "created_by_id": 5,
            "updated_by_id": 5,
            "created_at": datetime(2024, 1, 1, 12, 0, 0),
            "updated_at": datetime(2024, 1, 1, 12, 0, 0)
        }
        response = DocumentGenerationResponse(**data)
        assert response.id == 1
        assert response.case_id == 10
        assert response.template_id == 20
        assert response.form_data["name"] == "张三"
    
    def test_optional_fields_none(self):
        """测试可选字段为 None"""
        data = {
            "id": 1,
            "case_id": 10,
            "template_id": 20,
            "form_data": {},
            "created_by_id": None,
            "updated_by_id": None,
            "created_at": datetime(2024, 1, 1),
            "updated_at": datetime(2024, 1, 1)
        }
        response = DocumentGenerationResponse(**data)
        assert response.created_by_id is None
        assert response.updated_by_id is None


class TestCaseBasicInfo:
    """测试案件基本信息 Schema"""
    
    def test_valid_case_info(self):
        """测试有效的案件信息"""
        data = {
            "id": 1,
            "case_status": "draft",
            "description": "测试案件",
            "loan_amount": 50000.0,
            "court_name": "某某法院"
        }
        case_info = CaseBasicInfo(**data)
        assert case_info.id == 1
        assert case_info.case_status == "draft"
        assert case_info.loan_amount == 50000.0
    
    def test_optional_fields_none(self):
        """测试可选字段为 None"""
        data = {
            "id": 1,
            "case_status": "draft"
        }
        case_info = CaseBasicInfo(**data)
        assert case_info.description is None
        assert case_info.loan_amount is None
        assert case_info.court_name is None


class TestTemplateBasicInfo:
    """测试模板基本信息 Schema"""
    
    def test_valid_template_info(self):
        """测试有效的模板信息"""
        data = {
            "id": 1,
            "name": "起诉状模板",
            "description": "民间借贷纠纷起诉状",
            "category": "民事诉讼",
            "status": "published"
        }
        template_info = TemplateBasicInfo(**data)
        assert template_info.id == 1
        assert template_info.name == "起诉状模板"
        assert template_info.status == "published"


class TestPlaceholderInfo:
    """测试占位符信息 Schema"""
    
    def test_text_placeholder(self):
        """测试文本类型占位符"""
        data = {
            "id": 1,
            "placeholder_name": "name",
            "label": "姓名",
            "type": "text",
            "required": True,
            "hint": "请输入姓名"
        }
        placeholder = PlaceholderInfo(**data)
        assert placeholder.type == "text"
        assert placeholder.required is True
    
    def test_select_placeholder_with_options(self):
        """测试选择类型占位符（带选项）"""
        data = {
            "id": 2,
            "placeholder_name": "gender",
            "label": "性别",
            "type": "select",
            "required": False,
            "options": [
                {"label": "男", "value": "male"},
                {"label": "女", "value": "female"}
            ]
        }
        placeholder = PlaceholderInfo(**data)
        assert placeholder.type == "select"
        assert len(placeholder.options) == 2
        assert placeholder.options[0]["label"] == "男"


class TestTemplateDetailInfo:
    """测试模板详细信息 Schema"""
    
    def test_template_with_placeholders(self):
        """测试带占位符的模板"""
        data = {
            "id": 1,
            "name": "起诉状模板",
            "description": "测试模板",
            "category": "民事诉讼",
            "status": "published",
            "prosemirror_json": {"type": "doc", "content": []},
            "docx_url": "https://example.com/template.docx",
            "created_at": datetime(2024, 1, 1),
            "updated_at": datetime(2024, 1, 1),
            "placeholders": [
                {
                    "id": 1,
                    "placeholder_name": "name",
                    "label": "姓名",
                    "type": "text",
                    "required": True
                }
            ]
        }
        template = TemplateDetailInfo(**data)
        assert template.id == 1
        assert len(template.placeholders) == 1
        assert template.placeholders[0].placeholder_name == "name"
    
    def test_template_without_placeholders(self):
        """测试没有占位符的模板"""
        data = {
            "id": 1,
            "name": "简单模板",
            "status": "published",
            "prosemirror_json": {"type": "doc", "content": []},
            "created_at": datetime(2024, 1, 1),
            "updated_at": datetime(2024, 1, 1),
            "placeholders": []
        }
        template = TemplateDetailInfo(**data)
        assert len(template.placeholders) == 0


class TestDocumentGenerationDetailResponse:
    """测试文书生成详情响应 Schema"""
    
    def test_full_detail_response(self):
        """测试完整的详情响应"""
        data = {
            "id": 1,
            "case_id": 10,
            "template_id": 20,
            "form_data": {"name": "张三", "amount": 10000},
            "created_at": datetime(2024, 1, 1),
            "updated_at": datetime(2024, 1, 1),
            "case": {
                "id": 10,
                "case_status": "draft",
                "description": "测试案件"
            },
            "template": {
                "id": 20,
                "name": "起诉状模板",
                "status": "published",
                "prosemirror_json": {"type": "doc", "content": []},
                "created_at": datetime(2024, 1, 1),
                "updated_at": datetime(2024, 1, 1),
                "placeholders": []
            }
        }
        response = DocumentGenerationDetailResponse(**data)
        assert response.id == 1
        assert response.case.id == 10
        assert response.template.name == "起诉状模板"
        assert response.form_data["name"] == "张三"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

