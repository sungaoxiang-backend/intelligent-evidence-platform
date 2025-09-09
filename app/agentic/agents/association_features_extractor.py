from typing import Optional, List, Dict, Any
from agno.agent import Agent
from agno.media import Image
from pydantic import BaseModel
from enum import Enum
from app.agentic.llm.base import openai_image_model
from app.agentic.llm.base import qwen_muti_model
from app.core.config_manager import config_manager


class ImageSequenceInfo(BaseModel):
    """上下文图片URL"""
    url: str
    sequence_number: int

    
class SlotExtraction(BaseModel):
    """单个词槽提取结果"""
    slot_name: str
    slot_desc: str
    slot_value_type: str
    slot_required: Any
    slot_value: str
    slot_value_from_url: List[str]
    confidence: float
    reasoning: str
    

class ResultItem(BaseModel):
    """单个词槽提取结果"""
    slot_group_name: str
    image_sequence_info: List[ImageSequenceInfo]
    slot_extraction: List[SlotExtraction]
   

class AssociationFeaturesExtractionResults(BaseModel):
    """特征提取结果"""
    results: List[ResultItem]  # 所有提取的词槽结果


class AssociationFeaturesExtractor:
    """证据特征提取器 - 专注于从已分类的证据图片中提取关键信息"""
    
    def __init__(self) -> None:
        # 从config_manager加载微信聊天记录的提取配置
        wechat_chat_config = config_manager.get_evidence_type_by_type_name("微信聊天记录")
        target_slots_to_extract = []
        
        if wechat_chat_config:
            extraction_slots = wechat_chat_config.get("extraction_slots", [])
            for slot in extraction_slots:
                target_slots_to_extract.append({
                    "slot_name": slot.get("slot_name"),
                    "slot_desc": slot.get("slot_desc"),
                    "slot_value_type": slot.get("slot_value_type"),
                    "slot_required": slot.get("slot_required")
                })
        
        self.agent = Agent(
            name="关联特征提取专家",
            model=qwen_muti_model,
            session_state={
                "target_slots_to_extract": target_slots_to_extract
            },
            add_state_in_messages=True,
            instructions=self.build_instructions(),
            response_model=AssociationFeaturesExtractionResults,
            show_tool_calls=True,
            debug_mode=True
        )
    
    def build_instructions(self):
        return """
        <Back Story>
        你是一名专业的证据处理专家，你非常熟悉且擅长处理债务纠纷中的证据，尤其是微信(WeChat)聊天记录类型的证据。你能很精准的将批量的聊天记录进行分组、排序、分析上下文和关联关系，进而提取出关键的信息。
        </Back Story>
        
        <Configuration Understanding>
        你的session_state中包含target_slots_to_extract配置{target_slots_to_extract}，这是你进行信息提取的核心指导。
        
        每个证据类型的配置包含extraction_slots数组，每个slot定义了：
        - slot_name: 需要提取的字段名
        - slot_desc: 字段的详细描述，告诉你具体要提取什么内容
        - slot_value_type: 期望的数据类型（string/number/boolean/date）
        - slot_required: 是否为必需字段
        
        例如，对于微信聊天记录类型：
        - slot_name: "债务人微信备注名" + slot_desc: "微信聊天中截图中，位于顶部显示的备注名称或昵称" = 提取微信聊天中截图中，位于顶部显示的备注名称或昵称
        - slot_name: "欠款合意" + slot_desc: "聊天中关于欠款、借款的合意内容" = 提取聊天中关于欠款、借款的合意内容
        - slot_name: "欠款金额" + slot_desc: "欠款或借款的具体金额数值" = 提取欠款或借款的具体金额数值
        - slot_name: "约定还款日期" + slot_desc: "欠款或还款的日期" = 提取欠款或还款的日期
        - slot_name: "约定还款利息" + slot_desc: "欠款或还款的利息" = 提取欠款或还款的利息
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
        </Quality Guidelines>
        
        </Configuration Understanding>
        
        <Enhanced Sorting Guide>
        排序必须严格遵循以下优先级：
        1. 时间戳优先：提取图片中的日期
        2. 对话连续性：通过以下特征判断连续性：
        - 相同用户连续发送的消息
        - 转账记录与确认消息的先后关系
        3. 视觉连续性：
        - 顶部备注名相同的图片组
        - 相似聊天背景的图片组
        - 消息气泡切割位置衔接
        </Enhanced Sorting Guide>
    
        
        <Business Guide>
        1. 债权人和债务人：`债务人`和`债权人`的区分，在微信聊天记录中，通常是左侧为`债务人`，右侧为`债权人`。
        2. 欠款合意：为真的情况是：债务人主动承认向债权人欠款，或者债权人主动向债务人索要欠款且债务人同意的合意。其余情况为假。
        3. 欠款的金额：通常是数字，表示欠款或还款的金额。有时候你需要关注其中是否存在一定的需要计算的逻辑。
        4. 约定还款日期：通常是文字描述，表示欠款或还款的日期，可能不存在。
        5. 约定还款利息：通常是数字，表示欠款或还款的利息，可能不存在。
        </Business Guide>
        
        <Task Planner>
        1. 分组：精准识别图片顶部的`微信备注名`（手机端），也可能来自左上角（pc端），并根据`微信备注名`信息将图片进行分组。
        2. 排序: 使用<Enhanced Sorting Guide>规则，为每组生成从1开始的连续序号（url和sequence_number）。
        4. 提取信息: 根据排序后的图片，以及<Target Slots Extraction Guide>提取指南，充分分析上图片内容、下文和关联关系，提取出目标词槽信息。
        5. 输出: 构建结构化数据并返回输出。
        </Task Planner>
        
        <Notes>
        1. 注意给你提供的图片可能来自手机端、pc端，也可能因为系统的不同，导致不同的通用背景色，比如系统的明暗模式。
        2. 注意你给的图片都是微信聊天记录截图，且几乎都和债务纠纷场景有关，所以你提取的词槽信息，几乎都是和债务纠纷相关的。
        3. 注意分组的依据是`微信备注名`，一定要精准的确认`微信备注名`，绝对不要假设和自行制造分组，比如分组1，分组2，分组3等。
        4. `微信备注名`作为分组的条件，优先级非常高，永远不要错误的把不是同一`微信备注名`的图片分到一组。
        5. 注意永远不要提取和输出`target_slots_to_extract`中的items没有包含的词槽信息。
        6. 注意即便是没有提取到目标词槽信息，也要将该词槽对应的`slot_value`值设置为`未知`，并说明原因。
        7. 注意输出的`slot_value`中永远不要有任何不应该存在于其中的内容，比如`reasoning`,`slot_name`,`confidence`等。
        8. 注意始终确保使用中文输出`reasoning`。
        </Notes>
        """
    async def arun(self, image_urls: List[str]) -> AssociationFeaturesExtractionResults:
        message_parts = ["请从以下证据图片中提取关键信息:"]
        for i, image_url in enumerate(image_urls):
            message_parts.append(f"\n{i+1}. 图片: {image_url}")
        message = "\n".join(message_parts)
        images = [Image(url=url) for url in image_urls]
        return await self.agent.arun(message=message, images=images)
    
    def reload_config(self):
        """重新加载配置"""
        config_manager.reload_config()
        # 重新加载微信聊天记录的提取配置
        wechat_chat_config = config_manager.get_evidence_type_by_type_name("微信聊天记录")
        target_slots_to_extract = []
        
        if wechat_chat_config:
            extraction_slots = wechat_chat_config.get("extraction_slots", [])
            for slot in extraction_slots:
                target_slots_to_extract.append({
                    "slot_name": slot.get("slot_name"),
                    "slot_desc": slot.get("slot_desc"),
                    "slot_value_type": slot.get("slot_value_type"),
                    "slot_required": slot.get("required", False)
                })
        
        # 更新session_state
        self.agent.session_state["target_slots_to_extract"] = target_slots_to_extract

