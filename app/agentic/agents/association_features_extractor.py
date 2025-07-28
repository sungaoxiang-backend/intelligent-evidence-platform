from typing import Optional, List, Dict, Any
from agno.agent import Agent
from agno.media import Image
from pydantic import BaseModel
from enum import Enum
from app.agentic.llm.base import openai_image_model


class ImageSequenceInfo(BaseModel):
    """上下文图片URL"""
    url: str
    sequence_number: int

    
class SlotExtraction(BaseModel):
    """单个词槽提取结果"""
    slot_name: str
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
        self.agent = Agent(
            name="关联特征提取专家",
            model=openai_image_model,
            session_state={
                "target_slots_to_extract": [
                    {
                        "slot_name": "微信备注名",
                        "slot_description": "微信用户的用户备注名，在微信聊天界面中的最上方显示，不同的用户可能有不同的备注名",
                        "slot_value_type": "string"
                    },
                    {
                        "slot_name": "欠款合意",
                        "slot_description": "欠款合意，通常是多个图片的上下文中，描述了`债务人`欠款`债权人`的合意",
                        "slot_value_type": "bool"
                    },
                    {
                        "slot_name": "欠款金额",
                        "slot_description": "金额，通常是数字，表示欠款或还款的金额",
                        "slot_value_type": "float"
                    },
                    {
                        "slot_name": "约定还款日期",
                        "slot_description": "约定还款日期，通常是文字描述，表示欠款或还款的日期",
                        "slot_value_type": "date"
                    },
                    {
                        "slot_name": "约定还款利息",
                        "slot_description": "约定还款利息，通常是数字，表示欠款或还款的利息",
                        "slot_value_type": "float"
                    }
                ]
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
        
        <Category Judgment Guide>
        1. `key_text_features`
        - "对话内容", "转账/收款信息", "语音/图片标识", "时间戳", "转账金额", "转账时间", "转账备注"
        2. `key_visual_features`
        - "头像", "昵称", "绿色聊天气泡", "时间戳", "橙色卡片样式转账记录", "白色音频聊天气泡", "白色音频聊天气泡转文本内容"
        3. `layout_features`
        - "聊天记录的布局（左右用户布局）", "顶部有`微信备注名`信息，不同用户有不同的备注名", "左右用户头像分布"
        </Category Judgment Guide>
        
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
        标注的源数据为{target_slots_to_extract}，你分析的结果的本质是对这些数据的标注补充。
        1. 微信备注名: 微信用户的用户备注名，在微信聊天界面中的最上方显示，不同的用户可能有不同的备注名
        2. 欠款合意: 右侧`债权人`表达了左侧`债务人`对其欠款且左侧`债务人`承认并回复，视为欠款合意为真；左侧`债务人`主动提出欠款意思，不管右侧`债权人`是否回复，视为欠款合意为真；其余欠款合意分析的情况视为欠款合意为假。
        3. 欠款金额: 仔细分析组内图片判断最终的欠款金额，其中可能包含计算过程
        4. 约定还款日期: 约定还款日期，通常是文字描述，表示欠款或还款的日期
        5. 约定还款利息: 约定还款利息，通常是数字，表示欠款或还款的利息
        </Target Slots Extraction Guide>
        
        <Data Structure Building Guide>
        构建结构化的过程本质就是对{target_slots_to_extract}的标注补充。
        `target_slots_to_extract`中每个item的说明:
        1. `slot_name`: 目标词槽的名称
        2. `slot_description`: 目标词槽的描述
        3. `slot_value_type`: 目标词槽的值的标准JSON类型
        
        标注结果说明:
        1. `slot_group_name`: 根据某个`微信备注名`分组的名称。
        2. `image_sequence_info`: 某个分组的图片序列信息，每个item包含`url`和`sequence_number`,其中`sequence_number`表示图片在上下文中的顺序，从1开始, 作用域是某个具体分组内而非当前处理的整个图片批次。
        3. `slot_value`: 提取到的具体的目标词槽的对应的词槽值。
        4. `slot_value_from_url`: 提取到的词槽值的来源图片URL列表。
        5. `confidence`: 提取到的具体的目标词槽的对应的词槽值的置信度。
        6. `reasoning`: 提取到的具体的目标词槽的对应的词槽值的提取理由。
        </Data Structure Building Guide>
        
        <Task Planner>
        1. 判别类别：参照<Category Judgment Guide>判断图片的特征是否符合微信(WeChat)聊天记录的特征，若不是可以忽略对其的分析。
        2. 分组：精准识别图片顶部的`微信备注名`，并根据`微信备注名`信息将图片进行分组。
        3. 当事人识别: 微信聊天记录中，左侧为`债务人`，右侧为`债权人`。
        4. 排序: 使用<Enhanced Sorting Guide>规则，为每组生成从1开始的连续序号。
        5. 提取信息: 根据排序后的图片，以及<Target Slots Extraction Guide>提取指南，充分分析上图片内容、下文和关联关系，提取出目标词槽信息。
        6. 输出: 根据<Data Structure Building Guide>构建结构化数据并返回输出。
        </Task Planner>
        
        <Notes>
        1. 注意永远不要提取和输出`target_slots_to_extract`中没有标注的词槽信息。
        2. 你需要理解范围目标提取词槽中每个目标词槽的含义，并在赋值时给与适当的值类型和值（比如int/bool/string)。
        3. 注意即便是没有提取到目标词槽信息，也要将该词槽对应的`slot_value`值设置为`未知`，并说明原因。
        4. 注意输出的`slot_value`中永远不要有任何不应该存在于其中的内容，比如`reasoning`,`slot_name`,`confidence`等。
        5. 输出`sequence_number`必须是连续整数且不能重复。
        </Notes>
        """

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
