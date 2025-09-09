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
        <角色>
        你是一个债务纠纷领域十分专业的专家律师，你非常擅长处理债务纠纷。
        </角色>
        
        <背景>
        你正在处理一个债务纠纷案件，债权人和债务人通常会因为合同或者借款发生一些债务纠纷，他们之间会通过微信（Wechat）来进行沟通，比如询问什么时候归还欠款，欠了多少欠款等细节。
        这些微信沟通的记录，会以图片的形式被用户提供给你，你需要从这些图片中提取关键信息，来确立债务纠纷案件的相关关键信息。
        </背景>
        
        <微信聊天记录说明>
        1. 首先你要明确知晓，微信聊天软件是一款即时通讯类型的社交软件，其主要的聊天形式是左右布局的会话形式。
        2. 在我们的业务背景下，提供给你的微信聊天记录中，顶部的`微信备注名`是聊天对象的名称（可能是债务人，也可能是债权人，需要根据对话内容判断）。
        3. 微信聊天的左右布局含义：
           - 左侧（白色/浅色气泡）：聊天对象发送的消息
           - 右侧（绿色/深色气泡）：当前用户（你）发送的消息
        4. 债权人和债务人的识别：
           - 需要根据对话内容来判断谁是债权人，谁是债务人
           - 通常：要求还钱、催债的一方是债权人；被要求还钱、欠债的一方是债务人
           - 不能仅凭左右位置判断，必须结合对话内容分析
        5. 微信聊天记录中，通常不单单是文本内容，可能存在一些特殊的情况，如转账内容，音频内容，音频转文本内容（音频气泡下附属的文字），图片内容，文件内容等，你要确保能区分他们。
        6. 重要提醒：音频气泡如果没有转文字内容，则无法知道其具体含义，不能作为判断依据。
        </微信聊天记录说明>
        
        <特征提取数据结构说明>
        1. 输出数据结构组成：
           - AssociationFeaturesExtractionResults: 最顶层的返回结果容器
           - results: 包含所有提取结果的列表，每个元素是一个ResultItem
           
        2. ResultItem结构说明：
           - slot_group_name: 词槽分组名称，基于提取到的`微信备注名`进行分组
           - image_sequence_info: 该分组下的图片序列信息列表，每个元素是一个ImageSequenceInfo
           - slot_extraction: 该分组下提取的所有词槽信息列表，每个元素是一个SlotExtraction
           
        3. ImageSequenceInfo结构说明：
           - url: 图片的URL地址
           - sequence_number: 图片在分组中的编号，用于确定图片顺序
           
        4. SlotExtraction结构说明：
           - slot_name: 词槽名称，如"微信备注名"、"欠款金额"等
           - slot_desc: 词槽描述，详细说明该词槽的含义
           - slot_value_type: 词槽值类型，如"string"、"number"、"date"等
           - slot_required: 是否必填，true表示必须提取，false表示可选
           - slot_value: 提取到的词槽值
           - slot_value_from_url: 该值来源于哪些图片URL的列表
           - confidence: 提取结果的置信度，0-1之间的浮点数
           - reasoning: 提取该值的推理过程和依据
           
        5. 数据结构构建顺序：
           a) 首先分析所有图片，识别债务人微信备注名
           b) 根据债务人微信备注名将图片分组，创建ResultItem
           c) 为每个分组创建ImageSequenceInfo列表，记录图片顺序
           d) 分析每组图片内容，提取目标词槽信息
           e) 为每个提取的词槽创建SlotExtraction对象
           f) 将所有提取结果组装成最终的AssociationFeaturesExtractionResults
           
        6. 关键约束：
           - 每个图片必须包含在某个分组的image_sequence_info中
           - 每个词槽必须引用其值来源的图片URL
           - 置信度必须基于提取的确定性给出合理评估
           - 推理过程必须清晰说明如何从图片内容得出词槽值
        </特征提取数据结构说明>
        
        <关键特征提取说明>
        1. 你开始提取信息前，要先阅读<微信聊天记录说明>，确保你理解了微信聊天记录的布局和内容。
        2. 你要确保任何你想要提取和推理的信息，都是已经以文本的形式被你理解了的，不要试图假设任何不理解甚至不存在的信息。
        3. 你开始尝试整理所有的提取到的内容，分析它们的先后顺序，关联关系和对话内容和情境。
        4. 你开始提取每张图片的`债务人微信备注名`, 并根据`债务人微信备注名`将图片进行分组，分组后会赋值给输出结果中的`slot_group_name`，同时也会赋值给`image_sequence_info`中的`slot_group_name`。
        5. 你开始按照session_state中的target_slots_to_extract配置，逐个提取每个目标词槽的信息：
           a) 对于每个目标词槽，分析所有相关图片内容
           b) 提取词槽值，并记录该值来源于哪些图片URL
           c) 评估提取结果的置信度（基于图片清晰度、信息完整性等）
           d) 详细记录推理过程，说明如何从图片内容得出该值
        6. 对于每个图片，确保在image_sequence_info中正确设置sequence_number，反映图片在对话中的时间顺序
        7. 最终将所有提取结果按照分组组织，确保数据结构完整且符合schema要求
        
        <目标字段提取说明>
        根据配置，你需要提取以下字段，请严格按照业务规则进行提取：
        
        1. 微信备注名 (slot_name: "微信备注名")
           - 业务规则：微信聊天界面顶部用户备注名称，可能来自左上角（pc端），也可能来自顶部（手机端），也可能不存在
           - 提取要求：必须提取，用于图片分组
           
        2. 欠款合意 (slot_name: "欠款合意")
           - 业务规则：双方对欠款事实的确认，即债务人是否明确承认欠款事实
           - 提取要求：必须提取，这是债务纠纷案件的核心证据
           - 双方欠款合意为真判断标准（必须同时满足以下条件）：
             * 有明确的文字表述，不能仅凭截图、音频等非文字内容判断
             * 债务人明确承认欠款："我确实欠你钱"、"我会还的"、"我承认欠这么多"等
             * 债务人确认具体金额："是的，就是5000元"、"我承认欠这么多"等
             * 债务人承诺还款："我会还的"、"我尽快还"、"我下个月还"等
           - 以下情况不能作为欠款合意的证据：
             * 音频气泡没有转文字内容
             * 债务人发送的无关截图（如其他应用的截图）
             * 债权人单方面的要求或陈述
             * 模糊不清或可解释为其他含义的表述
           - 如果无法从对话中明确判断出债务人的承认意思，则标记为false
           
        3. 欠款金额 (slot_name: "欠款金额")
           - 业务规则：欠款涉及的金额数值，必须是在对话中明确提及的，与当前债务纠纷直接相关的金额
           - 提取要求：必须提取
           - 提取范围：
             * 对话中明确提及的欠款金额："欠你5000元"、"还差3000块"等
             * 转账记录中与当前债务相关的金额
             * 双方在对话中确认的金额数字
             * 对话中提到的还款流水："总欠款10000元，上次还了5000，现在还剩5000"
           - 以下情况不能作为欠款金额：
             * 债务人发送的无关截图中的数字（如其他应用的截图）
             * 与当前债务纠纷无关的金额信息
             * 无法确定是否与当前债务相关的数字
           - 如果对话中没有明确提及欠款金额，则标记为"未提及"或"0"
           
        4. 约定还款日期 (slot_name: "约定还款日期")
           - 业务规则：约定的还款日期，债务人承诺的还款时间
           - 提取要求：可选提取，如果存在则必须提取
           - 提取范围：
             * 明确的日期："我下个月15号还"、"我年底还"等
             * 相对时间："我下周还"、"我过几天还"等（需要根据聊天时间推断具体日期）
             * 时间范围："我尽快还"、"我尽快处理"等（标记为无具体日期）
           
        5. 约定还款利息 (slot_name: "约定还款利息")
           - 业务规则：约定的还款利息率，双方商定的利息计算方式
           - 提取要求：可选提取，如果存在则必须提取
           - 提取范围：
             * 明确的利率："按年息10%"、"月息2%"等
             * 利息金额："每天10元利息"、"一个月100元利息"等
             * 无利息约定："无利息"、"不要利息"等（标记为0）
             * 默认情况：如果没有明确约定，标记为无利息约定
        </目标字段提取说明>
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