if __name__ == '__main__':
    # 测试用例

    test_images = [
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/3a03551c39b648f3ad984c93e712993a_r1.jpg",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/889ee4cbc0cd45bbb0237277e9bd17de_r2.jpg",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/f64ceb1a3ca94cfc92655999efa2b568_r3.jpg",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/5c63b6920d974e119bc4469b2ec5f557_w1.png",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/b6b48d8837fe49d9a9328cd23543939f_w2.png",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/307e86fca5ae4ccc84fa7a64f697ce16_w3.png",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/346e98c58ca5480eaf6dedafcc9fd926_w4.png",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250728170044_90bbd8dd-1953-426f-abd5-deddf85e8c12.jpg",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250728170044_1498f3a5-473d-455f-a0da-43d9b53bdc73.jpg",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250728170044_d140de47-5d72-4f63-9f1f-5a32639cc859.jpg"
    ]
    
    extractor = AssociationFeaturesExtractor()
    message_parts = ["请从以下证据图片中提取关键信息:"]
    for i, image_url in enumerate(test_images):
        message_parts.append(f"\n{i+1}. 图片: {image_url}")
    message = "\n".join(message_parts)
    extractor.agent.print_response(message=message, images=[Image(url=image_url) for image_url in test_images])
    # print(extractor.agent.run(message=message, images=[Image(url=image_url) for image_url in test_images]).content.model_dump())
