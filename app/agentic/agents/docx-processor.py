import logging
from agno.agent import Agent
from app.agentic.llm.base import qwen_chat_model
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any

logger = logging.getLogger(__name__)


class PlaceholderMetadata(BaseModel):
    """占位符元数据模型"""
    type: str = Field(..., description="字段类型：text, number, date, textarea, checkbox, multiselect")
    label: str = Field(..., description="字段显示标签")
    required: bool = Field(default=False, description="是否必填")
    default_value: Optional[Any] = Field(default=None, description="默认值")
    options: Optional[List[str]] = Field(default=None, description="选项列表（多选框和复选框需要）")


class PlaceholderIdentificationResults(BaseModel):
    """占位符识别结果"""
    placeholders: List[PlaceholderMetadata] = Field(default_factory=list, description="占位符元数据列表")
    
    def get_metadata_list(self) -> List[PlaceholderMetadata]:
        """获取占位符元数据列表"""
        return self.placeholders


class DocxProcessor:
    """DOCX文档处理器"""
    
    def __init__(self) -> None:
        self.agent = Agent(
            name="DOCX文档处理器",
            model=qwen_chat_model,
            session_state={
                "placeholder_metadata": {}  # 初始为空，运行时动态加载
            },
            add_state_in_messages=True,
            instructions=f"""
            你是一个专业的DOCX内容解析专家，你会收到一些具有结构的文本内容，其来自于从DOCX文档中解析出来的HTML内容。
            你的任务是根据你收到的HTML内容，识别出其中的占位符，并以JSON格式返回占位符的元数据。
            占位符的元数据包括：
            - 占位符的类型：text, number, date, textarea, checkbox, multiselect
            - 占位符的标签：占位符的显示标签
            - 占位符的默认值：占位符的默认值
            - 占位符的选项：占位符的选项列表（多选框和复选框需要）
            
            请以JSON格式返回识别结果。
            """,
            response_model=PlaceholderIdentificationResults,
            show_tool_calls=True,
            debug_mode=True
        )



    async def arun(self, raw_docx_content: str) -> List[PlaceholderMetadata]:
        """
        运行agent识别占位符元数据
        
        Args:
            raw_docx_content: HTML格式的文档内容
            
        Returns:
            占位符元数据列表
        """
        # 构建 message
        message_parts = ["请分析以下HTML内容，识别占位符并以JSON格式返回结果："]
        message_parts.append(f"{raw_docx_content}")
        message = "\n".join(message_parts)
        
        try:
            run_response = await self.agent.arun(message=message)
            
            # 尝试解析响应
            if hasattr(run_response, 'parsed') and run_response.parsed:
                result = run_response.parsed
                if isinstance(result, PlaceholderIdentificationResults):
                    return result.get_metadata_list()
            
            # 如果解析失败，尝试从content中提取JSON
            if hasattr(run_response, 'content') and run_response.content:
                import json
                try:
                    # 尝试提取JSON（可能包含在代码块中）
                    content = run_response.content
                    # 移除可能的markdown代码块标记
                    if '```' in content:
                        # 提取JSON部分
                        json_start = content.find('{')
                        json_end = content.rfind('}') + 1
                        if json_start >= 0 and json_end > json_start:
                            json_str = content[json_start:json_end]
                            data = json.loads(json_str)
                            # 处理两种字段名（兼容旧格式）
                            metadata_list = data.get('placeholders') or data.get('placeholder_metadata', [])
                            return [PlaceholderMetadata(**item) for item in metadata_list]
                except Exception as e:
                    logger.warning(f"解析agent响应失败: {e}")
            
            return []
        except Exception as e:
            logger.error(f"Agent运行失败: {e}")
            return []


if __name__ == "__main__":
    import asyncio
    docx_processor = DocxProcessor()
    raw_docx_content = """
        <p>姓名：李莉</p>
        <p>性别：男口女口</p>
        <p>年龄：20</p>
        <p>联系方式：13800138000</p>
        <p>邮箱：li@example.com</p>
        <p>地址：北京市海淀区</p>
        <p>邮政编码：100000</p>
        <p>身份证号：110101199001011234</p>
    """

    metadata_list = asyncio.run(docx_processor.arun(raw_docx_content))
    print(f"识别到 {len(metadata_list)} 个占位符:")
    for meta in metadata_list:
        print(f"  - {meta.label}: {meta.type}")