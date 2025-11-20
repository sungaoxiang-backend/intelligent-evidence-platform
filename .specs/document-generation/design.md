# 文书生成功能设计文档

## Overview

文书生成功能是一个基于已发布模板的文书填写和生成系统。它允许员工为特定案件选择模板，通过表单填写占位符内容，并生成可下载的DOCX文书。该功能复用了模板编辑器的核心能力（ProseMirror解析、DOCX转换），但提供了全新的用户体验：将模板占位符转换为交互式表单组件，支持草稿自动保存，并实现了案件维度的文书管理。

### 核心特性

1. **案件关联** - 每个文书生成记录都关联到特定案件和模板
2. **智能表单** - 根据占位符元数据自动渲染合适的表单组件
3. **草稿管理** - 自动保存填写进度，支持断点续填
4. **实时预览** - 填写内容实时反映在文书预览中
5. **灵活生成** - 支持未填写完整的占位符，生成时保留占位符标记

## Architecture

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Navigation  │  │  Page Route  │  │  API Client     │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Document Generation Page                   │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  ┌────────────┐  ┌──────────────────────────────┐   │   │
│  │  │  Template  │  │  Content Area                │   │   │
│  │  │  List      │  │  ┌────────────────────────┐  │   │   │
│  │  │  Sidebar   │  │  │  Case Selector         │  │   │   │
│  │  │            │  │  ├────────────────────────┤  │   │   │
│  │  │  - Search  │  │  │  Tabs                  │  │   │   │
│  │  │  - Filter  │  │  │  ┌──────┐  ┌────────┐ │  │   │   │
│  │  │  - Items   │  │  │  │ Form │  │Preview │ │  │   │   │
│  │  │            │  │  │  └──────┘  └────────┘ │  │   │   │
│  │  └────────────┘  │  └────────────────────────┘  │   │   │
│  │                  │  ┌────────────────────────┐  │   │   │
│  │                  │  │  Action Buttons        │  │   │   │
│  │                  │  └────────────────────────┘  │   │   │
│  │                  └──────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/JSON
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │             FastAPI Application                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Document Generation Router                  │   │
│  │  - GET /templates (published)                        │   │
│  │  - GET /generations/:id                              │   │
│  │  - POST /generations                                 │   │
│  │  - PATCH /generations/:id                            │   │
│  │  - POST /generations/:id/export                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       Document Generation Service                    │   │
│  │  - createOrGetGeneration()                           │   │
│  │  - updateGenerationData()                            │   │
│  │  - generateDocument()                                │   │
│  │  - getPublishedTemplates()                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Template Editor Service (复用)               │   │
│  │  - export_prosemirror_to_docx()                      │   │
│  │  - replacePlaceholders()                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Database Layer                          │   │
│  │  ┌─────────────────┐  ┌───────────────────────┐     │   │
│  │  │ DocumentGenera- │  │ DocumentTemplate      │     │   │
│  │  │ tion            │  │ (复用)                │     │   │
│  │  ├─────────────────┤  ├───────────────────────┤     │   │
│  │  │ - case_id       │  │ - id                  │     │   │
│  │  │ - template_id   │  │ - name                │     │   │
│  │  │ - form_data     │  │ - status              │     │   │
│  │  │ - created_by    │  │ - prosemirror_json    │     │   │
│  │  └─────────────────┘  └───────────────────────┘     │   │
│  │                                                          │
│  │  ┌─────────────────┐  ┌───────────────────────┐     │   │
│  │  │ Case            │  │ TemplatePlaceholder   │     │   │
│  │  │ (复用)          │  │ (复用)                │     │   │
│  │  └─────────────────┘  └───────────────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
1. 员工访问文书生成页面
   ↓
2. 选择案件（从案件详情进入或通过选择器）
   ↓
3. 加载已发布模板列表
   ↓
4. 选择模板 → 创建或获取 DocumentGeneration 记录
   ↓
5. 加载模板的 ProseMirror JSON 和占位符元数据
   ↓
6. 渲染表单（基于占位符元数据） + 预览区（基于模板内容）
   ↓
7. 填写表单 → 自动保存草稿（防抖 2s）
   ↓
8. 实时更新预览区（本地渲染）
   ↓
9. 点击"生成文书" → 调用后端 API
   ↓
10. 后端替换占位符 → 生成 DOCX → 返回下载 URL
   ↓
