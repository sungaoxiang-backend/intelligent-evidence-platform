from pathlib import Path
from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.skills import Skills, LocalSkills
from agno.tools.shell import ShellTools

agent = Agent(
    model=Claude(
        "claude-sonnet-4-5-20250929",
        client_params={
            "base_url": "https://api.minimaxi.com/anthropic",
            "auth_token": "sk-cp-mKpCCoXQTZSt1H_0RmfAltGjQ03m7ceBacAGJJDqID2bEXTvgAtAtVtjTS5FkA562ZV8Dq4iaN8j6QLrfa1f9DRx0G8tCoVJwE-WGmmOviYsInX3VPvxXrk"
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
