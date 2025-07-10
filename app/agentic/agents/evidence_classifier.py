from agno.agent import Agent
from app.agentic.rag.knowledge import knowledge
from pydantic import BaseModel
from typing import List
from agno.media import Image
from app.agentic.llm.base import qwen_muti_model
from agno.models.openai import OpenAIChat

class EvidenceClassificationResult(BaseModel):
    file_url: str
    category_id: str
    category_name: str
    sub_category_name: str
    confidence: float
    reason: str


class Results(BaseModel):
    results: List[EvidenceClassificationResult]

openai_image_model = OpenAIChat(
        id="gpt-4o",
        api_key="sk-HGsqtwCWtnuul9258jZG8dHlUXptRF3A6ULNOuh6ttDUTx5q",
        base_url="https://aizex.top/v1",
    )

class EvidenceClassifier:

    def __init__(self):
        self.agent = Agent(
            model=openai_image_model,
            name="证据分类专家",
            role="你是一个证据分类专家，你的目标是接收一组证据并将它们按照知识库中的分类指南进行准确的数据标注分类",
            instructions=[
                "在响应之前永远要查询你的知识库",
                "确保分类是知识库中的,永远不要自行创造分类",
                "`category_id`和`category_name`和`sub_category_name`是每个知识库知识中的元数据,请你尽可能多的输出你分类和命中的数据标注值",
                "若分类不在知识库中被匹对,那么`category_id`或`category_name`或`sub_category_name`应该为`unknown`，意味着它可能不在知识库中",
                "确保使用中文输出`reason`"
            ],
            knowledge=knowledge,
            search_knowledge=True,
            enable_agentic_knowledge_filters=True,
            response_model=Results,
            markdown=True,
            show_tool_calls=True,
            debug_mode=True
        )


if __name__ == "__main__":
    knowledge.load(upsert=True)
    evidence_classifier = EvidenceClassifier()
    evidence_classifier.agent.print_response("请对以下证据进行分类：\n"
                                  "1. file_url: https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070805_发票.png\n"
                                  "2. file_url: https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070808_银行卡.jpg\n",
                                  images=[
                                    Image(url="https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070805_发票.png"),
                                    Image(url="https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250710070808_银行卡.jpg")
                                  ])