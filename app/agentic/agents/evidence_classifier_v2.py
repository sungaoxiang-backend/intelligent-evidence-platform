import asyncio
from typing import Optional, List, Dict, Any
from agno.agent import Agent
from agno.media import Image
from pydantic import BaseModel
from app.agentic.llm.base import openai_image_model, qwen_muti_model
from app.core.config_manager import config_manager


def get_evidence_types_from_config() -> Dict[str, str]:
    """从config_manager获取证据类型映射"""
    try:
        evidence_types = config_manager.get_all_evidence_types()
        # 创建类型映射 {evidence_key: type_name}
        type_mapping = {}
        for key, config in evidence_types.items():
            type_name = config.get("type", key)
            type_mapping[key] = type_name
        return type_mapping
    except Exception as e:
        print(f"从config_manager获取证据类型失败: {e}")
        return {}


def get_evidence_type_features_guide_v2():
    """基于config_manager的YAML配置生成证据类型分类指南"""
    try:
        evidence_types = config_manager.get_all_evidence_types()
        
        guide_parts = []
        for evidence_key, config in evidence_types.items():
            type_name = config.get("type", evidence_key)
            description = config.get("description", "")
            category = config.get("category", "")
            features = config.get("features", {})
            exclusions = config.get("exclusions", [])
            
            feature_lines = [
                f"- **证据类型 (EvidenceType):** {type_name}",
                f"  - **描述 (Description):** {description}",
                f"  - **分类 (Category):** {category}",
                f"  - **决定性特征 (Decisive Features):** {features.get('decisive', [])}",
                f"  - **重要特征 (Important Features):** {features.get('important', [])}",
                f"  - **一般特征 (Common Features):** {features.get('common', [])}",
                f"  - **排除特征 (Exclusions):** {exclusions}"
            ]
            guide_parts.append("\n".join(feature_lines))
        
        return "\n\n".join(guide_parts)
    except Exception as e:
        print(f"生成证据类型指南失败: {e}")
        return ""


class EvidenceClassifiResult(BaseModel):
    image_url: str
    evidence_type: str  # 改为字符串，不再使用枚举
    confidence: float
    reasoning: str
    

class EvidenceClassifiResults(BaseModel):
    results: List[EvidenceClassifiResult]


