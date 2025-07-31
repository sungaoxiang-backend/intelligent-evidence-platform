from typing import Optional, List, Dict, Any
from agno.agent import Agent
from agno.media import Image
from pydantic import BaseModel
from enum import Enum
from app.agentic.llm.base import openai_image_model
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
    slot_required: bool
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
            model=openai_image_model,
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
        
        <Enhanced Sorting Guide>
        排序必须严格遵循以下优先级：
        1. 时间戳优先：提取图片中的日期
        2. 对话连续性：通过以下特征判断连续性：
        - 最后一条消息的发送者与下张图片第一条消息接收者相同
        - 相同用户连续发送的消息
        - 转账记录与确认消息的先后关系
        3. 视觉连续性：
        - 顶部备注名相同的图片组
        - 相似聊天背景的图片组
        - 消息气泡切割位置衔接
        </Enhanced Sorting Guide>
    
        <Target Slots Extraction Guide>
        构建结构化的过程本质就是对{target_slots_to_extract}的标注补充。
        `target_slots_to_extract`中每个item的说明:
        1. `slot_name`: 目标词槽的名称
        2. `slot_desc`: 目标词槽的描述，也是你提取词槽的依据和指南
        3. `slot_value_type`: 目标词槽的值的标准JSON类型
        4. `slot_required`: 原样输出，不要修改
        
        标注结果说明:
        1. `slot_group_name`: 根据某个`微信备注名`分组的名称。
        2. `image_sequence_info`: 某个分组的图片序列信息，每个item包含`url`和`sequence_number`,其中`sequence_number`表示图片在上下文中的顺序，从1开始, 作用域是某个具体分组内而非当前处理的整个图片批次。
        3. `slot_value`: 提取到的具体的目标词槽的对应的词槽值。
        4. `slot_value_from_url`: 提取到的词槽值的来源图片URL列表。
        5. `confidence`: 提取到的具体的目标词槽的对应的词槽值的置信度。
        6. `reasoning`: 提取到的具体的目标词槽的对应的词槽值的提取理由。
        
        特殊说明:
        1. 债权人和债务人：`债务人`和`债权人`的区分，通常是左侧为`债务人`，右侧为`债权人`。
        2. 欠款合意：为真的情况是：债务人主动承认向债权人欠款，或者债权人主动向债务人索要欠款且债务人同意的合意。其余情况为假。
        3. 欠款的金额：通常是数字，表示欠款或还款的金额。有时候你需要关注其中是否存在一定的需要计算的逻辑。
        4. 约定还款日期：通常是文字描述，表示欠款或还款的日期。
        5. 约定还款利息：通常是数字，表示欠款或还款的利息。
        </Target Slots Extraction Guide>
        
        <Task Planner>
        1. 分组：精准识别图片顶部的`微信备注名`（手机端），也可能来自左上角（pc端），并根据`微信备注名`信息将图片进行分组。
        2. 排序: 使用<Enhanced Sorting Guide>规则，为每组生成从1开始的连续序号（url和sequence_number）。
        4. 提取信息: 根据排序后的图片，以及<Target Slots Extraction Guide>提取指南，充分分析上图片内容、下文和关联关系，提取出目标词槽信息。
        5. 输出: 构建结构化数据并返回输出。
        </Task Planner>
        
        <Notes>
        1. 注意永远不要提取和输出`target_slots_to_extract`中没有标注的词槽信息。
        2. 注意即便是没有提取到目标词槽信息，也要将该词槽对应的`slot_value`值设置为`未知`，并说明原因。
        3. 注意输出的`slot_value`中永远不要有任何不应该存在于其中的内容，比如`reasoning`,`slot_name`,`confidence`等。
        4. 注意始终确保使用中文输出`reasoning`。
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
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/5c63b6920d974e119bc4469b2ec5f557_w1.png",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/b6b48d8837fe49d9a9328cd23543939f_w2.png",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/307e86fca5ae4ccc84fa7a64f697ce16_w3.png",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/346e98c58ca5480eaf6dedafcc9fd926_w4.png",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250728170044_90bbd8dd-1953-426f-abd5-deddf85e8c12.jpg",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250728170044_1498f3a5-473d-455f-a0da-43d9b53bdc73.jpg",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250728170044_d140de47-5d72-4f63-9f1f-5a32639cc859.jpg"
    ]
    
    extractor = AssociationFeaturesExtractor()
    message_parts = ["请从以下证据图片中提取关键信息:"]
    for i, image_url in enumerate(test_images):
        message_parts.append(f"\n{i+1}. 图片: {image_url}")
    message = "\n".join(message_parts)
    # extractor.agent.print_response(message=message, images=[Image(url=image_url) for image_url in test_images])
    print(extractor.agent.run(message=message, images=[Image(url=image_url) for image_url in test_images]).content.model_dump())
