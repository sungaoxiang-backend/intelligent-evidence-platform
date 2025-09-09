from typing import Optional, List, Dict, Any, Union
from agno.agent import Agent
from agno.media import Image
from pydantic import BaseModel
from app.agentic.llm.base import openai_image_model, qwen_muti_model
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
    slot_required: Any
    slot_value: Any
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
            model=qwen_muti_model,
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
        
        <Configuration Understanding>
        你的session_state中包含extraction_guide配置{extraction_guide}，这是你进行信息提取的核心指导。
        
        每个证据类型的配置包含extraction_slots数组，每个slot定义了：
        - slot_name: 需要提取的字段名
        - slot_desc: 字段的详细描述，告诉你具体要提取什么内容
        - slot_value_type: 期望的数据类型（string/number/boolean/date）
        - slot_required: 是否为必需字段
        
        例如，对于身份证类型：
        - slot_name: "姓名" + slot_desc: "身份证上的姓名" = 提取身份证上显示的姓名
        - slot_name: "公民身份号码" + slot_desc: "身份证号码" = 提取18位身份证号码
        </Configuration Understanding>
        
        <Extraction Strategy>
        1. 仔细阅读每个slot的slot_desc，理解具体要提取的内容
        2. 根据slot_desc中的描述，在图片中定位对应的信息区域
        3. 确保提取的内容符合slot_desc的要求
        4. slot_required原样输出即可，不需要处理
        5. 对于无法提取的字段，设置为"未知"并说明原因
        </Extraction Strategy>
        
        <Data Type Compliance>
        根据slot_value_type确保输出格式正确：
        - string: 文本字符串，如姓名、地址等
        - number: 数字，如金额、数量等
        - boolean: 布尔值，如是否确认、是否同意等
        - date: 日期格式，如出生日期、还款日期等，如2024-01-01/2024-01-01 12:00:00/12:00:00
        </Data Type Compliance>
        
        <Quality Guidelines>
        1. 严格按照slot_desc的描述进行提取，不要提取描述之外的内容
        2. 对于复杂字段，仔细分析slot_desc中的具体要求
        3. 如果图片质量不佳，在reasoning中说明对提取的影响
        4. 确保所有提取的信息都基于图片中可见的内容
        5. 确保number类型的值不会有尾随零，如1000.00，则输出1000，而不是1000.00；如1000.50，则输出1000.5，而不是1000.50；如1000.35，则输出1000.35，而不是1000.350
        </Quality Guidelines>
        
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
        6. 在提取到number值时，确保不要出现尾随零问题。如1000.00，则输出时需要是1000，而不是1000.00；如1000.50，则输出时需要是1000.5，而不是1000.50；如1000.35，则输出时需要是1000.35，而不是1000.350
        </Output Format>
        """
    
    async def arun(self, evidence_images: List[EvidenceImage]):
        # 获取实际需要的证据类型
        chinese_types = [image.evidence_type for image in evidence_images]
        
        # 只加载需要的证据类型配置
        extraction_guide = config_manager.get_extraction_slots_by_chinese_types(chinese_types)
        
        # 确保session_state存在并更新extraction_guide
        if self.agent.session_state is None:
            self.agent.session_state = {}
        self.agent.session_state["extraction_guide"] = extraction_guide
        
        # 构建消息
        message_parts = ["请从以下证据图片中提取关键信息:"]
        for i, image in enumerate(evidence_images):
            message_parts.append(f"\n{i+1}. 证据类型: {image.evidence_type}")
            message_parts.append(f"   图片url: {image.url}")
        
        message = "\n".join(message_parts)
        
        # 创建图片对象，直接使用URL（文件名已在上传时清理）
        images = [Image(url=image.url) for image in evidence_images]
        return await self.agent.arun(message=message, images=images)

    def reload_config(self):
        """重新加载配置"""
        config_manager.reload_config()
        # 确保session_state存在并清空extraction_guide
        if self.agent.session_state is None:
            self.agent.session_state = {}
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