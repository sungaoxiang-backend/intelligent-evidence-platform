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

    1.  **第一步：理解与分析 (Understand & Analyze)**
        *   阅读案件数据，理解案件背景和当事人信息。
        *   参考通用写作指南 (`rules.md` 中的原则) 来判断文档的整体风格和要求。

    2.  **第二步：制定填充策略 (Filling Strategy)**
        *   **数据可用性原则 (Data Availability Principle)**:
            *   只填充根据案件数据**确切已知**的信息。
            *   **缺失值处理**: 如果案件数据中缺少某项信息（例如没有案号、或者某当事人缺少法定代表人信息），请**直接忽略**对应模板字段，**不要**在 `fillings` 中包含该 Key。
            *   **严禁**填充 "待填写"、"未知"、"空"、"None" 或自行编造的占位符。
        *   **绝不修改原内容 (Immutable Template) 与 智能保留标签**: 
            *   **同框标签 (In-cell Label)**: 如果要填写的**目标字段本身**包含前缀标签（例如文书中某段落内容为 "原告：____"），你必须在 `fillings` 中返回**完整的句子**（如 "原告：张三"），以触发"智能追加"逻辑，防止覆盖标签。
            *   **分离标签 (Separate Label)**: 如果**目标字段本身**是空的或仅有占位符（如表格中左列是"姓名"，右列是空的），**绝对不要**在填充内容中重复添加左列的标签。直接填入值即可（如 "张三"）。
            *   你只能在空白处填入内容，或将空方框 `□` 替换为勾选框 `☑`。
            *   绝对不允许删除、替换或修改模板中原有的其他文字。
        *   **勾选框处理**: 遇到选择题（如"是□ 否□"），请将选中的项映射为 `☑` (或其他文档约定符号)，未选中的项**不要**放入映射中（保持原样 `□`）。

    3.  **第三步：执行映射 (Mapping)**
        *   将案件数据准确映射到需要填写的模板字段ID。
        *   **不要**生成任何 `__DELETE__` 指令。
        *   对于不需要填写的字段，直接在 `fillings` 字典中**省略**该 Key。

**输入:**
- 案件数据 (Case Data)
- 模板结构 (Template Structure extracted from JSON)
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
