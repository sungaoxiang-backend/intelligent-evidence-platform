from typing import Dict, Any, Optional
import json
from pydantic import BaseModel, Field
from agno.agent import Agent
from app.agentic.llm.base import qwen_chat_model
from app.agentic.tools.smart_json_doc_gen_toolkit import SmartJsonDocGenToolkit
from app.agentic.knowledge.smart_doc_gen_kb import smart_doc_gen_kb

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

class SmartJsonDocGenAgent:
    def __init__(self):
        self.toolkit = SmartJsonDocGenToolkit()
        self.agent = Agent(
            name="Smart JSON Document Generation Specialist",
            role="Legal Document Generator for Web Editor",
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
        
        # Step 3: Get mapping from agent (Text Response)
        response = await self.agent.arun(input=message)
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
            # Fallback to empty mappings
            mapping_result = DocumentFillingMapping(reasoning="Failed to parse JSON", fillings={})

        
        # Step 5: Fill JSON using toolkit
        fillings_json = json.dumps(mapping_result.fillings, ensure_ascii=False)
        fill_result = self.toolkit.fill_json_template(content_json, fillings_json)
        
        return fill_result