class EvidenceClassifier:
    """基于config_manager和YAML配置的证据分类器V2"""

    def __init__(self) -> None:
        self.agent = Agent(
            name="证据分类专家V2",
            model=qwen_muti_model,
            session_state={
                "evidence_type_descriptions": get_evidence_type_features_guide_v2(),
            },
            add_state_in_messages=True,
            instructions=self.build_instructions(),
            response_model=EvidenceClassifiResults,
            show_tool_calls=True,
            debug_mode=True
        )
    
    def build_instructions(self):
         return """
你是一个专业的法律证据分类AI助手。你的任务是根据用户上传的图片，准确地判断其属于哪一种证据类型。

**工作流程:**
1. **系统化分析:** 对每张图片进行系统化、结构化的分析，确保分析的一致性和准确性。

2. **参考分类指南:** 你将收到一个结构化的证据分类指南，其中详细描述了每种证据类型的特征，包括：
   * `描述 (Description)`: 证据的一般性说明
   * `分类 (Category)`: 证据所属的大类
   * `决定性特征 (Decisive Features)`: 找到即确认分类的关键特征
   * `重要特征 (Important Features)`: 强支持分类的特征
   * `一般特征 (Common Features)`: 辅助判断的特征
   * `排除特征 (Exclusions)`: 避免误判的排除规则

3. **结构化判断流程:**
   * **第一步 - 特征识别:** 识别图片中的所有可见特征
   * **第二步 - 决定性特征检查:** 优先检查决定性特征
   * **第三步 - 重要特征评估:** 评估重要特征的支持程度
   * **第四步 - 排除规则验证:** 严格检查排除特征
   * **第五步 - 综合判断:** 基于所有信息做出最终判断

4. **输出格式:**
   * 你的最终输出必须是一个JSON对象，格式为 `EvidenceClassifiResults`
   * `evidence_type` 字段必须是配置中定义的有效证据类型名称
   * `confidence` 字段表示你的置信度（0.0到1.0之间）
   * `reasoning` 字段需要详细解释你的分类理由

**多图片处理优化策略:**
- **结构化分析:** 对每张图片使用相同的分析框架和步骤
- **特征优先级:** 严格按照决定性特征 > 重要特征 > 一般特征的顺序分析
- **排除优先:** 一旦发现排除特征，立即排除该分类
- **独立判断:** 每张图片的分析结果不应影响其他图片的判断
- **一致性标准:** 对所有图片使用相同的判断标准和阈值

**质量控制机制:**
- **置信度阈值:** 只有置信度 > 0.3 的分类才被认为是有效的
- **特征匹配度:** 必须至少匹配一个重要特征或决定性特征
- **排除检查:** 严格检查排除特征，一旦发现立即排除
- **质量优先:** 宁可分类为未知，也不要给出低质量的不确定结果

**特别注意事项:**
* **关键词优先:** 对于欠条类证据，必须在命中后再次进行二次的仔细识别关键词，因为他们非常容易混淆：
  - 如果包含"货款"、"货物"、"商品"、"买卖"等词汇，优先考虑"货款欠条"
  - 如果包含"借款"、"借钱"、"借到"、"借出"等词汇，优先考虑"借款借条"
  - 关键词是决定性特征，比"欠条"这个通用词汇更重要
* **拒绝模糊分类:** 如果图片信息不足或质量太差，无法明确分类，请选择输出分类为`未知`，且置信度为0.0，并说明原因
* **单一最佳匹配:** 即使图片中包含多种信息，你也必须选择一个最核心、最主要的证据类型
* **不要猜测:** 你的所有判断都必须基于图片中可见的、明确的证据
* **中文友好:** 请使用中文输出你的`reasoning`
* **质量优先:** 宁可分类为未知，也不要给出不确定的分类结果
* **系统性:** 使用系统化的分析方法，确保每张图片都得到公平、一致的分析

现在，请根据以下证据分类指南，对用户提供的图片进行分类。

**[证据分类指南]**
{evidence_type_descriptions}
"""

    async def arun(self,image_urls: List[str]):
        # 构建 message
        message_parts = ["请分析分类以下证据图片:"]
        for i, url in enumerate(image_urls):
            message_parts.append(f"{i + 1}. {url}")
        message = "\n".join(message_parts)
        images = [Image(url=url) for url in image_urls]
        return await self.agent.arun(message=message, images=images)

    def reload_config(self):
        """重新加载配置"""
        config_manager.reload_config()
        # 更新agent的session_state
        if self.agent.session_state is None:
            self.agent.session_state = {}
        self.agent.session_state.update({
            "evidence_type_descriptions": get_evidence_type_features_guide_v2(),
            "evidence_types": get_evidence_types_from_config(),
        })


if __name__ == '__main__':
    # 模拟外部传入的图片 URL 列表
    image_urls = [
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070805_发票.png",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070808_银行卡.jpg",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711072414_1.jpg",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711072415_2.png",
    #     "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711072415_3.png",
    #     "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711075710_4.jpg",
    #     "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711075710_5.jpg"
    ]

    # 构建 message
    message_parts = ["请分析分类以下证据图片:"]
    for i, url in enumerate(image_urls):
        message_parts.append(f"{i + 1}. {url}")
    message = "\n".join(message_parts)

    # 动态构建 Agno 需要的 Image 对象列表
    # 注意：Agno 的 Image 对象可以接受 URL 或本地路径
    images = [Image(url=url) for url in image_urls]

    # 运行 Team
    evidence_clissifier = EvidenceClassifier()
    # evidence_clissifier.agent.print_response(message=message, images=images)
    run_response = asyncio.run(evidence_clissifier.arun(image_urls))
    result: EvidenceClassifiResults = run_response.content
    print(result.model_dump())