from typing import Optional, List, Dict, Any
from agno.agent import Agent
from agno.media import Image
from pydantic import BaseModel
from enum import Enum
from app.agentic.llm.base import openai_image_model


class EvidenceType(str, Enum):
    WECHAT_CHAT_RECORD = "微信聊天记录"
    WECHAT_HOMEPAGE = "微信主页"
    WECHAT_PAY_VOUCHER = "微信支付转账电子凭证"
    WECHAT_TRANSFER_PAGE = "微信转账页面"
    SMS_CHAT_RECORD = "短信聊天记录"
    ALIPAY_TRANSFER_PAGE = "支付宝转账页面"
    GOODS_IOU_NOTE = "货款欠条"
    LOAN_IOU_NOTE = "借款借条"
    BANK_TRANSFER_RECORD = "银行转账记录"
    WECHAT_TRANSFER_RECORD = "微信转账记录"
    VAT_INVOICE = "增值税发票"
    ID_CARD = "身份证"
    HOUSEHOLD_REGISTER = "户籍档案"
    COMPANY_BUSINESS_LICENSE = "公司营业执照"
    INDIVIDUAL_BUSINESS_LICENSE = "个体工商户营业执照"
    COMPANY_GSXT_LICENSE = "公司全国企业公示系统营业执照"
    INDIVIDUAL_GSXT_LICENSE = "个体工商户全国企业公示系统营业执照"
    RESIDENCE_CERTIFICATE = "经常居住地证明"
    PHONE_NUMBER = "电话号码"
    BANK_ACCOUNT = "银行账户"

