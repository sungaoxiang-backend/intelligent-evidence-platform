"""
文书生成模块的数据模式
"""

from typing import Dict, Any, Optional, List, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime


class DocumentGenerateRequest(BaseModel):
    """文书生成请求（传统方式，需要完整变量）"""
    template_id: str = Field(..., description="模板ID")
    case_id: int = Field(..., description="案件ID")
    variables: Optional[Dict[str, Any]] = Field(default_factory=dict, description="自定义变量")
    
    @validator('template_id')
    def validate_template_id(cls, v):
        if not v or not v.strip():
            raise ValueError('模板ID不能为空')
        return v.strip()


class DocumentGenerateByCaseRequest(BaseModel):
    """通过案件ID生成文书请求"""
    template_id: str = Field(..., description="模板ID")
    case_id: int = Field(..., description="案件ID")
    custom_variables: Optional[Dict[str, Any]] = Field(default_factory=dict, description="自定义变量（覆盖案件数据）")
    
    @validator('template_id')
    def validate_template_id(cls, v):
        if not v or not v.strip():
            raise ValueError('模板ID不能为空')
        return v.strip()
    
    @validator('case_id')
    def validate_case_id(cls, v):
        if v <= 0:
            raise ValueError('案件ID必须大于0')
        return v


class DocumentGenerateResponse(BaseModel):
    """文书生成响应"""
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="响应消息")
    file_path: Optional[str] = Field(None, description="生成的文件路径")
    filename: Optional[str] = Field(None, description="文件名")


class DocumentTemplateInfo(BaseModel):
    """文书模板信息"""
    template_id: str = Field(..., description="模板ID")
    name: str = Field(..., description="模板名称")
    type: str = Field(..., description="文书类型")
    description: str = Field(..., description="模板描述")
    file_path: str = Field(..., description="模板文件路径")
    variables: List[Dict[str, Any]] = Field(..., description="模板变量定义")


class CaseDataForDocument(BaseModel):
    """案件数据"""
    case_id: int = Field(..., description="案件ID")
    case_type: str = Field(..., description="案件类型")
    
    # 原告信息
    creditor_name: str = Field(..., description="原告姓名")
    creditor_type: str = Field(..., description="原告类型")
    creditor_gender: Optional[str] = Field(default="", description="原告性别")
    creditor_birthday: Optional[str] = Field(default="", description="原告出生日期")
    creditor_nation: Optional[str] = Field(default="汉族", description="原告民族")
    creditor_address: Optional[str] = Field(default="", description="原告住址")
    creditor_id_card: Optional[str] = Field(default="", description="原告公民身份号码")
    creditor_phone: Optional[str] = Field(default="", description="原告联系电话")
    
    # 被告信息
    debtor_name: str = Field(..., description="被告姓名")
    debtor_gender: Optional[str] = Field(default="", description="被告性别")
    debtor_birthday: Optional[str] = Field(default="", description="被告出生日期")
    debtor_nation: Optional[str] = Field(default="汉族", description="被告民族")
    debtor_address: Optional[str] = Field(default="", description="被告住址")
    debtor_id_card: Optional[str] = Field(default="", description="被告公民身份号码")
    debtor_phone: Optional[str] = Field(default="", description="被告联系电话")
    
    # 案件详情
    loan_amount: float = Field(..., description="货款金额")
    description: Optional[str] = Field(default="", description="案件描述")
    
    # 其他信息
    court_address: Optional[str] = Field(default="某某人民法院", description="受理法院地址")
    created_at: Union[datetime, str] = Field(default_factory=lambda: datetime.now(), description="创建时间")
    
    @validator('loan_amount')
    def validate_loan_amount(cls, v):
        if v <= 0:
            raise ValueError('货款金额必须大于0')
        return v
    
    @validator('creditor_name', 'debtor_name')
    def validate_names(cls, v):
        if not v or not v.strip():
            raise ValueError('姓名不能为空')
        return v.strip()


class DocumentRecordInfo(BaseModel):
    """文书记录信息"""
    id: str = Field(..., description="记录ID")
    template_id: str = Field(..., description="模板ID")
    case_id: int = Field(..., description="案件ID")
    document_type: str = Field(..., description="文书类型")
    file_path: str = Field(..., description="文件路径")
    filename: str = Field(..., description="文件名")
    variables_used: Dict[str, Any] = Field(..., description="使用的变量")
    generated_at: datetime = Field(..., description="生成时间")


class HealthCheckResponse(BaseModel):
    """健康检查响应"""
    status: str = Field(..., description="系统状态")
    template_dir_exists: bool = Field(..., description="模板目录是否存在")
    output_dir_exists: bool = Field(..., description="输出目录是否存在")
    template_dir: str = Field(..., description="模板目录路径")
    output_dir: str = Field(..., description="输出目录路径")
    error: Optional[str] = Field(None, description="错误信息")
