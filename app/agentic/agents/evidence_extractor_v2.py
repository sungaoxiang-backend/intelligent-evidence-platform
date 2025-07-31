from typing import Optional, List, Dict, Any
from agno.agent import Agent
from agno.media import Image
from pydantic import BaseModel
from app.agentic.llm.base import openai_image_model
from app.core.config_manager import config_manager


class EvidenceImage(BaseModel):
    url: str
    evidence_type: str


def get_evidence_types_from_config() -> Dict[str, Dict[str, Any]]:
    """从config_manager获取证据类型配置"""
    try:
        evidence_types = config_manager.get_all_evidence_types()
        return evidence_types
    except Exception as e:
        print(f"从config_manager获取证据类型失败: {e}")
        return {}

class SlotExtraction(BaseModel):
    """单个词槽提取结果"""
    slot_name: str  # 必须是extraction_slots中的slot_name
    slot_desc: str
    slot_value_type: str
    slot_required: bool
    slot_value: str
    confidence: float
    reasoning: str  # 提取理由，特别说明来自哪些图片
    

class ResultItem(BaseModel):
    """单个词槽提取结果"""
    image_url: str
    classification_category: str
    slot_extraction: List[SlotExtraction]
   

class EvidenceExtractionResults(BaseModel):
    """特征提取结果"""
    results: List[ResultItem]  # 所有提取的词槽结果


class EvidenceFeaturesExtractor:
    """基于YAML配置的证据特征提取器V2"""
    
    def __init__(self) -> None:
        self.agent = Agent(
            name="证据特征提取专家V2",
            model=openai_image_model,
            session_state={
                "extraction_guide": {}  # 初始为空，运行时动态加载
            },
            add_state_in_messages=True,
            instructions=self.build_instructions(),
            response_model=EvidenceExtractionResults,
            show_tool_calls=True,
            debug_mode=True
        )
    
    def build_instructions(self):
        return """
        <Back Story>
        你是一个专业的证据图片特征提取专家，擅长从特定类型的证据图片中提取目标关键信息。
        </Back Story>
        <Task Planner>
        1. 根据用户消息中给定的图片和图片分类，提取目标关键信息。
        2. 使用{extraction_guide}中的配置进行精确提取。
        </Task Planner>
        <Extraction Process>
        1. 根据图片的evidence_type找到对应的提取配置
        2. 按照配置中的extraction_slots进行精确提取
        3. 确保返回的数据类型与slot_value_type一致
        4. 如果某个词槽在图片中无法识别，设置为"未知"并说明原因
        </Extraction Process>
        <Output Format>
        1. 严格按照配置中指定证据类型的词槽进行提取
        2. 每个词槽都要包含：slot_name, slot_value, confidence, reasoning, slot_desc, slot_value_type, slot_required
        3. slot_value必须符合指定的数据类型
        4. reasoning要说明提取的依据和来源
        5. 永远不要出现extraction_slots之外的词槽
        </Output Format>
        """
    
    async def arun(self, evidence_images: List[EvidenceImage]):
        # 获取实际需要的证据类型
        chinese_types = [image.evidence_type for image in evidence_images]
        
        # 只加载需要的证据类型配置
        extraction_guide = config_manager.get_extraction_slots_by_chinese_types(chinese_types)
        
        # 更新session_state中的extraction_guide
        self.agent.session_state["extraction_guide"] = extraction_guide
        
        # 构建消息
        message_parts = ["请从以下证据图片中提取关键信息:"]
        for i, image in enumerate(evidence_images):
            message_parts.append(f"\n{i+1}. 证据类型: {image.evidence_type}")
            message_parts.append(f"   图片url: {image.url}")
        
        message = "\n".join(message_parts)
        
        # 创建图片对象
        images = [Image(url=image.url) for image in evidence_images]
        return await self.agent.arun(message=message, images=images)

    def reload_config(self):
        """重新加载配置"""
        config_manager.reload_config()
        # 清空session_state中的extraction_guide，让下次运行时重新加载
        self.agent.session_state["extraction_guide"] = {}


if __name__ == '__main__':
    # 测试用例
    import asyncio
    test_images = [
        {
            "url": "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070805_发票.png",
            "evidence_type": "增值税发票"
        },
        {
            "url": "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070808_银行卡.jpg",
            "evidence_type": "收款银行账户截图"
        }
    ]
    extractor = EvidenceFeaturesExtractor()

    run_response = asyncio.run(extractor.arun(
        evidence_images=[EvidenceImage(**image) for image in test_images]
    ))
    print(run_response)