from typing import Dict, Any, Optional
import json
from pydantic import BaseModel, Field
from agno.agent import Agent
from app.agentic.llm.base import qwen_chat_model
from app.agentic.tools.smart_json_doc_gen_toolkit import SmartJsonDocGenToolkit
from app.agentic.knowledge.smart_doc_gen_kb import smart_doc_gen_kb

class PartyAnalysis(BaseModel):
    """当事人角色分析"""
    plaintiff_role_type: str = Field(..., description="原告类型: person(自然人) / company(公司) / individual(个体户)")
    defendant_role_type: str = Field(..., description="被告类型: person(自然人) / company(公司) / individual(个体户)")

class DocumentFillingMapping(BaseModel):
    """文档填充映射结果"""
    analysis: PartyAnalysis = Field(..., description="当事人类型分析")
    fillings: Dict[str, str] = Field(
        ..., 
        description="从模板结构ID到填充内容的映射。例如: {'t_0_r1_c1': '张三', 'p_0': '☑'}。重要：仅包含只需填写的字段，不需要处理的字段直接省略。"
    )
    reasoning: str = Field(
        ..., 
        description="解释映射逻辑的推理过程"
    )

class SmartJsonDocGenAgent:
    def __init__(self):
        self.toolkit = SmartJsonDocGenToolkit()
        self.agent = Agent(
            name="Smart JSON Document Generation Specialist",
            role="Legal Document Generator for Web Editor",
            model=qwen_chat_model,
            knowledge=smart_doc_gen_kb,
            search_knowledge=True,
            response_model=DocumentFillingMapping,
            instructions="""
你是法律文书生成专家。你的核心能力是"基于当事人类型进行智能填充"。
你拥有访问【法律文书生成知识库】的权限。

**核心心智模型 (Mental Model):**

0.  **第零步：查阅知识库 (Retrieve Knowledge)**
    *   **必须**根据当前需要填写的模板内容，主动搜索知识库中的**相关规则**和**类似范例**。

1.  **第一步：分析当事人角色 (Party Analysis)**
    *   阅读案件数据，确定原告 (Plaintiff) 和被告 (Defendant) 的类型。
    *   类型通常为：`person` (自然人), `company` (公司), `individual` (个体工商户)。

2.  **第二步：制定填充策略 (Filling Strategy)**
    *   **关键原则**: 
        *   **绝不修改原内容 (Immutable Template)与完整返回 (Return Full Content)**: 
            *   你只能在空白处填入内容，或将空方框 `□` 替换为勾选框 `☑`。
            *   **重要**：如果需要填充的内容有前缀标签（如 "原告：____"），必须在 `fillings` 中返回**完整的句子**（如 "原告：张三"），而不仅仅是填入的内容。如果只返回 "张三"，原有标签会被覆盖丢失。
            *   绝对不允许删除、替换或修改模板中原有的其他文字。
        *   **只填有效项 (Fill Only Valid)**: 
            *   如果是**自然人**，且模板中有"法定代表人"字段，请**直接忽略/省略**该字段 (Omit from mappings)，不要填写任何内容，也不要试图删除它。
            *   如果是**公司**，则正常填写"法定代表人"等字段。
        *   **勾选框处理**: 遇到选择题（如"是□ 否□"），请将选中的项映射为 `☑` (或其他文档约定符号)，未选中的项**不要**放入映射中（保持原样 `□`）。

3.  **第三步：执行映射 (Mapping)**
    *   将案件数据准确映射到需要填写的模板字段ID。
    *   **不要**生成任何 `__DELETE__` 指令。
    *   对于不需要填写的字段，直接在 `fillings` 字典中**省略**该 Key。

**输入:**
- 案件数据 (Case Data)
- 模板结构 (Template Structure extracted from JSON)

**输出:**
请严格按照 `DocumentFillingMapping` 格式输出 JSON。
            """,
            show_tool_calls=True,
            debug_mode=True,
        )

    async def run(self, case_context: str, content_json: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs the smart json doc generation process.
        
        Args:
            case_context: The stringified case data.
            content_json: The ProseMirror JSON content.
            
        Returns:
            The filled ProseMirror JSON content.
        """
        # Step 1: Extract structure from JSON
        structure_json = self.toolkit.extract_structure_from_json(content_json)
        
        # Step 2: Build prompt for the agent
        message = f"""
请根据以下案件数据和模板结构，生成填充映射。

【案件数据】
{case_context}

【模板结构】
{structure_json}
        """
        
        # Step 3: Get mapping from agent
        response = await self.agent.arun(message)
        mapping_result: DocumentFillingMapping = response.content
        
        # Step 4: Fill JSON using toolkit
        fillings_json = json.dumps(mapping_result.fillings, ensure_ascii=False)
        fill_result = self.toolkit.fill_json_template(content_json, fillings_json)
        
        return fill_result