EVIDENCE_TYPE_FEATURES = {
    EvidenceType.WECHAT_CHAT_RECORD: {
        "description": "微信聊天记录的截图，包含对话内容。",
        "key_text_features": ["对话内容", "转账/收款信息", "语音/图片标识"],
        "key_visual_features": ["聊天气泡布局（左右分布）", "用户头像", "时间戳"],
        "layout_features": ["典型的即时通讯应用布局"],
        "considercorrelations": True,
        "target_slots_to_extract": ["微信备注名", "欠款合意", "金额", "约定还款日期", "约定还款利息"]
    },
    EvidenceType.WECHAT_HOMEPAGE: {
        "description": "微信个人主页的完整截图。",
        "key_text_features": ["昵称", "微信号", "地区", "朋友圈"],
        "key_visual_features": ["个人头像", "'发消息'和'音视频通话'按钮"],
        "layout_features": ["顶部为头像和昵称，下方为功能按钮的布局"],
        "consider_correlations": False,
        "target_slots_to_extract": ["微信备注名", "微信号"]
    },
    EvidenceType.WECHAT_PAY_VOUCHER: {
        "description": "微信支付官方出具的转账电子凭证。",
        "key_text_features": ["转账电子凭证", "付款方", "收款方", "转账金额", "支付时间"],
        "key_visual_features": ["微信支付Logo", "格式化的凭证布局", "通常有'微信支付'的水印或标识"],
        "layout_features": ["标题为‘转账电子凭证’，下方为表格化的详细信息。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["付款方真名", "付款方微信号", "收款方真名", "收款方微信号", "转账金额"]
    },
    EvidenceType.WECHAT_TRANSFER_PAGE: {
        "description": "微信转账操作界面截图。",
        "key_text_features": ["转账金额", "添加转账说明"],
        "key_visual_features": ["橙色或绿色的转账按钮", "金额输入框", "收款人头像和昵称"],
        "layout_features": ["顶部显示收款人，中间是金额，底部是操作按钮。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["微信备注名", "真名", "微信号"]
    },
    EvidenceType.SMS_CHAT_RECORD: {
        "description": "手机系统原生的短信应用聊天记录截图。",
        "key_text_features": ["短信内容", "发送/接收时间", "发件人手机号或名称"],
        "key_visual_features": ["手机系统UI的短信气泡", "顶部的信号、电量等状态栏图标"],
        "layout_features": ["手机短信应用的典型布局"],
        "consider_correlations": True,
        "target_slots_to_extract": ["手机号码", "备注名", "欠款合意", "欠款金额", "约定还款日期", "约定还款利息"]
    },
    EvidenceType.ALIPAY_TRANSFER_PAGE: {
        "description": "支付宝转账操作界面截图。",
        "key_text_features": ["转账", "收款方账户", "金额"],
        "key_visual_features": ["支付宝Logo", "蓝色的主色调", "‘确认付款’按钮"],
        "layout_features": ["支付宝App的典型转账界面布局"],
        "consider_correlations": False,
        "target_slots_to_extract": ["手机号码", "真名"]
    },
    EvidenceType.GOODS_IOU_NOTE: {
        "description": "明确因‘货款’事由产生的欠条。",
        "key_text_features": ["欠条", "货款", "今欠到", "金额（大写和小写）", "欠款人签名", "日期"],
        "key_visual_features": ["手写或打印的条据", "签名或盖章"],
        "layout_features": ["标准的条据格式，包含标题、正文、落款。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["债权人真名", "债权人签字名字", "债权人盖章名字", "债务人真名", "债务人签字名字", "债务人盖章名字", "欠款金额", "欠款合意"]
    },
    EvidenceType.LOAN_IOU_NOTE: {
        "description": "明确为‘借款’事由产生的借条。",
        "key_text_features": ["借条", "借款", "今借到", "金额（大写和小写）", "利息", "借款人签名", "日期"],
        "key_visual_features": ["手写或打印的条据", "签名或盖章", "可能包含身份证号码"],
        "layout_features": ["标准的条据格式，包含标题、正文、落款。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["债权人真名", "债权人签字名字", "债权人盖章名字", "债务人真名", "债务人签字名字", "债务人盖章名字", "欠款金额", "欠款合意"]
    },
    EvidenceType.BANK_TRANSFER_RECORD: {
        "description": "银行App、网上银行或银行柜台回单的转账记录。",
        "key_text_features": ["交易流水号", "付款人账号/户名", "收款人账号/户名", "交易金额", "交易时间"],
        "key_visual_features": ["银行Logo", "表格化的交易详情", "银行回单的特定格式"],
        "layout_features": ["通常是表格或列表形式，清晰列出各项交易信息。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["转账账户", "转账账户真名", "转账金额"]
    },
    EvidenceType.WECHAT_TRANSFER_RECORD: {
        "description": "微信聊天记录或账单中的转账记录截图。",
        "key_text_features": ["转账", "已收钱", "待收款", "转账金额", "转账时间"],
        "key_visual_features": ["微信转账的绿色或橙色图标", "聊天气泡中的转账消息样式"],
        "layout_features": ["出现在聊天流中或微信账单列表中。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["转账账户备注名", "转账金额"]
    },
    EvidenceType.VAT_INVOICE: {
        "description": "国家税务局监制的增值税发票。",
        "key_text_features": ["增值税专用/普通发票", "发票代码", "发票号码", "购买方信息", "销售方信息", "金额合计", "税额合计"],
        "key_visual_features": ["发票监制章（红色椭圆章）", "二维码", "标准的表格格式"],
        "layout_features": ["国家统一的发票版式，布局固定。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["购买方真名", "购买方纳税人识别号", "销售方真名", "销售方纳税人识别号", "价税合计"]
    },
    EvidenceType.ID_CARD: {
        "description": "中华人民共和国居民身份证。",
        "key_text_features": ["中华人民共和国居民身份证", "姓名", "性别", "民族", "出生", "住址", "公民身份号码"],
        "key_visual_features": ["国徽（正面）", "个人头像照片（正面）", "长城图案（背面）", "签发机关（背面）"],
        "layout_features": ["国家标准的身份证正反面布局。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["姓名", "性别", "民族", "出生", "住址", "公民身份号码"]
    },
    EvidenceType.HOUSEHOLD_REGISTER: {
        "description": "中华人民共和国居民户口簿。",
        "key_text_features": ["居民户口簿", "户主页", "常住人口登记卡", "户号", "姓名", "与户主关系"],
        "key_visual_features": ["公安机关的户口专用章（红色公章）", "特定的表格和栏目"],
        "layout_features": ["户口簿内页的标准格式。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["姓名", "性别", "民族", "出生", "住址", "公民身份号码"]
    },
    EvidenceType.COMPANY_BUSINESS_LICENSE: {
        "description": "公司或企业的官方营业执照。",
        "key_text_features": ["营业执照", "统一社会信用代码", "公司名称", "法定代表人", "成立日期"],
        "key_visual_features": ["国徽图标", "红色印章（市场监督管理局）"],
        "layout_features": ["标准的官方证件布局"],
        "consider_correlations": False,
        "target_slots_to_extract": ["公司名称", "统一社会信用代码", "法定代表人", "公司类型", "住所地"]
    },
    EvidenceType.INDIVIDUAL_BUSINESS_LICENSE: {
        "description": "个体工商户的官方LICENSE。",
        "key_text_features": ["个体工商户营业执照", "统一社会信用代码", "经营者姓名", "经营场所"],
        "key_visual_features": ["国徽图标", "红色印章（市场监督管理局）"],
        "layout_features": ["标准的官方证件布局，但标题明确为‘个体工商户’。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["经营名称", "统一社会信用代码", "经营类型", "经营者姓名", "住所地"]
    },
    EvidenceType.COMPANY_GSXT_LICENSE: {
        "description": "国家企业信用信息公示系统（GSXT）网站上关于公司的信息页面截图。",
        "key_text_features": ["国家企业信用信息公示系统", "企业信用信息", "统一社会信用代码", "法定代表人"],
        "key_visual_features": ["网站的页眉和页脚", "网页的UI元素（如搜索框、导航栏）"],
        "layout_features": ["网页布局，信息以模块化方式展示。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["公司名称", "统一社会信用代码", "法定代表人", "公司类型", "住所地", "股东名称"]
    },
    EvidenceType.INDIVIDUAL_GSXT_LICENSE: {
        "description": "国家企业信用信息公示系统（GSXT）网站上关于个体工商户的信息页面截图。",
        "key_text_features": ["国家企业信用信息公示系统", "个体工商户", "经营者"],
        "key_visual_features": ["网站的页眉和页脚", "网页的UI元素"],
        "layout_features": ["网页布局，信息以模块化方式展示。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["经营名称", "统一社会信用代码", "经营类型", "经营者姓名", "住所地"]
    },
    EvidenceType.RESIDENCE_CERTIFICATE: {
        "description": "由社区、派出所等官方机构出具的用于证明居住事实的文件。",
        "key_text_features": ["居住证明", "流动人口信息登记表", "住址", "姓名", "身份证号"],
        "key_visual_features": ["红色公章", "官方机构名称（如派出所、社区居委会）"],
        "layout_features": ["正式的官方文件或表格布局"],
        "consider_correlations": False,
        "target_slots_to_extract": ["真名", "经常居住地址", "居住开始时间", "居住截止时间", "居住是否满一年"]
    },
    EvidenceType.PHONE_NUMBER: {
        "description": "图片的核心内容是一个或多个电话号码。",
        "key_text_features": ["11位手机号码", "区号和固定电话号码"],
        "key_visual_features": ["数字是图片的主要视觉元素"],
        "layout_features": ["通常没有复杂的布局，主要是数字列表或文本。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["电话号码"]
    },
    EvidenceType.BANK_ACCOUNT: {
        "description": "图片的核心内容是一个或多个银行卡号或银行卡照片。",
        "key_text_features": ["银行卡号（通常为16-19位）", "开户行名称"],
        "key_visual_features": ["银行Logo", "银行卡特有的设计元素"],
        "layout_features": ["主要是银行卡或包含卡号的列表。"],
        "consider_correlations": False,
        "target_slots_to_extract": ["银行卡号", "开户支行"]
    }
}

class ExtractedFeature(BaseModel):
    """单个提取的特征信息"""
    slot_name: str
    value: str
    confidence: float
    position: Optional[str] = None  # 在图片中的位置描述

class SlotExtraction(BaseModel):
    """单个词槽提取结果"""
    from_urls: List[str]  # 来源图片URL，单个或联合
    slot_name: str  # 必须是target_slots_to_extract中的key
    slot_value: str
    confidence: float
    reasoning: str  # 提取理由，特别说明来自哪些图片

class EvidenceExtractionResults(BaseModel):
    """特征提取结果"""
    results: List[SlotExtraction]  # 所有提取的词槽结果

def get_extraction_guide(evidence_type: EvidenceType, consider_correlations: bool = False) -> str:
    """生成针对特定证据类型的特征提取指南"""
    features = EVIDENCE_TYPE_FEATURES[evidence_type]
    guide_parts = [
        f"**证据类型**: {evidence_type.value}",
        f"**描述**: {features['description']}",
        f"**需要提取的关键信息**: {', '.join(features['target_slots_to_extract'])}",
    ]
    
    if consider_correlations and features.get("consider_correlations"):
        guide_parts.extend([
            "**上下文关联分析**: 需要结合多张图片的关联信息",
            "**关联要点**: 同一人物、金额、时间等信息的交叉验证"
        ])
    
    return "\n".join(guide_parts)

class EvidenceFeaturesExtractor:
    """证据特征提取器 - 专注于从已分类的证据图片中提取关键信息"""
    
    def __init__(self) -> None:
        self.agent = Agent(
            name="证据特征提取专家",
            model=openai_image_model,
instructions="""你是一个专业的法律证据信息提取AI助手。你的任务是从已分类的证据图片中提取关键信息字段，支持单个证据的独立特征提取和跨证据的联合特征提取。

**核心任务**: 从提供的图片中提取target_slots_to_extract中指定的所有词槽，支持单个图片提取和多个图片联合提取。

**数据结构要求**: 
- 必须使用统一的SlotExtraction结构
- 每个提取结果包含: from_urls(来源图片列表), slot_name(目标词槽名), slot_value(提取值), confidence(置信度), reasoning(提取理由)
- 禁止使用任何其他字段名或结构

**提取规则:**
1. **严格词槽限制**: 只能提取target_slots_to_extract中明确列出的词槽，禁止创建新词槽名
2. **统一格式**: 无论单个图片还是多个图片联合提取，都使用相同的SlotExtraction结构
3. **值来源说明**: 在reasoning中明确说明信息来自哪些图片
4. **联合提取**: 当consider_correlations=True时，某些词槽值需要综合分析多个图片得出
5. **置信度**: 为每个提取的字段给出0-1之间的置信度

**输出格式要求**:
返回EvidenceExtractionResults结构，其中results字段是SlotExtraction列表。

**联合提取示例**:
当consider_correlations=True时，可以创建跨图片的提取结果：
```json
{
  "results": [
    {
      "from_urls": ["image1", "image2"],
      "slot_name": "欠款合意",
      "slot_value": "是",
      "confidence": 0.9,
      "reasoning": "image1中债务人承认欠款，image2中债权人确认债务金额，综合判断存在欠款合意"
    },
    {
      "from_urls": ["image3"],
      "slot_name": "欠款金额",
      "slot_value": "10000",
      "confidence": 0.95,
      "reasoning": "image3中明确显示欠款金额为10000元"
    }
  ]
}
```

**重要**: 禁止输出任何不在target_slots_to_extract列表中的词槽名。
现在开始提取指定证据图片中的关键信息。
""",
            response_model=EvidenceExtractionResults,
            show_tool_calls=True,
            debug_mode=True
        )
    
    def extract_features(
        self, 
        image_urls: List[str], 
        evidence_types: List[EvidenceType],
        consider_correlations: bool = False
    ):
        """从图片中提取特征信息
        
        Args:
            image_urls: 图片URL列表
            evidence_types: 对应的证据类型列表
            consider_correlations: 是否考虑上下文关联
        """
        # 如果evidence_types只有一个类型，则应用到所有图片
        if len(evidence_types) == 1 and len(image_urls) > 1:
            evidence_types = [evidence_types[0]] * len(image_urls)
        elif len(image_urls) != len(evidence_types):
            raise ValueError("图片数量与证据类型数量不匹配")
        
        # 收集所有需要提取的词槽（去重）
        all_target_slots = set()
        for evidence_type in set(evidence_types):
            features = EVIDENCE_TYPE_FEATURES[evidence_type]
            target_slots = features.get('target_slots_to_extract', [])
            all_target_slots.update(target_slots)
        
        # 构建提取指南
        extraction_guides = []
        for evidence_type in evidence_types:
            guide = get_extraction_guide(evidence_type, consider_correlations)
            extraction_guides.append(guide)
        
        # 构建消息
        message_parts = ["请从以下证据图片中提取关键信息:"]
        for i, (url, evidence_type, guide) in enumerate(zip(image_urls, evidence_types, extraction_guides)):
            message_parts.append(f"\n{i+1}. 图片: {url}")
            message_parts.append(f"   证据类型: {evidence_type.value}")
            message_parts.append(f"   提取指南: {guide}")
        
        # 添加统一的词槽提取要求
        message_parts.append(f"\n**需要提取的词槽**: {list(all_target_slots)}")
        message_parts.append("**输出格式**: 使用SlotExtraction结构，包含from_urls, slot_name, slot_value, confidence, reasoning")
        
        if consider_correlations:
            message_parts.append("\n**注意**: 请分析各图片间的关联信息，支持跨图片联合提取")
        
        message = "\n".join(message_parts)
        
        # 创建图片对象
        images = [Image(url=url) for url in image_urls]
        
        # 执行提取
        return self.agent.print_response(message=message, images=images)

if __name__ == '__main__':
    # 测试用例
    test_image_urls = [
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070805_发票.png",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070808_银行卡.jpg",
    ]
    test_images_need_consider_correlations = [
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/f990868379fc4e36a8356276af9aa5fb_0e8380a5056ccb80f5bde40581da5e0.png",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/2086abe6d82d43d19fbf2216d91f30fb_92be1d164c1a88080b85a8ff6a6413d.png",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/f318619c56f04c7dbf718cd9f8150653_456130154ef9a4693b047b4fb713696.png"
    ]
    
    test_evidence_types = [
        EvidenceType.VAT_INVOICE,
        EvidenceType.BANK_ACCOUNT
    ]
    
    extractor = EvidenceFeaturesExtractor()
    
    # 测试1: 独立特征提取（不关联）
    print("=== 测试独立特征提取 ===")
    extractor.extract_features(
        image_urls=test_images_need_consider_correlations[:2],
        evidence_types=[EvidenceType.WECHAT_CHAT_RECORD],
        consider_correlations=False
    )
    
    # 测试2: 联合特征提取（关联分析）
    print("\n=== 测试联合特征提取 ===")
    extractor.extract_features(
        image_urls=test_images_need_consider_correlations,
        evidence_types=[EvidenceType.WECHAT_CHAT_RECORD],
        consider_correlations=True
    )
    
    print("提取完成")

# 预期输出格式示例
expected_output_example = [
    {
        "from_urls": ["image1", "image2"],
        "slot_name": "欠款合意",
        "slot_value": True,
        "confidence": 0.9,
        "reasoning": "这两张图体现了a欠了b的钱，且a承认了欠钱"
    },
    {
        "from_urls": ["image3", "image4"],
        "slot_name": "欠款金额",
        "slot_value": "10万",
        "confidence": 0.9,
        "reasoning": "image3体现了债务人说先想要还5万，image4提到剩下5万再延缓1个月，故总计欠款10万"
    }
]