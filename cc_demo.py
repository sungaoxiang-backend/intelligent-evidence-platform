import os
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions
from dotenv import load_dotenv

# 认证准备
load_dotenv()
env_vars = os.environ.copy()
if "ANTHROPIC_AUTH_TOKEN" in os.environ and "ANTHROPIC_API_KEY" not in os.environ:
        env_vars["ANTHROPIC_API_KEY"] = os.environ["ANTHROPIC_AUTH_TOKEN"]


class PlayGroundAgent:

    def __init__(self):
        self.options = ClaudeAgentOptions(allowed_tools=[
            "Read", "Glob", "Grep", "AskUserQuestion"
        ])
    
    async def query_run(self, user_query: str):
        async for message in query(prompt=user_query, options=self.options):  
            print(message)


agent = PlayGroundAgent()
message = asyncio.run(agent.query_run(user_query="你好, 我想完成一个基于claude agent sdk python的chat bot, 我需要怎么做"))
print(message)
