from pathlib import Path
from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.skills import Skills, LocalSkills
from agno.tools.shell import ShellTools

agent = Agent(
    model=Claude(
        "claude-sonnet-4-5-20250929",
        client_params={
            "base_url": "https://open.bigmodel.cn/api/anthropic",
            "auth_token": "0fa78a5665bf4201953e85fb91a79a57.zY0dvOkueFu4nG1m"
        }
    ),
    skills=Skills(loaders=[LocalSkills(Path(__file__).parent.parent / "skills")]),
    tools=[ShellTools()],
    markdown=True,
)

if __name__ == "__main__":
    agent.run(
        input="请用本地最新的RSS文章，制作一个视频脚本。",
        debug_mode=True,
    )
