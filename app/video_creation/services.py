from typing import AsyncGenerator, Optional, Dict, Any
from pathlib import Path
import json
import re

from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.skills import Skills, LocalSkills
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
                    "base_url": "https://open.bigmodel.cn/api/anthropic",
                    "auth_token": "0fa78a5665bf4201953e85fb91a79a57.zY0dvOkueFu4nG1m"
                }
            ),
            skills=Skills(loaders=[
                LocalSkills(Path(__file__).parent.parent / "agentic" / "skills")
            ]),
            markdown=True,
            instructions=[
                "你是一个专业的短视频脚本创作助手。",
                "请严格遵循以下输出结构：",
                "1. 在开始回答前，先进行思考和分析。**必须**将所有的分析过程、要查找的信息、决策逻辑等包裹在 `<think>` 和 `</think>` 标签中。",
                "   例如：`<think>用户想做xxx脚本，我需要先调用工具...分析文章内容...决定使用A类模板...</think>`",
                "2. 最终的视频脚本内容，必须包裹在 `video-script` 语言代码块中。",
                "   例如：",
                "   ```video-script",
                "   ## [A]类脚本：标题...",
                "   ...",
                "   ```",
                "3. 除了脚本卡片外，你可以提供简短的开场白或总结，但不要重复`<think>`中的内容。",
                "4. 确保脚本内的格式（如分镜、话术）清晰规划。"
            ]
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
            # 使用 stream=True 获取生成器
            # 注意：当 stream=True 时，arun 返回一个 async generator，不需要 await
            response_stream = self.agent.arun(
                message,
                session_id=str(session_id),
                stream=True
            )
            
            # 4. 迭代流式响应
            async for chunk in response_stream:
                if hasattr(chunk, "content") and chunk.content:
                   content_chunk = chunk.content
                   assistant_content += content_chunk
                   yield {
                       "type": "text",
                       "content": content_chunk,
                       "metadata": {}
                   }
                
                # 处理工具调用信息（如果有）
                # 兼容不同版本的 agno/phidata，检查 tools 或 tool_calls
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
                         yield {
                            "type": "tool_call",
                            "content": "",
                            "metadata": {
                                "tool_name": tool_name,
                                "params": getattr(tool, 'arguments', {}) if not isinstance(tool, dict) else tool.get("arguments", {})
                            }
                        }

            # 5. 保存 assistant 消息到数据库
            message_metadata["streaming_status"] = "completed"
            assistant_message = VideoCreationMessage(
                session_id=session_id,
                role=MessageRole.ASSISTANT,
                content=assistant_content,
                message_metadata=message_metadata
            )
            db.add(assistant_message)
            # 必须 flush 以获取 ID，用于关联脚本
            await db.flush()
            
            # 6. 尝试解析并保存生成的脚本
            try:
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
        从 assistant 响应中提取脚本内容
        
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
