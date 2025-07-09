from agno.agent import Agent
from app.agentic.rag.knowledge import knowledge

class EvidenceClassifier:

    def __init__(self):
        self.agent = Agent(
            name="证据分类专家",
            role="你是一个证据分类专家，你的目标是接收一组证据并将它们进行准确的分类",
            knowledge=knowledge,
            search_knowledge=True,
            enable_agentic_knowledge_filters=True,
            show_tool_calls=True,
            debug_mode=True
        )