11. 前端触发文件下载
```

## Components and Interfaces

### Backend Components

#### 1. 数据模型

##### DocumentGeneration Model

```python
class DocumentGeneration(Base):
    """文书生成模型"""
    
    __tablename__ = "document_generations"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # 外键关联
    case_id: Mapped[int] = mapped_column(
        ForeignKey("cases.id"), 
        nullable=False, 
        index=True,
        comment="关联的案件ID"
    )
    template_id: Mapped[int] = mapped_column(
        ForeignKey("document_templates.id"),
        nullable=False,
        index=True,
        comment="关联的模板ID"
    )
    
    # 表单数据（JSON 格式存储）
    form_data: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        comment="占位符填写数据，格式：{placeholder_name: value}"
    )
    
    # 创建和更新信息
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("staffs.id"),
        nullable=True,
        comment="创建人ID"
    )
    updated_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("staffs.id"),
        nullable=True,
        comment="最后更新人ID"
    )
    
    # 时间戳
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    
    # 关系
    case = relationship("Case", back_populates="document_generations")
    template = relationship("DocumentTemplate", back_populates=None)
    created_by = relationship("Staff", foreign_keys=[created_by_id])
    updated_by = relationship("Staff", foreign_keys=[updated_by_id])
    
    __table_args__ = (
        # 唯一约束：同一案件下的同一模板只能有一个文书生成记录
        UniqueConstraint("case_id", "template_id", name="uq_case_template"),
        Index("idx_document_generations_case_id", "case_id"),
        Index("idx_document_generations_template_id", "template_id"),
    )
```

##### Case Model 扩展

```python
# 在 Case 模型中添加关系
class Case(Base):
    # ... 现有字段 ...
    
    # 新增关系
    document_generations = relationship(
        "DocumentGeneration",
        back_populates="case",
        cascade="all, delete-orphan"
    )
```

#### 2. Schemas (Pydantic 模型)

```python
# 请求 Schema

class DocumentGenerationCreateRequest(BaseModel):
    """创建文书生成记录请求"""
    case_id: int = Field(..., description="案件ID")
    template_id: int = Field(..., description="模板ID")


class DocumentGenerationUpdateRequest(BaseModel):
    """更新文书生成草稿请求"""
    form_data: Dict[str, Any] = Field(..., description="占位符填写数据")


class DocumentGenerationExportRequest(BaseModel):
    """导出文书请求"""
    filename: Optional[str] = Field(None, description="导出文件名")


# 响应 Schema

class DocumentGenerationResponse(BaseModel):
    """文书生成记录响应"""
    id: int
    case_id: int
    template_id: int
    form_data: Dict[str, Any]
    created_by_id: Optional[int]
    updated_by_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    # 关联数据
    case: Optional[Any] = None  # Case 简化信息
    template: Optional[Any] = None  # Template 简化信息
    
    class Config:
        from_attributes = True


class DocumentGenerationDetailResponse(BaseModel):
    """文书生成详情响应（包含完整的模板内容）"""
    id: int
    case_id: int
    template_id: int
    form_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    # 完整的模板数据
    template: TemplateResponse
    
    # 案件基本信息
    case: Dict[str, Any]
    
    class Config:
        from_attributes = True


class PublishedTemplateListResponse(BaseModel):
    """已发布模板列表响应"""
    code: int = Field(200, description="状态码")
    message: str = Field("查询成功", description="消息")
    data: List[TemplateResponse] = Field(..., description="模板列表")
    total: int = Field(..., description="总数")
