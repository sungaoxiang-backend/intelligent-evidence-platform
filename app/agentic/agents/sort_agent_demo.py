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
            # session_state={
            #     "target_slots_to_extract": target_slots_to_extract
            # },
            # add_state_in_messages=True,
            instructions=self.build_instructions(),
            response_model=AssociationFeaturesExtractionResults,
            show_tool_calls=True,
            debug_mode=True
        )
    
    def build_instructions(self):
        return """
        请你对接收的图片进行关联的分析, 识别`微信备注名`分组并输出其顺序。
        1. `slot_group_name` 是图片的关联分组名称
        2. `image_sequence_info` 是图片的关联分组信息
        3. `image_sequence_info.url` 是图片的URL
        4. `image_sequence_info.sequence_number` 是图片在上下文中的顺序，从1开始
        """
    async def arun(self, image_urls: List[str]) -> AssociationFeaturesExtractionResults:
        message_parts = ["请分析、分组、排序以下图片:"]
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
    message_parts = ["请分析、分组、排序以下图片:"]
    for i, image_url in enumerate(test_images):
        message_parts.append(f"\n{i+1}. 图片: {image_url}")
    message = "\n".join(message_parts)
    extractor.agent.print_response(message=message, images=[Image(url=image_url) for image_url in test_images])
    # print(extractor.agent.run(message=message, images=[Image(url=image_url) for image_url in test_images]).content.model_dump())
