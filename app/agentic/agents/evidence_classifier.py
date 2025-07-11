from typing import Optional, List
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
        "classification_priority": "中：当存在多条消息交互时，优先级较高。",
        "exclusion_rules": ["如果截图只包含单条转账记录，应优先考虑‘微信转账记录’。", "如果截图是个人主页，则为‘微信主页’。"]
    },
    EvidenceType.WECHAT_HOMEPAGE: {
        "description": "微信个人主页的完整截图。",
        "key_text_features": ["昵称", "微信号", "地区", "朋友圈"],
        "key_visual_features": ["个人头像", "'发消息'和'音视频通话'按钮"],
        "layout_features": ["顶部为头像和昵称，下方为功能按钮的布局"],
        "classification_priority": "高：当页面布局符合个人主页特征时。",
        "exclusion_rules": ["不能是聊天记录中的头像点击弹窗，必须是完整的个人主页。"]
    },
    EvidenceType.WECHAT_PAY_VOUCHER: {
        "description": "微信支付官方出具的转账电子凭证。",
        "key_text_features": ["转账电子凭证", "付款方", "收款方", "转账金额", "支付时间"],
        "key_visual_features": ["微信支付Logo", "格式化的凭证布局", "通常有'微信支付'的水印或标识"],
        "layout_features": ["标题为‘转账电子凭证’，下方为表格化的详细信息。"],
        "classification_priority": "最高：当‘转账电子凭证’字样出现时，具有决定性。",
        "exclusion_rules": ["不能是普通的转账成功页面截图，必须是官方生成的、可作为正式凭据的电子凭证。"]
    },
    EvidenceType.WECHAT_TRANSFER_PAGE: {
        "description": "微信转账操作过程中的界面截图。",
        "key_text_features": ["转账给", "添加转账说明", "转账金额"],
        "key_visual_features": ["橙色或绿色的转账按钮", "金额输入框", "收款人头像和昵称"],
        "layout_features": ["顶部显示收款人，中间是金额，底部是操作按钮。"],
        "classification_priority": "高：当界面为主动操作转账时。",
        "exclusion_rules": ["如果是转账完成后的截图或聊天记录中的转账消息，应分类为‘微信转账记录’。"]
    },
    EvidenceType.SMS_CHAT_RECORD: {
        "description": "手机系统原生的短信应用聊天记录截图。",
        "key_text_features": ["短信内容", "发送/接收时间", "发件人手机号或名称"],
        "key_visual_features": ["手机系统UI的短信气泡", "顶部的信号、电量等状态栏图标"],
        "layout_features": ["手机短信应用的典型布局"],
        "classification_priority": "中：需要与微信等其他聊天应用区分。",
        "exclusion_rules": ["不能是微信、QQ等第三方应用的聊天记录。"]
    },
    EvidenceType.ALIPAY_TRANSFER_PAGE: {
        "description": "支付宝转账操作过程中的界面截图。",
        "key_text_features": ["转账", "收款方账户", "金额"],
        "key_visual_features": ["支付宝Logo", "蓝色的主色调", "‘确认付款’按钮"],
        "layout_features": ["支付宝App的典型转账界面布局"],
        "classification_priority": "高：当界面为支付宝转账操作时。",
        "exclusion_rules": ["如果是支付宝的账单详情或转账记录列表，则不属于此类。"]
    },
    EvidenceType.GOODS_IOU_NOTE: {
        "description": "明确因‘货款’事由产生的欠条。",
        "key_text_features": ["欠条", "货款", "今欠到", "金额（大写和小写）", "欠款人签名", "日期"],
        "key_visual_features": ["手写或打印的条据", "签名或盖章"],
        "layout_features": ["标准的条据格式，包含标题、正文、落款。"],
        "classification_priority": "最高：当‘欠条’和‘货款’同时出现时，具有决定性。",
        "exclusion_rules": ["如果没有明确提及‘货款’，而是其他原因（如借款），则不属于此类。", "必须是‘欠条’，而不是‘收条’或‘发货单’。"]
    },
    EvidenceType.LOAN_IOU_NOTE: {
        "description": "明确为‘借款’事由产生的借条。",
        "key_text_features": ["借条", "借款", "今借到", "金额（大写和小写）", "利息", "借款人签名", "日期"],
        "key_visual_features": ["手写或打印的条据", "签名或盖章", "可能包含身份证号码"],
        "layout_features": ["标准的条据格式，包含标题、正文、落款。"],
        "classification_priority": "最高：当‘借条’出现时，具有决定性。",
        "exclusion_rules": ["如果事由是‘货款’，则为‘货款欠条’。", "必须是‘借条’，而不是‘还款收据’。"]
    },
    EvidenceType.BANK_TRANSFER_RECORD: {
        "description": "银行App、网上银行或银行柜台回单的转账记录。",
        "key_text_features": ["交易流水号", "付款人账号/户名", "收款人账号/户名", "交易金额", "交易时间"],
        "key_visual_features": ["银行Logo", "表格化的交易详情", "银行回单的特定格式"],
        "layout_features": ["通常是表格或列表形式，清晰列出各项交易信息。"],
        "classification_priority": "高：当出现银行官方界面的交易记录时。",
        "exclusion_rules": ["不能是微信或支付宝的转账记录。"]
    },
    EvidenceType.WECHAT_TRANSFER_RECORD: {
        "description": "微信聊天记录或账单中的转账记录截图。",
        "key_text_features": ["转账", "已收钱", "待收款", "转账金额", "转账时间"],
        "key_visual_features": ["微信转账的绿色或橙色图标", "聊天气泡中的转账消息样式"],
        "layout_features": ["出现在聊天流中或微信账单列表中。"],
        "classification_priority": "中：作为聊天记录的补充，确认转账事实。",
        "exclusion_rules": ["不能是正在进行的转账操作页面（应为‘微信转账页面’），也不能是官方的电子凭证（应为‘微信支付转账电子凭证’）。"]
    },
    EvidenceType.VAT_INVOICE: {
        "description": "国家税务局监制的增值税发票。",
        "key_text_features": ["增值税专用/普通发票", "发票代码", "发票号码", "购买方信息", "销售方信息", "金额合计", "税额合计"],
        "key_visual_features": ["发票监制章（红色椭圆章）", "二维码", "标准的表格格式"],
        "layout_features": ["国家统一的发票版式，布局固定。"],
        "classification_priority": "最高：当‘发票’字样和标准格式出现时，具有决定性。",
        "exclusion_rules": ["不能是购物小票、收据或其他非官方发票。"]
    },
    EvidenceType.ID_CARD: {
        "description": "中华人民共和国居民身份证。",
        "key_text_features": ["中华人民共和国居民身份证", "姓名", "性别", "民族", "出生", "住址", "公民身份号码"],
        "key_visual_features": ["国徽（正面）", "个人头像照片（正面）", "长城图案（背面）", "签发机关（背面）"],
        "layout_features": ["国家标准的身份证正反面布局。"],
        "classification_priority": "最高：当身份证特征明确时，具有决定性。",
        "exclusion_rules": ["不能是临时身份证、户口簿或驾驶证。"]
    },
    EvidenceType.HOUSEHOLD_REGISTER: {
        "description": "中华人民共和国居民户口簿。",
        "key_text_features": ["居民户口簿", "户主页", "常住人口登记卡", "户号", "姓名", "与户主关系"],
        "key_visual_features": ["公安机关的户口专用章（红色公章）", "特定的表格和栏目"],
        "layout_features": ["户口簿内页的标准格式。"],
        "classification_priority": "最高：当户口簿特征明确时，具有决定性。",
        "exclusion_rules": ["不能是单页的户籍证明信，必须是户口簿本身。"]
    },
    EvidenceType.COMPANY_BUSINESS_LICENSE: {
        "description": "公司或企业的官方营业执照。",
        "key_text_features": ["营业执照", "统一社会信用代码", "公司名称", "法定代表人", "成立日期"],
        "key_visual_features": ["国徽图标", "红色印章（市场监督管理局）"],
        "layout_features": ["标准的官方证件布局"],
        "classification_priority": "最高：当‘营业执照’和公司信息明确时，具有决定性。",
        "exclusion_rules": ["如果明确写有‘个体工商户’，则为‘个体工商户营业执照’。", "不能是国家企业信用信息公示系统的网页截图。"]
    },
    EvidenceType.INDIVIDUAL_BUSINESS_LICENSE: {
        "description": "个体工商户的官方LICENSE。",
        "key_text_features": ["个体工商户营业执照", "统一社会信用代码", "经营者姓名", "经营场所"],
        "key_visual_features": ["国徽图标", "红色印章（市场监督管理局）"],
        "layout_features": ["标准的官方证件布局，但标题明确为‘个体工商户’。"],
        "classification_priority": "最高：当‘个体工商户营业执照’字样明确时，具有决定性。",
        "exclusion_rules": ["如果名称为‘公司’，则为‘公司LICENSE’。"]
    },
    EvidenceType.COMPANY_GSXT_LICENSE: {
        "description": "国家企业信用信息公示系统（GSXT）网站上关于公司的信息页面截图。",
        "key_text_features": ["国家企业信用信息公示系统", "企业信用信息", "统一社会信用代码", "法定代表人"],
        "key_visual_features": ["网站的页眉和页脚", "网页的UI元素（如搜索框、导航栏）"],
        "layout_features": ["网页布局，信息以模块化方式展示。"],
        "classification_priority": "高：当页面内容来自国家企业信用信息公示系统网站时。",
        "exclusion_rules": ["不能是营业执照原件的照片，必须是该网站的截图。"]
    },
    EvidenceType.INDIVIDUAL_GSXT_LICENSE: {
        "description": "国家企业信用信息公示系统（GSXT）网站上关于个体工商户的信息页面截图。",
        "key_text_features": ["国家企业信用信息公示系统", "个体工商户", "经营者"],
        "key_visual_features": ["网站的页眉和页脚", "网页的UI元素"],
        "layout_features": ["网页布局，信息以模块化方式展示。"],
        "classification_priority": "高：当页面内容来自国家企业信用信息公示系统网站且主体为个体户时。",
        "exclusion_rules": ["不能是LICENSE原件的照片，必须是该网站的截图。"]
    },
    EvidenceType.RESIDENCE_CERTIFICATE: {
        "description": "由社区、派出所等官方机构出具的用于证明居住事实的文件。",
        "key_text_features": ["居住证明", "流动人口信息登记表", "住址", "姓名", "身份证号"],
        "key_visual_features": ["红色公章", "官方机构名称（如派出所、社区居委会）"],
        "layout_features": ["正式的官方文件或表格布局"],
        "classification_priority": "高：当文件明确为官方出具的居住证明时，优先级最高。",
        "exclusion_rules": ["如果文件核心是身份证信息，则为‘身份证’。", "不能是普通的快递单或外卖单。"]
    },
    EvidenceType.PHONE_NUMBER: {
        "description": "图片的核心内容是一个或多个电话号码。",
        "key_text_features": ["11位手机号码", "区号和固定电话号码"],
        "key_visual_features": ["数字是图片的主要视觉元素"],
        "layout_features": ["通常没有复杂的布局，主要是数字列表或文本。"],
        "classification_priority": "低：仅当图片内容单一，无其他复杂背景信息时适用。",
        "exclusion_rules": ["如果电话号码出现在名片、收据、合同等复杂文档中，则不应归类于此，应根据主体内容分类。"]
    },
    EvidenceType.BANK_ACCOUNT: {
        "description": "图片的核心内容是一个或多个银行卡号或银行卡照片。",
        "key_text_features": ["银行卡号（通常为16-19位）", "开户行名称"],
        "key_visual_features": ["银行Logo", "银行卡特有的设计元素"],
        "layout_features": ["主要是银行卡或包含卡号的列表。"],
        "classification_priority": "低：仅当图片内容单一，无其他复杂背景信息时适用。",
        "exclusion_rules": ["如果银行账号出现在转账记录、合同等复杂文档中，则不应归类于此，应根据主体内容分类。"]
    }
}

