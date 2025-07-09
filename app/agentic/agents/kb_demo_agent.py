from agno.agent import Agent
from app.agentic.rag.knowledge import knowledge

class KBDemoAgent:

    def __init__(self):
        self.agent = Agent(
            name="Consult Agent",
            role="你是客服专家，目标是精准的回复用户的关于公司信息的提问",
            knowledge=knowledge,
            search_knowledge=True,
            enable_agentic_knowledge_filters=True,
            knowledge_filters={"公司名称": "汇法律"},
            show_tool_calls=True,
            debug_mode=True
        )

if __name__ == "__main__":
    knowledge.load(upsert=True)
    agent = KBDemoAgent()
    agent.agent.print_response("你们是惠安公司吗？", stream=True)