```

#### 3. Service Layer

```python
class DocumentGenerationService:
    """文书生成服务"""
    
    async def get_published_templates(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        search: Optional[str] = None
    ) -> Tuple[List[DocumentTemplate], int]:
        """
        获取已发布的模板列表
        
        Args:
            db: 数据库会话
            skip: 跳过记录数
            limit: 返回记录数
            category: 分类过滤
            search: 搜索关键词
            
        Returns:
            (模板列表, 总数)
        """
        query = select(DocumentTemplate).where(
            DocumentTemplate.status == "published"
        )
        
        if category:
            query = query.where(DocumentTemplate.category == category)
        
        if search:
            query = query.where(
                DocumentTemplate.name.ilike(f"%{search}%")
            )
        
        # 获取总数
        count_query = select(func.count()).select_from(query.subquery())
        total = await db.scalar(count_query)
        
        # 获取数据
        query = query.order_by(DocumentTemplate.updated_at.desc())
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        templates = result.scalars().all()
        
        return templates, total
    
    async def create_or_get_generation(
        self,
        db: AsyncSession,
        case_id: int,
        template_id: int,
        staff_id: int
    ) -> DocumentGeneration:
        """
        创建或获取文书生成记录（同一案件同一模板唯一）
        
        Args:
            db: 数据库会话
            case_id: 案件ID
            template_id: 模板ID
            staff_id: 员工ID
            
        Returns:
            文书生成记录
            
        Raises:
            HTTPException: 案件或模板不存在
        """
        # 验证案件存在
        case = await db.get(Case, case_id)
        if not case:
            raise HTTPException(
                status_code=404,
                detail="案件不存在"
            )
        
        # 验证模板存在且已发布
        template = await db.get(DocumentTemplate, template_id)
        if not template:
            raise HTTPException(
                status_code=404,
                detail="模板不存在"
            )
        if template.status != "published":
            raise HTTPException(
                status_code=400,
                detail="模板未发布"
            )
        
        # 查找现有记录
        query = select(DocumentGeneration).where(
            DocumentGeneration.case_id == case_id,
            DocumentGeneration.template_id == template_id
        )
        result = await db.execute(query)
        generation = result.scalar_one_or_none()
        
        if generation:
            # 更新访问时间
            generation.updated_at = datetime.now()
            generation.updated_by_id = staff_id
            await db.commit()
            await db.refresh(generation)
            return generation
        
        # 创建新记录
        generation = DocumentGeneration(
            case_id=case_id,
            template_id=template_id,
            form_data={},
            created_by_id=staff_id,
            updated_by_id=staff_id
        )
        db.add(generation)
        await db.commit()
        await db.refresh(generation)
        
        return generation
    
    async def get_generation_detail(
        self,
        db: AsyncSession,
        generation_id: int
    ) -> Optional[DocumentGeneration]:
        """
        获取文书生成记录详情（包含关联数据）
        
        Args:
            db: 数据库会话
            generation_id: 文书生成记录ID
            
        Returns:
            文书生成记录
        """
        query = select(DocumentGeneration).where(
            DocumentGeneration.id == generation_id
        ).options(
            selectinload(DocumentGeneration.case).selectinload(Case.case_parties),
            selectinload(DocumentGeneration.template).selectinload(
                DocumentTemplate.placeholders
            )
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def update_generation_data(
        self,
        db: AsyncSession,
        generation_id: int,
        form_data: Dict[str, Any],
        staff_id: int
    ) -> DocumentGeneration:
        """
        更新文书生成的表单数据（草稿保存）
        
        Args:
            db: 数据库会话
            generation_id: 文书生成记录ID
            form_data: 表单数据
            staff_id: 员工ID
            
        Returns:
            更新后的文书生成记录
            
        Raises:
            HTTPException: 记录不存在
        """
        generation = await db.get(DocumentGeneration, generation_id)
        if not generation:
            raise HTTPException(
                status_code=404,
                detail="文书生成记录不存在"
            )
        
        generation.form_data = form_data
        generation.updated_by_id = staff_id
        generation.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(generation)
        
        return generation
    
    async def generate_document(
        self,
        db: AsyncSession,
        generation_id: int,
        filename: Optional[str] = None
    ) -> str:
        """
        生成 DOCX 文书
        
        Args:
            db: 数据库会话
            generation_id: 文书生成记录ID
            filename: 文件名（可选）
            
        Returns:
            生成的文件在 COS 中的 URL
            
        Raises:
            HTTPException: 记录不存在或生成失败
        """
        # 获取文书生成记录及关联数据
        generation = await self.get_generation_detail(db, generation_id)
        if not generation:
            raise HTTPException(
                status_code=404,
                detail="文书生成记录不存在"
            )
        
        # 获取模板的 ProseMirror JSON
        prosemirror_json = generation.template.prosemirror_json
        
        # 替换占位符
        replaced_json = self._replace_placeholders_in_json(
            prosemirror_json,
            generation.form_data
        )
        
        # 使用模板编辑器服务生成 DOCX
        docx_bytes = template_editor_service.export_prosemirror_to_docx(
            replaced_json
        )
        
        # 生成文件名
        if not filename:
            template_name = generation.template.name
            case_id = generation.case_id
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{template_name}_案件{case_id}_{timestamp}.docx"
        
        # 上传到 COS
        file_key = f"documents/generated/{filename}"
        cos_url = await cos_service.upload_bytes(
            file_key,
            docx_bytes,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
        return cos_url
    
    def _replace_placeholders_in_json(
        self,
        prosemirror_json: Dict[str, Any],
        form_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        在 ProseMirror JSON 中替换占位符
        
        Args:
            prosemirror_json: ProseMirror JSON
            form_data: 表单数据
            
        Returns:
            替换后的 ProseMirror JSON
        """
        import copy
        import re
        
        result = copy.deepcopy(prosemirror_json)
        
        def traverse_and_replace(node: Dict[str, Any]):
            """递归遍历并替换占位符"""
            if node.get("type") == "text":
                text = node.get("text", "")
                # 替换 {{placeholder}} 格式的占位符
                def replacer(match):
                    placeholder_name = match.group(1).strip()
                    # 如果表单数据中有值，则替换；否则保留原样
                    return form_data.get(placeholder_name, match.group(0))
                
                node["text"] = re.sub(r'\{\{([^}]+)\}\}', replacer, text)
            
            # 递归处理子节点
            if "content" in node and isinstance(node["content"], list):
                for child in node["content"]:
                    traverse_and_replace(child)
        
        traverse_and_replace(result)
        return result


# 创建服务实例
document_generation_service = DocumentGenerationService()
```

#### 4. Router (API Endpoints)

```python
"""
文书生成 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.deps import get_current_staff, get_db
from app.staffs.models import Staff
from .services import document_generation_service
from .schemas import (
    DocumentGenerationCreateRequest,
    DocumentGenerationUpdateRequest,
    DocumentGenerationExportRequest,
    DocumentGenerationResponse,
    DocumentGenerationDetailResponse,
    PublishedTemplateListResponse,
)

router = APIRouter()


@router.get("/templates/published", response_model=PublishedTemplateListResponse)
async def get_published_templates(
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    获取已发布的模板列表
    
    Query Params:
        skip: 跳过记录数
        limit: 返回记录数
        category: 分类过滤
        search: 搜索关键词
    """
    templates, total = await document_generation_service.get_published_templates(
        db=db,
        skip=skip,
        limit=limit,
        category=category,
        search=search
    )
    
    return PublishedTemplateListResponse(
        data=templates,
        total=total
    )


@router.post("/generations", response_model=DocumentGenerationDetailResponse)
async def create_or_get_generation(
    request: DocumentGenerationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
):
    """
    创建或获取文书生成记录
    
    如果同一案件和模板的记录已存在，则返回现有记录
    """
    generation = await document_generation_service.create_or_get_generation(
        db=db,
        case_id=request.case_id,
        template_id=request.template_id,
        staff_id=current_staff.id
    )
    
    # 重新加载完整数据
    generation = await document_generation_service.get_generation_detail(
        db=db,
        generation_id=generation.id
    )
    
    return generation


@router.get("/generations/{generation_id}", response_model=DocumentGenerationDetailResponse)
async def get_generation_detail(
    generation_id: int,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
):
    """获取文书生成记录详情"""
    generation = await document_generation_service.get_generation_detail(
        db=db,
        generation_id=generation_id
    )
    
    if not generation:
        raise HTTPException(
            status_code=404,
            detail="文书生成记录不存在"
        )
    
    return generation


@router.patch("/generations/{generation_id}", response_model=DocumentGenerationResponse)
async def update_generation_data(
    generation_id: int,
    request: DocumentGenerationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
):
    """更新文书生成的表单数据（草稿保存）"""
    generation = await document_generation_service.update_generation_data(
        db=db,
        generation_id=generation_id,
        form_data=request.form_data,
        staff_id=current_staff.id
    )
    
    return generation


@router.post("/generations/{generation_id}/export")
async def export_generation_document(
    generation_id: int,
    request: DocumentGenerationExportRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
):
    """
    生成并导出 DOCX 文书
    
    Returns:
        { "url": "cos_url", "filename": "xxx.docx" }
    """
    cos_url = await document_generation_service.generate_document(
        db=db,
        generation_id=generation_id,
        filename=request.filename
    )
    
    # 提取文件名
    filename = cos_url.split("/")[-1]
    
    return {
        "code": 200,
        "message": "生成成功",
        "data": {
            "url": cos_url,
            "filename": filename
        }
    }
```

### Frontend Components

#### 1. 页面路由

```
/document-generation
  - 文书生成主页面
  - 左侧：已发布模板列表
  - 右侧：案件选择器 + 表单 + 预览区

/cases/[caseId]/document-generation
  - 从案件详情进入的文书生成页面
  - 自动关联案件，省略案件选择步骤
```

#### 2. 组件结构

```
frontend/app/document-generation/
  └── page.tsx                          # 主页面路由

frontend/components/document-generation/
  ├── document-generation-page.tsx      # 主页面组件
  ├── template-list-sidebar.tsx         # 模板列表侧边栏
  ├── case-selector.tsx                 # 案件选择器
  ├── generation-form.tsx               # 表单区域
  ├── generation-preview.tsx            # 预览区域
  ├── placeholder-field-renderer.tsx    # 占位符字段渲染器
  └── generation-tabs.tsx               # 表单/预览切换标签

frontend/lib/
  └── document-generation-api.ts        # API 客户端
```

#### 3. 核心组件设计

##### DocumentGenerationPage (主页面)

```typescript
interface DocumentGenerationPageProps {
  initialCaseId?: number  // 从案件详情进入时提供
}

export function DocumentGenerationPage({ initialCaseId }: DocumentGenerationPageProps) {
  // 状态管理
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(initialCaseId ?? null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [generation, setGeneration] = useState<DocumentGeneration | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  
  // 草稿自动保存（防抖）
  const debouncedSave = useDebouncedCallback(
    async (data: Record<string, any>) => {
      if (!generation) return
      await updateGenerationData(generation.id, data)
      toast.success("已保存")
    },
    2000
  )
  
  // 表单数据变更处理
  const handleFormDataChange = (key: string, value: any) => {
    const newData = { ...formData, [key]: value }
    setFormData(newData)
    debouncedSave(newData)
  }
  
  // 生成文书
  const handleGenerateDocument = async () => {
    if (!generation) return
    
    try {
      const result = await exportGenerationDocument(generation.id)
      // 触发下载
      window.open(result.url, '_blank')
      toast.success("文书生成成功")
    } catch (error) {
      toast.error("文书生成失败")
    }
  }
  
  return (
    <div className="flex h-screen">
      {/* 左侧模板列表 */}
      <TemplateListSidebar
        selectedId={selectedTemplateId}
        onSelect={handleTemplateSelect}
      />
      
      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 案件选择器 */}
        {!initialCaseId && (
          <CaseSelector
            selectedCaseId={selectedCaseId}
            onChange={setSelectedCaseId}
          />
        )}
        
        {/* 标签切换 */}
        <GenerationTabs
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        
        {/* 内容区 */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'form' ? (
            <GenerationForm
              placeholders={generation?.template.placeholders}
              formData={formData}
              onChange={handleFormDataChange}
            />
          ) : (
            <GenerationPreview
              template={generation?.template}
              formData={formData}
            />
          )}
        </div>
        
        {/* 操作按钮 */}
        <div className="border-t p-4">
          <Button onClick={handleGenerateDocument}>
            生成文书
          </Button>
        </div>
      </div>
    </div>
  )
}
```

##### PlaceholderFieldRenderer (字段渲染器)

```typescript
interface PlaceholderFieldRendererProps {
  placeholder: PlaceholderMeta
  value: any
  onChange: (value: any) => void
}

export function PlaceholderFieldRenderer({
  placeholder,
  value,
  onChange
}: PlaceholderFieldRendererProps) {
  const { type, label, hint, options, default_value } = placeholder
  
  // 根据类型渲染对应组件
  switch (type) {
    case 'text':
      return (
        <FormField>
          <Label>{label || placeholder.placeholder_name}</Label>
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={hint}
          />
        </FormField>
      )
    
    case 'textarea':
      return (
        <FormField>
          <Label>{label || placeholder.placeholder_name}</Label>
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={hint}
          />
        </FormField>
      )
    
    case 'select':
      return (
        <FormField>
          <Label>{label || placeholder.placeholder_name}</Label>
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={hint || "请选择"} />
            </SelectTrigger>
            <SelectContent>
              {options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )
    
    case 'radio':
      return (
        <FormField>
          <Label>{label || placeholder.placeholder_name}</Label>
          <RadioGroup value={value || ''} onValueChange={onChange}>
            {options?.map(opt => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={opt.value} />
                <Label htmlFor={opt.value}>{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </FormField>
      )
    
    case 'checkbox':
      // 多选值为数组
      const checkedValues = Array.isArray(value) ? value : []
      return (
        <FormField>
          <Label>{label || placeholder.placeholder_name}</Label>
          <div className="space-y-2">
            {options?.map(opt => (
              <div key={opt.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={checkedValues.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...checkedValues, opt.value]
                      : checkedValues.filter(v => v !== opt.value)
                    onChange(newValues)
                  }}
                  id={opt.value}
                />
                <Label htmlFor={opt.value}>{opt.label}</Label>
              </div>
            ))}
          </div>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </FormField>
      )
    
    case 'date':
      return (
        <FormField>
          <Label>{label || placeholder.placeholder_name}</Label>
          <DatePicker
            value={value ? new Date(value) : undefined}
            onChange={(date) => onChange(date?.toISOString())}
          />
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </FormField>
      )
    
    case 'number':
      return (
        <FormField>
          <Label>{label || placeholder.placeholder_name}</Label>
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
            placeholder={hint}
          />
        </FormField>
      )
    
    default:
      return null
  }
}
```

##### GenerationPreview (预览组件)

```typescript
interface GenerationPreviewProps {
  template: TemplateResponse | null
  formData: Record<string, any>
}

export function GenerationPreview({ template, formData }: GenerationPreviewProps) {
  // 计算预览内容：替换占位符
  const previewContent = useMemo(() => {
    if (!template) return null
    
    // 深拷贝 prosemirror_json
    const content = JSON.parse(JSON.stringify(template.prosemirror_json))
    
    // 递归替换占位符
    function replaceInNode(node: any) {
      if (node.type === 'text' && node.text) {
        node.text = node.text.replace(/\{\{([^}]+)\}\}/g, (match: string, key: string) => {
          const trimmedKey = key.trim()
          return formData[trimmedKey] ?? match
        })
      }
      
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(replaceInNode)
      }
    }
    
    replaceInNode(content)
    return content
  }, [template, formData])
  
  return (
    <div className="p-8 bg-white">
      {previewContent && (
        <DocumentPreview content={previewContent} readOnly />
      )}
    </div>
  )
}
```

#### 4. API Client

```typescript
// frontend/lib/document-generation-api.ts

export const documentGenerationApi = {
  // 获取已发布模板列表
  async getPublishedTemplates(params?: {
    skip?: number
    limit?: number
    category?: string
    search?: string
  }) {
    const response = await fetch(
      `/api/v1/document-generation/templates/published?${new URLSearchParams(params as any)}`,
      { headers: getAuthHeaders() }
    )
    return response.json()
  },
  
  // 创建或获取文书生成记录
  async createOrGetGeneration(caseId: number, templateId: number) {
    const response = await fetch(
      '/api/v1/document-generation/generations',
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ case_id: caseId, template_id: templateId })
      }
    )
    return response.json()
  },
  
  // 更新草稿数据
  async updateGenerationData(generationId: number, formData: Record<string, any>) {
    const response = await fetch(
      `/api/v1/document-generation/generations/${generationId}`,
      {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ form_data: formData })
      }
    )
    return response.json()
  },
  
  // 生成并导出文书
  async exportGenerationDocument(generationId: number, filename?: string) {
    const response = await fetch(
      `/api/v1/document-generation/generations/${generationId}/export`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ filename })
      }
    )
    return response.json()
  }
}
```

## Data Models

### 数据库表结构

#### document_generations 表

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY | 主键 |
| case_id | INTEGER | NOT NULL, FK → cases.id | 关联案件ID |
| template_id | INTEGER | NOT NULL, FK → document_templates.id | 关联模板ID |
| form_data | JSON | NOT NULL, DEFAULT {} | 占位符填写数据 |
| created_by_id | INTEGER | FK → staffs.id | 创建人ID |
| updated_by_id | INTEGER | FK → staffs.id | 更新人ID |
| created_at | TIMESTAMP | NOT NULL | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 更新时间 |

**索引:**
- `idx_document_generations_case_id` (case_id)
- `idx_document_generations_template_id` (template_id)

**唯一约束:**
- `uq_case_template` (case_id, template_id)

### 数据关系图

```
┌─────────────────┐
│     cases       │
├─────────────────┤
│ id (PK)         │───┐
│ ...             │   │
└─────────────────┘   │
                      │ 1:N
                      │
                      ▼
          ┌──────────────────────────┐
          │  document_generations    │
          ├──────────────────────────┤
          │ id (PK)                  │
          │ case_id (FK)             │
          │ template_id (FK)         │
          │ form_data                │
          │ ...                      │
          └──────────────────────────┘
                      │
                      │ N:1
                      │
                      ▼
          ┌─────────────────────┐
          │ document_templates  │
          ├─────────────────────┤
          │ id (PK)             │
          │ name                │
          │ status              │
          │ prosemirror_json    │
          │ ...                 │
          └─────────────────────┘
                      │
                      │ M:N
                      │
                      ▼
          ┌──────────────────────┐
          │ template_placeholders│
          ├──────────────────────┤
          │ id (PK)              │
          │ placeholder_name     │
          │ type                 │
          │ label                │
          │ options              │
          │ ...                  │
          └──────────────────────┘
```

## Error Handling

### 错误类型和处理策略

#### 1. 客户端错误 (4xx)

| 错误码 | 场景 | 响应示例 | 前端处理 |
|--------|------|----------|----------|
| 400 | 模板未发布 | `{"detail": "模板未发布"}` | Toast 错误提示 |
| 401 | 未登录或令牌过期 | `{"detail": "无法验证凭据"}` | 重定向到登录页 |
| 404 | 资源不存在 | `{"detail": "案件不存在"}` | Toast 错误提示 + 返回列表页 |
| 409 | 数据冲突 | `{"detail": "记录已存在"}` | 提示用户 |

#### 2. 服务器错误 (5xx)

| 错误码 | 场景 | 响应示例 | 前端处理 |
|--------|------|----------|----------|
| 500 | 文书生成失败 | `{"detail": "生成文书时发生错误"}` | Toast 错误 + 详细错误信息 |
| 503 | COS 服务不可用 | `{"detail": "文件上传服务暂时不可用"}` | Toast 错误 + 重试按钮 |

#### 3. 业务逻辑错误

```python
class DocumentGenerationError(Exception):
    """文书生成业务错误基类"""
    pass

class TemplateNotPublishedError(DocumentGenerationError):
    """模板未发布错误"""
    pass

class CaseNotFoundError(DocumentGenerationError):
    """案件不存在错误"""
    pass

class GenerationNotFoundError(DocumentGenerationError):
    """文书生成记录不存在错误"""
    pass
```

#### 4. 前端错误处理

```typescript
// 统一错误处理函数
async function handleApiError(error: any) {
  if (error.status === 401) {
    // 未授权，跳转登录
    router.push('/login')
  } else if (error.status === 404) {
    toast.error('资源不存在')
  } else if (error.status >= 500) {
    toast.error('服务器错误，请稍后重试')
  } else {
    toast.error(error.detail || '操作失败')
  }
}

// 使用示例
try {
  await documentGenerationApi.createOrGetGeneration(caseId, templateId)
} catch (error) {
  await handleApiError(error)
}
```

## Testing Strategy

### 后端测试

#### 1. 单元测试

```python
# tests/test_document_generation_service.py

async def test_create_or_get_generation_creates_new():
    """测试创建新的文书生成记录"""
    generation = await document_generation_service.create_or_get_generation(
        db=db,
        case_id=1,
        template_id=1,
        staff_id=1
    )
    assert generation.case_id == 1
    assert generation.template_id == 1
    assert generation.form_data == {}


async def test_create_or_get_generation_returns_existing():
    """测试返回已存在的文书生成记录"""
    # 第一次创建
    gen1 = await document_generation_service.create_or_get_generation(
        db=db, case_id=1, template_id=1, staff_id=1
    )
    
    # 第二次应返回相同记录
    gen2 = await document_generation_service.create_or_get_generation(
        db=db, case_id=1, template_id=1, staff_id=1
    )
    
    assert gen1.id == gen2.id


async def test_update_generation_data():
    """测试更新草稿数据"""
    generation = await document_generation_service.create_or_get_generation(
        db=db, case_id=1, template_id=1, staff_id=1
    )
    
    form_data = {"name": "张三", "date": "2024-01-01"}
    updated = await document_generation_service.update_generation_data(
        db=db,
        generation_id=generation.id,
        form_data=form_data,
        staff_id=1
    )
    
    assert updated.form_data == form_data


async def test_replace_placeholders_in_json():
    """测试占位符替换"""
    prosemirror_json = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "姓名：{{name}}，日期：{{date}}"}
                ]
            }
        ]
    }
    
    form_data = {"name": "张三", "date": "2024-01-01"}
    
    result = document_generation_service._replace_placeholders_in_json(
        prosemirror_json,
        form_data
    )
    
    text = result["content"][0]["content"][0]["text"]
    assert text == "姓名：张三，日期：2024-01-01"


async def test_replace_placeholders_keeps_unfilled():
    """测试未填写的占位符保持原样"""
    prosemirror_json = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "姓名：{{name}}，地址：{{address}}"}
                ]
            }
        ]
    }
    
    form_data = {"name": "张三"}  # 只填写了 name
    
    result = document_generation_service._replace_placeholders_in_json(
        prosemirror_json,
        form_data
    )
    
    text = result["content"][0]["content"][0]["text"]
    assert text == "姓名：张三，地址：{{address}}"  # address 保持占位符
```

#### 2. 集成测试

```python
# tests/test_document_generation_api.py

async def test_get_published_templates(client):
    """测试获取已发布模板列表"""
    response = await client.get(
        "/api/v1/document-generation/templates/published",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data


async def test_create_generation_flow(client):
    """测试完整的文书生成流程"""
    # 1. 创建文书生成记录
    response = await client.post(
        "/api/v1/document-generation/generations",
        json={"case_id": 1, "template_id": 1},
        headers=auth_headers
    )
    assert response.status_code == 200
    generation = response.json()
    generation_id = generation["id"]
    
    # 2. 更新草稿数据
    form_data = {"name": "张三", "date": "2024-01-01"}
    response = await client.patch(
        f"/api/v1/document-generation/generations/{generation_id}",
        json={"form_data": form_data},
        headers=auth_headers
    )
    assert response.status_code == 200
    
    # 3. 生成文书
    response = await client.post(
        f"/api/v1/document-generation/generations/{generation_id}/export",
        json={},
        headers=auth_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert "url" in result["data"]
```

### 前端测试

#### 1. 组件测试

```typescript
// components/__tests__/placeholder-field-renderer.test.tsx

describe('PlaceholderFieldRenderer', () => {
  it('renders text input for text type', () => {
    const placeholder = {
      type: 'text',
      label: '姓名',
      placeholder_name: 'name'
    }
    
    render(
      <PlaceholderFieldRenderer
        placeholder={placeholder}
        value=""
        onChange={jest.fn()}
      />
    )
    
    expect(screen.getByLabelText('姓名')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
  
  it('renders select for select type', () => {
    const placeholder = {
      type: 'select',
      label: '性别',
      placeholder_name: 'gender',
      options: [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' }
      ]
    }
    
    render(
      <PlaceholderFieldRenderer
        placeholder={placeholder}
        value=""
        onChange={jest.fn()}
      />
    )
    
    expect(screen.getByLabelText('性别')).toBeInTheDocument()
  })
  
  it('calls onChange when value changes', async () => {
    const onChange = jest.fn()
    const placeholder = {
      type: 'text',
      label: '姓名',
      placeholder_name: 'name'
    }
    
    render(
      <PlaceholderFieldRenderer
        placeholder={placeholder}
        value=""
        onChange={onChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '张三')
    
    expect(onChange).toHaveBeenCalled()
  })
})
```

#### 2. 端到端测试

```typescript
// e2e/document-generation.spec.ts

test('complete document generation flow', async ({ page }) => {
  // 1. 登录
  await page.goto('/login')
  await page.fill('[name=username]', 'testuser')
  await page.fill('[name=password]', 'password')
  await page.click('button[type=submit]')
  
  // 2. 进入文书生成页面
  await page.goto('/document-generation')
  
  // 3. 选择案件
  await page.click('[data-testid=case-selector]')
  await page.click('[data-testid=case-option-1]')
  
  // 4. 选择模板
  await page.click('[data-testid=template-item-1]')
  
  // 5. 填写表单
  await page.fill('[name=name]', '张三')
  await page.fill('[name=date]', '2024-01-01')
  
  // 6. 等待自动保存
  await page.waitForTimeout(2500)
  await expect(page.locator('text=已保存')).toBeVisible()
  
  // 7. 切换到预览
  await page.click('[data-testid=tab-preview]')
  await expect(page.locator('text=张三')).toBeVisible()
  
  // 8. 生成文书
  await page.click('button:has-text("生成文书")')
  await expect(page.locator('text=文书生成成功')).toBeVisible()
})
```

## Implementation Notes

### 复用现有功能

1. **模板编辑器服务** - 复用 `template_editor_service` 的以下功能：
   - `parse_docx_to_prosemirror()` - DOCX 解析
   - `export_prosemirror_to_docx()` - DOCX 导出
   - `extract_placeholders()` - 占位符提取

2. **数据模型** - 复用以下模型：
   - `DocumentTemplate` - 文书模板
   - `TemplatePlaceholder` - 占位符元数据
   - `Case` - 案件模型

3. **前端组件** - 复用以下组件：
   - `DocumentPreview` - 文书预览组件
   - `SidebarLayout` - 侧边栏布局
   - Form 相关 UI 组件（shadcn/ui）

### 技术栈

- **Backend**: FastAPI, SQLAlchemy (async), Pydantic
- **Frontend**: Next.js 14 (App Router), React, TypeScript, TipTap, shadcn/ui
- **Database**: PostgreSQL
- **Storage**: 腾讯云 COS

### 性能优化

1. **防抖保存** - 表单自动保存使用 2 秒防抖，减少 API 调用
2. **乐观更新** - 前端预览区使用本地计算，无需等待后端
3. **分页加载** - 模板列表支持分页和搜索
4. **索引优化** - case_id 和 template_id 建立索引，加速查询

### 安全考虑

1. **身份认证** - 所有 API 都需要员工登录（JWT Token）
2. **数据验证** - 使用 Pydantic 验证所有输入数据
3. **SQL 注入防护** - 使用 SQLAlchemy ORM，参数化查询
4. **XSS 防护** - 前端使用 React 自动转义，预览区使用 TipTap 的安全渲染

### 数据库迁移

需要创建 Alembic 迁移脚本：

```python
# alembic/versions/xxx_add_document_generation.py

def upgrade():
    op.create_table(
        'document_generations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('form_data', sa.JSON(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('updated_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ),
        sa.ForeignKeyConstraint(['template_id'], ['document_templates.id'], ),
        sa.ForeignKeyConstraint(['created_by_id'], ['staffs.id'], ),
        sa.ForeignKeyConstraint(['updated_by_id'], ['staffs.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('case_id', 'template_id', name='uq_case_template')
    )
    op.create_index('idx_document_generations_case_id', 'document_generations', ['case_id'])
    op.create_index('idx_document_generations_template_id', 'document_generations', ['template_id'])

def downgrade():
    op.drop_index('idx_document_generations_template_id', table_name='document_generations')
    op.drop_index('idx_document_generations_case_id', table_name='document_generations')
    op.drop_table('document_generations')
```