def get_evidence_type_features_guide():
    """生成一个详细的、结构化的证据类型分类指南，用于指导LLM进行判断。"""
    guide_parts = []
    for evidence_type, features in EVIDENCE_TYPE_FEATURES.items():
        feature_lines = [
            f"- **证据类型 (EvidenceType):** {evidence_type.value}",
            f"  - **描述 (Description):** {features['description']}",
            f"  - **关键文本特征 (Key Text Features):** {features['key_text_features']}",
            f"  - **关键视觉特征 (Key Visual Features):** {features['key_visual_features']}",
            f"  - **布局特征 (Layout Features):** {features['layout_features']}",
            f"  - **分类优先级 (Classification Priority):** {features['classification_priority']}",
            f"  - **反例/排除规则 (Exclusion Rules):** {features['exclusion_rules']}"
        ]
        guide_parts.append("\n".join(feature_lines))
    return "\n\n".join(guide_parts)


class EvidenceClassifiResult(BaseModel):
    image_url: str
    evidence_type: EvidenceType
    confidence: float
    reasoning: str
    

class EvidenceClassifiResults(BaseModel):
    results: Optional[List[EvidenceClassifiResult]]


class EvidenceClassifier:

    def __init__(self) -> None:
        self.agent = Agent(
            name="证据分类专家",
            model=openai_image_model,
            session_state={
                "evidence_type_descriptions": get_evidence_type_features_guide(),
            },
            add_state_in_messages=True,
            instructions="""
你是一个专业的法律证据分类AI助手。你的任务是根据用户上传的图片，准确地判断其属于哪一种证据类型。

**工作流程:**
1.  **分析图片:** 仔细分析图片中的所有文本、图像、布局和元数据信息。
2.  **参考分类指南:** 你将收到一个结构化的证据分类指南，其中详细描述了每种证据类型的特征，包括：
    *   `描述 (Description)`: 证据的一般性说明。
    *   `关键文本特征 (Key Text Features)`: 必须或通常出现的特定文字、短语、数字格式。
    *   `关键视觉特征 (Key Visual Features)`: 标志性图标、印章、颜色、排版样式等。
    *   `布局特征 (Layout Features)`: 信息的组织方式，如表格、对话气泡、表单结构等。
    *   `分类优先级 (Classification Priority)`: 在面对多种可能性时，应如何权衡，哪个特征是决定性的。
    *   `反例/排除规则 (Exclusion Rules)`: 明确指出哪些情况不应被归类为该类型，以避免混淆。
3.  **综合判断与匹配:**
    *   **严格匹配:** 将图片特征与指南中的各项描述进行严格匹配。
    *   **核心特征优先:** 必须以 `关键文本特征` 和 `关键视觉特征` 作为主要判断依据。布局和其他次要信息仅作辅助参考。
    *   **应用排除规则:** 严格遵守 `反例/排除规则`，如果图片符合某类型的排除规则，则坚决不能将其分类为该类型。
    *   **权重与优先级:** 遵循 `分类优先级` 的指导，当图片可能符合多种类型时，选择优先级最高的或最符合核心特征的那个。
4.  **输出格式:**
    *   你的最终输出必须是一个JSON对象，格式为 `EvidenceClassifiResult`。
    *   `evidence_type` 字段必须是 `EvidenceType` 枚举中的一个有效值。
    *   `confidence` 字段表示你的置信度（0.0到1.0之间）。
    *   `reasoning` 字段需要详细解释你的分类理由，说明你是如何运用分类指南中的具体特征（文本、视觉、布局、排除规则）得出结论的。

**注意事项:**
*   **拒绝模糊分类:** 如果图片信息不足或质量太差，无法明确分类，请选择 `UNKNOWN` 类型，并说明原因。
*   **单一最佳匹配:** 即使图片中包含多种信息，你也必须选择一个最核心、最主要的证据类型。例如，一张包含身份证照片的微信聊天截图，应被分类为 `WECHAT_CHAT_RECORD`，因为其主要载体是聊天记录，身份证仅是内容之一。这通常在 `排除规则` 中有明确说明。
*   **不要猜测:** 你的所有判断都必须基于图片中可见的、明确的证据。
*   **中文友好:** 请使用中文输出你的`reasoning`。

现在，请根据以下证据分类指南，对用户提供的图片进行分类。

**[证据分类指南]**
{evidence_type_descriptions}
""",
            response_model=EvidenceClassifiResults,

            show_tool_calls=True,
            debug_mode=True
        )


if __name__ == '__main__':
    # 模拟外部传入的图片 URL 列表
    image_urls = [
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070805_发票.png",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070808_银行卡.jpg",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711072414_1.jpg",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711072415_2.png",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711072415_3.png",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711075710_4.jpg",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711075710_5.jpg"
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
    evidence_clissifier.agent.print_response(message=message, images=images)
