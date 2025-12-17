from typing import Optional, List, Dict, Any
import json
from sqlalchemy.ext.asyncio import AsyncSession
from agno.agent import Agent
from pydantic import BaseModel, Field
from app.agentic.tools.smart_doc_gen_toolkit import SmartDocGenToolkit
from app.agentic.llm.base import qwen_muti_model, qwen_chat_model


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

from app.agentic.knowledge.smart_doc_gen_kb import smart_doc_gen_kb

class SmartDocGenAgent:
    def __init__(self):
        self.toolkit = SmartDocGenToolkit()
        self.agent = Agent(
            name="Smart Document Generation Specialist",
            role="Legal Document Generator",
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
        *   **绝不修改原内容 (Immutable Template)**: 你只能在空白处填入内容，或将空方框 `□` 替换为勾选框 `☑`。绝对不允许删除、替换或修改模板中原有的任何文字（如"法定代表人："、"住所地："等标签必须保留）。
        *   **只填有效项 (Fill Only Valid)**: 
            *   如果是**自然人**，且模板中有"法定代表人"字段，请**直接忽略/省略**该字段 (Omit from mappings)，不要填写任何内容，也不要试图删除它。
            *   如果是**公司**，则正常填写"法定代表人"等字段。
        *   **勾选框处理**: 遇到选择题（如"是□ 否□"），请将选中的项映射为 `☑` (或其他文档约定符号)，未选中的项**不要**放入映射中（保持原样 `□`）。

3.  **第三步：执行映射 (Mapping)**
    *   将案件数据准确映射到需要填写的模板字段ID。
    *   **不要**生成任何 `__DELETE__` 指令。
    *   对于不需要填写的字段，直接在 `fillings` 字典中**省略**该 Key。

**Few-Shot Examples (学习示例):**

**场景 A：原告是自然人 (张三)，被告是公司 (李四有限公司)**
*   **Case Data**: Plaintiff=Person(Name=张三), Defendant=Company(Name=李四公司, LegalRep=王五)
*   **Template**: 
    *   t_0_r1_c2: "原告/法定代表人"
    *   t_0_r5_c2: "被告/法定代表人"
*   **Result**:
    *   `analysis`: { "plaintiff_role_type": "person", "defendant_role_type": "company" }
    *   `fillings`: { "t_0_r5_c2": "王五" } 
    *   *(解释: 原告是自然人，忽略 t_0_r1_c2；被告是公司，填写 t_0_r5_c2)*

**场景 B：原告是公司 (甲公司)，被告是自然人 (乙某些)**
*   **Case Data**: Plaintiff=Company(Name=甲公司, LegalRep=赵六), Defendant=Person(Name=乙某)
*   **Template**:
    *   p_10: "原告法定代表人：____"
    *   p_20: "被告法定代表人：____"
    *   p_30: "是否起诉：是□ 否□"
*   **Result**:
    *   `analysis`: { "plaintiff_role_type": "company", "defendant_role_type": "person" }
    *   `fillings`: { "p_10": "赵六", "p_30": "是否起诉：是☑ 否□" }
    *   *(解释: 原告是公司，填写 p_10；被告是自然人，忽略 p_20；p_30 勾选"是"，利用 Smart Append 或文本完整替换(Agent应给出完整替换文本如果需要))*
    *   *注意：对于 p_30 这种既有文字又有框的段落，通常通过"完整替换"来实现勾选，即输出 "是否起诉：是☑ 否□"。*

**输入:**
- 案件数据 (Case Data)
- 模板分析结果与结构 (Template Structure)

**输出:**
请严格按照 `DocumentFillingMapping` 格式输出 JSON。
            """,
            show_tool_calls=True,
            debug_mode=True,
        )


    async def run(self, case_context: str, template_path: str, output_path: str) -> str:
        """
        Run the agent to generate a document.
        
        1. Use toolkit to extract template structure
        2. Let agent generate the mapping
        3. Use toolkit to fill the template
        """
        # Step 1: Analyze and extract template structure
        analysis_result = self.toolkit.analyze_template(template_path)
        structure_result = self.toolkit.extract_structure(template_path)
        
        # Step 2: Build prompt for the agent
        message = f"""
请根据以下案件数据和模板结构，生成填充映射。

[模板分析结果]
{analysis_result}

[模板结构]
{structure_result}

[案件数据]
{case_context}

请输出一个完整的填充映射。
        """
        
        # Step 3: Get mapping from agent
        response = await self.agent.arun(message)
        mapping_result: DocumentFillingMapping = response.content
        
        # Step 4: Fill template using toolkit
        fillings_json = json.dumps(mapping_result.fillings, ensure_ascii=False)
        fill_result = self.toolkit.fill_template(template_path, output_path, fillings_json)
        
        # Step 5: Return result
        return f"文档生成完成。\n推理过程: {mapping_result.reasoning}\n填充结果: {fill_result}"

# Singleton or factory if needed
smart_doc_gen_agent = SmartDocGenAgent()

async def generate_document_for_case(
    db: AsyncSession, 
    case_id: int, 
    template_path: str, 
    output_path: str
) -> str:
    """
    Orchestrator function to fetch case data and invoke the agent.
    
    Args:
        db: Database session.
        case_id: ID of the case to process.
        template_path: Path to the template file.
        output_path: Path to save the generated document.
    """
    from app.cases.services import get_by_id as get_case_by_id
    from app.evidences.services import list_evidences_by_case_id

    # 1. Fetch Case Data
    case = await get_case_by_id(db, case_id)
    if not case:
        raise ValueError(f"Case with ID {case_id} not found.")

    # 2. Fetch Evidence Data
    evidences, _ = await list_evidences_by_case_id(db, case_id, limit=100)
    
    # 3. Serialize Data
    case_dict = {
        "id": case.id,
        "loan_amount": case.loan_amount,
        "case_type": case.case_type.value if case.case_type else None,
        "case_status": case.case_status.value if case.case_status else None,
        "loan_date": case.loan_date.isoformat() if case.loan_date else None,
        "court_name": case.court_name,
        "description": case.description,
        "parties": [
            {
                "party_name": p.party_name,
                "party_role": p.party_role,
                "party_type": p.party_type,
                "name": p.name,
                "phone": p.phone,
                "address": p.address,
                "id_card": p.id_card,
                "company_name": p.company_name,
                "company_address": p.company_address,
                "company_code": p.company_code
            } for p in case.case_parties
        ]
    }
    
    evidence_list = [
        {
            "id": e.id,
            "file_name": e.file_name,
            "classification_category": e.classification_category,
            "evidence_status": e.evidence_status
        } for e in evidences
    ]
    
    context_data = {
        "case": case_dict,
        "evidence": evidence_list
    }
    
    case_context = json.dumps(context_data, ensure_ascii=False, indent=2)
    
    # 4. Invoke Agent
    result = await smart_doc_gen_agent.run(case_context, template_path, output_path)
    return result
