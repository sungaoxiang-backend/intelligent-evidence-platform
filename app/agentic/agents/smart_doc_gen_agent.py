from typing import Optional, List, Dict, Any
import json
from sqlalchemy.ext.asyncio import AsyncSession
from agno.agent import Agent
from pydantic import BaseModel, Field
from app.agentic.tools.smart_doc_gen_toolkit import SmartDocGenToolkit
from app.agentic.llm.base import qwen_muti_model, qwen_chat_model


class DocumentFillingMapping(BaseModel):
    """文档填充映射结果"""
    # analysis field removed explicitly
    fillings: Dict[str, str] = Field(
        default_factory=dict,
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
            # response_model=DocumentFillingMapping, # Removed to allow tool usage first
            instructions="""
你是法律文书填写专家。你的核心任务是利用知识库中的规则，将案件信息准确地映射到文书模板中。

**核心能力 (Core Capabilities):**
1.  **主动研究**: 你不会凭空猜测。遇到不确定的业务规则（如“个体工商户如何显示”），你会主动调用 `search_knowledge_base`。
2.  **严格遵循 SOP**: 你严格按照既定的 4 步流程进行思考和操作。

**核心工作流程 (SOP):**

    **第一步：案件信息全貌理解 (Step 1: Understand Case)**
    *   **分析案由与金额**: 确定案件的核心争议点基本事实。
    *   **分析当事人 (重要)**: 识别每一方当事人的【主体类型】（自然人 vs 法人/非法人组织）。
    *   **证据关联**: 扫描【证据卡片】，识别哪些证据属于哪个当事人。

    **第二步：文书模板结构理解 (Step 2: Understand Template)**
    *   **分析类型**: 判断模板是 "要素式" (Table) 还是 "陈述式" (Narrative)。
    *   **识别意图**: 理解每个填充块 (`id`) 想要获取什么信息。

    **第三步：制定映射与填充策略 (Step 3: Mapping Strategy)**
    *   **查阅规则 (CRITICAL)**: 调用 `search_knowledge_base`，查找 `rules.md` 中的业务逻辑。
        *   **排他性原则**: 确认如何处理多重身份（如“原告自然人”与“原告法人”共存时）。
        *   **信源优先级**: 确认 OCR 证据与用户录入数据的采用优先序。
    *   **综合推断**: 结合案件信息和证据特征，确定最终要填入的值。

    **第四步：执行生成 (Step 4: Generation)**
    *   **生成最终映射**: 将所有决策转化为最终结果。

**Final Output Format**:
At the very end, you MUST output a VALID JSON block inside markdown code fences, like this:
```json
{
  "reasoning": "Your detailed step-by-step reasoning process...",
  "fillings": {
    "t_0_r1_c1": "Value1",
    "p_0": "Value2"
  }
}
```
**Constraints**:
- `fillings` map keys are Template IDs.
- `reasoning` is a string explaining your logic.
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
        
        # Step 3: Get mapping from agent (Text Response)
        response = await self.agent.arun(message)
        # Handle potential string or RunResponse output
        response_text = response.content if hasattr(response, 'content') else str(response)

        # Step 4: Parse JSON manually
        try:
            # Extract JSON block
            if "```json" in response_text:
                json_str = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                 json_str = response_text.split("```")[1].split("```")[0].strip()
            else:
                # Try finding the first { and last }
                start_idx = response_text.find("{")
                end_idx = response_text.rfind("}")
                if start_idx != -1 and end_idx != -1:
                    json_str = response_text[start_idx:end_idx+1]
                else:
                    json_str = response_text

            parsed_data = json.loads(json_str)
            mapping_result = DocumentFillingMapping(**parsed_data)
        
        except Exception as e:
            print(f"Error parsing Agent response: {e}")
            print(f"Raw response: {response_text}")
            mapping_result = DocumentFillingMapping(reasoning="Failed to parse JSON", fillings={})

        
        # Step 5: Fill template using toolkit
        fillings_json = json.dumps(mapping_result.fillings, ensure_ascii=False)
        fill_result = self.toolkit.fill_template(template_path, output_path, fillings_json)
        
        # Step 6: Return result
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
