from agno.agent import Agent
from app.agentic.rag.knowledge import knowledge
from app.agentic.llm.base import qwen_chat_model

class KBDemoAgent:

    def __init__(self):
        self.agent = Agent(
            model=qwen_chat_model,
            name="Consult Agent",
            role="你是客服专家",
            knowledge=knowledge,
            search_knowledge=True,
            show_tool_calls=True,
            debug_mode=True
        )

if __name__ == "__main__":
    knowledge.load(upsert=True)
    agent = KBDemoAgent()
    agent.agent.print_response(user_id="1", session_id="1", message="你们是惠安公司吗？", stream=True)