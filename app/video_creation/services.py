from typing import AsyncGenerator, Optional, Dict, Any
from pathlib import Path
import json
import re

from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.skills import Skills, LocalSkills
from agno.tools.shell import ShellTools
from sqlalchemy.ext.asyncio import AsyncSession

from app.video_creation.models import VideoCreationMessage, MessageRole, VideoScript, ScriptType
from app.video_creation.schemas import StreamChunk, QuickAction


class VideoCreationService:
    """视频创作服务 - 使用 agno 原生流式支持"""

    def __init__(self):
        # 初始化 video_script_maker agent
        self.agent = Agent(
            model=Claude(
                "claude-sonnet-4-5-20250929",
                client_params={
                    "base_url": "https://api.minimaxi.com/anthropic",
                    "auth_token": "sk-cp-mKpCCoXQTZSt1H_0RmfAltGjQ03m7ceBacAGJJDqID2bEXTvgAtAtVtjTS5FkA562ZV8Dq4iaN8j6QLrfa1f9DRx0G8tCoVJwE-WGmmOviYsInX3VPvxXrk"
                }
            ),
            skills=Skills(loaders=[
                LocalSkills(Path(__file__).parent.parent / "agentic" / "skills")
            ]),
            tools=[ShellTools()],
            markdown=True,
            instructions=[
                "你是一个专业的短视频脚本创作助手，负责协调使用两个技能：",
                "",
                "## 技能说明",
                "",
                "### 1. rss-article-retriever（脚本执行型）",
                "- 使用 Shell 工具调用 Python 脚本获取文章",
                "- `fetch_rss.py`: 获取文章列表",
                "- `fetch_content.py`: 获取文章详细内容",
                "",
                "### 2. video-script-generator（LLM 生成型）",
                "- **重要：这是一个纯 LLM 技能，没有可执行脚本**",
                "- 你需要使用 `get_skill_instructions` 获取技能指令",
                "- 然后根据指令自己生成视频脚本",
                "- **不要尝试调用 generate.py 或其他脚本 - 它们不存在**",
                "",
                "## 工作流程",
                "",
                "当用户请求涉及 RSS 文章和视频脚本时：",
                "1. 调用 rss-article-retriever 脚本获取文章",
                "2. 使用 `get_skill_instructions('video-script-generator')` 获取脚本生成指令",
                "3. 根据获取的指令，自己分析文章内容并生成视频脚本",
                "4. 输出结果时使用 `<skill-output type=\"video-script\">` 格式",
                "",
                "## 输出规则（极其重要）",
                "",
                "**你的输出必须极简：**",
                "- 视频脚本：只输出 `<skill-output type=\"video-script\">{JSON}</skill-output>`",
                "- **不要**在 skill-output 后面添加任何说明、总结、建议",
                "- **不要**输出什么「脚本亮点」「适用场景」「使用建议」等额外内容",
                "- **不要**重复脚本内容，JSON 里已经包含了所有信息",
                "- 前端会自动解析 JSON 并渲染成漂亮的卡片，你不需要额外解释",
                "",
                "**正确示例：**",
                "```",
                "<skill-output type=\"video-script\" schema-version=\"1.0.0\">",
                "{\"version\":\"1.0.0\",\"script_type\":\"A\",\"final_script\":{...}}",
                "</skill-output>",
                "```",
                "",
                "**错误示例（不要这样做）：**",
                "```",
                "<skill-output>...</skill-output>",
                "",
                "## 脚本说明",
                "这是一个关于...",
                "```",
                "",
                "## 错误处理",
                "",
                "如果获取文章内容时收到错误响应（包含 `error` 字段）：",
                "- 立即停止后续处理",
                "- 简短报告错误：「获取文章失败：[原因]」",
                "- 不要尝试用空内容生成视频脚本",
                "",
                "## 重要提示",
                "",
                "- video-script-generator 没有脚本文件，不要尝试 ls 或 run_shell_command",
                "- 输出必须简洁，只有 skill-output 标签，没有额外文字"
            ],
            debug_mode=True
        )

    async def stream_chat(
        self,
        session_id: int,
        message: str,
        db: AsyncSession
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        使用 agno 原生流式输出处理用户消息

        Args:
            session_id: 会话 ID
            message: 用户消息内容
            db: 数据库会话

        Yields:
            dict: StreamChunk 格式的事件数据
        """
        # 1. 保存用户消息到数据库
        user_message = VideoCreationMessage(
            session_id=session_id,
            role=MessageRole.USER,
            content=message,
            message_metadata={}
        )
        db.add(user_message)
        await db.commit()
        await db.refresh(user_message)

        # 2. 准备 assistant 消息的累积内容和元数据
        assistant_content = ""
        message_metadata: Dict[str, Any] = {
            "tool_calls": [],
            "skill_hits": [],
            "streaming_status": "running"
        }

        try:
            # 3. 使用 agno 的 run 方法进行流式输出
            import logging
            import time
            
            logger = logging.getLogger(__name__)
            logger.info(f"[stream_chat] Starting stream for session {session_id}, message: {message[:100]}...")
            
            response_stream = self.agent.arun(
                message,
                session_id=str(session_id),
                stream=True
            )
            
            # 发送初始状态，让前端知道处理开始了
            yield {
                "type": "status",
                "content": "正在处理请求...",
                "metadata": {"status": "processing"}
            }

            # 4. 迭代流式响应
            chunk_count = 0
            last_heartbeat = time.time()
            
            async for chunk in response_stream:
                chunk_count += 1
                logger.debug(f"[stream_chat] Received chunk #{chunk_count}: type={type(chunk)}, has_content={hasattr(chunk, 'content') and bool(chunk.content)}")
                
                # 每 10 秒发送一次心跳，让前端知道还在处理中
                current_time = time.time()
                if current_time - last_heartbeat > 10:
                    yield {
                        "type": "heartbeat",
                        "content": "",
                        "metadata": {"status": "processing", "chunks_received": chunk_count}
                    }
                    last_heartbeat = current_time
                
                if hasattr(chunk, "content") and chunk.content:
                   content_chunk = chunk.content
                   assistant_content += content_chunk
                   logger.debug(f"[stream_chat] Yielding content chunk: {len(content_chunk)} chars")
                   yield {
                       "type": "text",
                       "content": content_chunk,
                       "metadata": {}
                   }

                # 处理工具调用信息（如果有）
                current_tools = getattr(chunk, "tools", None) or getattr(chunk, "tool_calls", None)

                if current_tools:
                    for tool in current_tools:
                         # 尝试多种方式获取工具名称
                         tool_name = "unknown"

                         # Check if tool is a dictionary
                         if isinstance(tool, dict):
                             tool_name = tool.get("name") or \
                                         tool.get("function", {}).get("name") or \
                                         "unknown"
                         else:
                             # Check attributes for object
                             tool_name = getattr(tool, 'tool_name', None) or \
                                         getattr(tool, 'name', None) or \
                                         getattr(getattr(tool, 'function', None), 'name', None) or \
                                         "unknown"

                         message_metadata["tool_calls"].append({
                            "name": tool_name,
                            "status": "running",
                            "params": getattr(tool, 'arguments', {}) if not isinstance(tool, dict) else tool.get("arguments", {})
                        })
                         logger.info(f"[stream_chat] Tool call detected: {tool_name}")
                         yield {
                            "type": "tool_call",
                            "content": "",
                            "metadata": {
                                "tool_name": tool_name,
                                "params": getattr(tool, 'arguments', {}) if not isinstance(tool, dict) else tool.get("arguments", {})
                            }
                        }
            
            logger.info(f"[stream_chat] Stream completed. Total chunks: {chunk_count}, content length: {len(assistant_content)}")

            # 5. 保存 assistant 消息到数据库
            message_metadata["streaming_status"] = "completed"
            assistant_message = VideoCreationMessage(
                session_id=session_id,
                role=MessageRole.ASSISTANT,
                content=assistant_content,
                message_metadata=message_metadata
            )
            db.add(assistant_message)
            await db.flush()

            # 6. 尝试解析并保存生成的脚本（支持新旧两种格式）
            try:
                # 优先尝试新的 JSON 格式
                scripts = self._extract_structured_scripts(assistant_content, session_id, assistant_message.id)

                # 如果新格式没有结果，回退到旧的 Markdown 格式
                if not scripts:
                    scripts = self._extract_scripts(assistant_content, session_id, assistant_message.id)

                for script in scripts:
                    db.add(script)
            except Exception as e:
                print(f"Error extracting scripts: {e}")

            await db.commit()
            await db.refresh(assistant_message)

            # 7. 发送完成事件
            yield {
                "type": "done",
                "content": "",
                "metadata": {"message_id": assistant_message.id}
            }

        except Exception as e:
            message_metadata["streaming_status"] = "error"
            yield {
                "type": "error",
                "content": str(e),
                "metadata": {}
            }

    def _extract_scripts(
        self,
        content: str,
        session_id: int,
        message_id: int
    ) -> list:
        """
        从 assistant 响应中提取脚本内容（旧 Markdown 格式）

        Args:
            content: assistant 消息内容
            session_id: 会话 ID
            message_id: 消息 ID

        Returns:
            list: VideoScript 对象列表
        """
        scripts = []

        # 正则匹配脚本类型（A/B/C）
        # 匹配格式: ## [A/B/C]类脚本：xxx
        pattern = r'##\s*\[([ABC])\]类脚本[：:]\s*(.+?)(?=##|$)'
        matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)

        for match in matches:
            script_type_letter = match.group(1)
            script_content = match.group(2).strip()

            # 映射类型
            type_mapping = {
                "A": ScriptType.A_CASE,
                "B": ScriptType.B_MISCONCEPTION,
                "C": ScriptType.C_GAP
            }

            script_type = type_mapping.get(script_type_letter)
            if not script_type:
                continue

            # 尝试提取源文章 URL
            source_url = None
            url_match = re.search(r'\*\*原文来源\*\*:\s*\[.+?\]\((https?://[^\)]+)\)', script_content)
            if url_match:
                source_url = url_match.group(1)

            script = VideoScript(
                session_id=session_id,
                message_id=message_id,
                script_type=script_type,
                script_content=script_content,
                source_article_url=source_url
            )
            scripts.append(script)

        return scripts

    def _extract_structured_scripts(
        self,
        content: str,
        session_id: int,
        message_id: int
    ) -> list:
        """
        从新的 JSON 格式输出中提取脚本
        新格式: <skill-output type="video-script">{"version": "1.0.0", ...}</skill-output>
        """
        scripts = []

        # 1. 提取 <skill-output> 标记内的 JSON
        pattern = r'<skill-output type="video-script"[^>]*>([\s\S]*?)</skill-output>'
        match = re.search(pattern, content)

        if not match:
            return []

        # 2. 解析 JSON
        try:
            json_content = match.group(1).strip()
            data = json.loads(json_content)
        except json.JSONDecodeError:
            return []

        # 3. 提取脚本数据
        script_type_letter = data.get("script_type", "A")
        final_script = data.get("final_script", {})

        type_mapping = {
            "A": ScriptType.A_CASE,
            "B": ScriptType.B_MISCONCEPTION,
            "C": ScriptType.C_GAP
        }

        script_type = type_mapping.get(script_type_letter)
        if not script_type:
            return []

        # 4. 构建 VideoScript 对象
        script = VideoScript(
            session_id=session_id,
            message_id=message_id,
            script_type=script_type,
            script_content=json.dumps(final_script, ensure_ascii=False),
            source_article_url=None
        )
        scripts.append(script)

        return scripts

    def get_quick_actions(self) -> list[QuickAction]:
        """
        获取快捷指令列表

        Returns:
            list: QuickAction 对象列表
        """
        return [
            QuickAction(
                id="latest_rss",
                label="最新文章脚本",
                prompt="请用本地最新的 RSS 文章制作视频脚本",
                description="基于最新1篇文章生成",
                icon="Zap"
            ),
            QuickAction(
                id="latest_3_rss",
                label="最新3篇脚本",
                prompt="请用本地最新的 3 篇 RSS 文章制作视频脚本",
                description="基于最新3篇文章生成",
                icon="Layers"
            ),
            QuickAction(
                id="specific_source",
                label="指定来源脚本",
                prompt="请用【输入来源】的最新文章制作视频脚本",
                description="指定特定来源(如公众号)的文章",
                icon="Search"
            )
        ]
