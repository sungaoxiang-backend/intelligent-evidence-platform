import asyncio
from typing import Optional, List, Dict, Any
from agno.agent import Agent
from agno.media import Image
from pydantic import BaseModel
from app.agentic.llm.base import openai_image_model
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
    results: Optional[List[EvidenceClassifiResult]]


class EvidenceClassifier:
    """基于config_manager和YAML配置的证据分类器V2"""

    def __init__(self) -> None:
        self.agent = Agent(
            name="证据分类专家V2",
            model=openai_image_model,
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
1. **分析图片:** 仔细分析图片中的所有文本、图像、布局和元数据信息。

2. **参考分类指南:** 你将收到一个结构化的证据分类指南，其中详细描述了每种证据类型的特征，包括：
   * `描述 (Description)`: 证据的一般性说明
   * `分类 (Category)`: 证据所属的大类
   * `决定性特征 (Decisive Features)`: 找到即确认分类的关键特征
   * `重要特征 (Important Features)`: 强支持分类的特征
   * `一般特征 (Common Features)`: 辅助判断的特征
   * `排除特征 (Exclusions)`: 避免误判的排除规则

3. **综合判断与匹配:**
   * **决定性特征优先:** 如果找到决定性特征，直接确认分类
   * **重要特征支持:** 重要特征提供强支持，但需要结合其他特征
   * **一般特征辅助:** 一般特征提供辅助信息
   * **严格排除:** 如果出现排除特征，坚决不能分类为该类型
   * **权重计算:** 根据特征匹配情况计算置信度

4. **输出格式:**
   * 你的最终输出必须是一个JSON对象，格式为 `EvidenceClassifiResults`
   * `evidence_type` 字段必须是配置中定义的有效证据类型名称
   * `confidence` 字段表示你的置信度（0.0到1.0之间）
   * `reasoning` 字段需要详细解释你的分类理由

**分类策略:**
- **决定性特征优先:** 如果找到决定性特征，通常能直接确认分类
- **重要特征支持:** 重要特征提供强支持，需要结合其他特征判断
- **一般特征辅助:** 一般特征提供辅助信息
- **严格排除:** 如果出现排除特征，坚决不能分类为该类型

**注意事项:**
* **拒绝模糊分类:** 如果图片信息不足或质量太差，无法明确分类，请选择置信度为0.0，并说明原因
* **单一最佳匹配:** 即使图片中包含多种信息，你也必须选择一个最核心、最主要的证据类型
* **不要猜测:** 你的所有判断都必须基于图片中可见的、明确的证据
* **中文友好:** 请使用中文输出你的`reasoning`

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