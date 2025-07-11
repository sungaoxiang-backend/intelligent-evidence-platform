from typing import Optional, List
from agno.agent import Agent
from agno.team import Team
from agno.media import Image
from pydantic import BaseModel
from enum import Enum
from app.agentic.llm.base import openai_image_model


class EvidenceType(str, Enum):
    WECHAT_CHAT_RECORD = "微信聊天记录"
    WECHAT_HOMEPAGE = "微信主页"
    WECHAT_PAY_VOUCHER = "微信支付转账电子凭证"
    WECHAT_TRANSFER_PAGE = "微信转账页面"
    SMS_RECORD = "短信记录"
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


class EvidenceClassifiResult(BaseModel):
    image_url: str
    evidence_type: EvidenceType
    

class EvidenceClassifiResults(BaseModel):
    results: Optional[List[EvidenceClassifiResult]]

def get_evidence_type_descriptions():
    return "\n".join([f'- `{member.name}`: {member.value}' for member in EvidenceType])

team = Team(
    name="证据分类Team",
    model=openai_image_model,
    mode="route",
    session_state={
        "evidence_type_descriptions": get_evidence_type_descriptions(),
    },
    members=[],
    tools=[get_evidence_type_descriptions],
    instructions="""
    <Backstory>
    你是一个证据分类助手，根据用户上传的证据图片，判断证据类型。
    </Backstory>

    <Task Plan>
    1. 分析图片并且输出的分类必须在预设分类中，参见:{evidence_type_descriptions}
    2. 不在预设分类中的，只能输出 UNKNOWN
    </Task Plan>
    
    <Note>
    1. 永远不要自行创造分类
    2. 无需转发任何成员，请直接输出分类结果
    </Note>
    """,
    response_model=EvidenceClassifiResults,

    show_tool_calls=True,
    show_members_responses=True,
    debug_mode=True

)

if __name__ == '__main__':
    # 模拟外部传入的图片 URL 列表
    image_urls = [
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070805_发票.png",
        # "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070808_银行卡.jpg",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711072414_1.jpg",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711072415_2.png",
        "https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250711072415_3.png"
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
    team.print_response(message=message, images=images)