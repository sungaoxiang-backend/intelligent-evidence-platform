from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from claude_agent_sdk import query as claude_query
from claude_agent_sdk.types import AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock

from app.core.config import settings


@dataclass
class AgentRunResult:
    output: str
    session_id: Optional[str] = None
    total_cost_usd: Optional[float] = None
    raw: Optional[dict[str, Any]] = None


class SkillManagementClaudeAgent:
    """
    A dedicated Claude Agent SDK-powered agent for skill management debugging.

    This is intentionally separate from legacy Agno-based agents.
    """

    async def run(
        self,
        *,
        user_message: str,
        system_prompt: str,
        model: str | None = None,
        max_turns: int = 1,
    ) -> AgentRunResult:
        options = ClaudeAgentOptions(
            system_prompt=system_prompt,
            tools=[],
            max_turns=max_turns,
            model=model,
            env={
                # Claude Code CLI expects ANTHROPIC_API_KEY
                "ANTHROPIC_API_KEY": settings.ANTHROPIC_AUTH_TOKEN,
                **({"ANTHROPIC_BASE_URL": settings.ANTHROPIC_BASE_URL} if settings.ANTHROPIC_BASE_URL else {}),
            },
        )

        output_text_parts: list[str] = []
        result_payload: dict | None = None

        async for msg in claude_query(prompt=user_message, options=options):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        output_text_parts.append(block.text)
            elif isinstance(msg, ResultMessage):
                result_payload = {
                    "session_id": msg.session_id,
                    "total_cost_usd": msg.total_cost_usd,
                    "result": msg.result,
                    "is_error": msg.is_error,
                    "usage": msg.usage,
                }
                if msg.result:
                    output_text_parts = [msg.result]

        output = "\n".join([t for t in output_text_parts if t]).strip()
        return AgentRunResult(
            output=output,
            session_id=(result_payload or {}).get("session_id"),
            total_cost_usd=(result_payload or {}).get("total_cost_usd"),
            raw=result_payload,
        )

