"""
Case Analysis Agent - 基于 Claude Agent SDK 的案件分析智能体

使用 Claude Agent SDK 分析案件信息，生成结构化的法律论证报告。
"""

import os
import json
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from loguru import logger

from app.core.config import settings
from app.cases.schemas import LegalReport


def load_prompt_from_file() -> str:
    """从 analysis_agent_prompt.md 加载系统提示词"""
    prompt_path = Path(__file__).parent.parent.parent / "cases" / "analysis_agent_prompt.md"
    if prompt_path.exists():
        return prompt_path.read_text(encoding="utf-8")
    else:
        logger.warning(f"Prompt file not found: {prompt_path}")
        return ""


def get_legal_report_schema() -> str:
    """获取 LegalReport 的 JSON Schema 描述"""
    schema = LegalReport.model_json_schema()
    return json.dumps(schema, ensure_ascii=False, indent=2)


class CaseAnalysisAgent:
    """
    基于 Claude Agent SDK 的案件分析智能体
    
    负责：
    1. 接收案件信息和提交记录列表
    2. 调用 Claude 进行分析
    3. 生成结构化的 LegalReport 输出
    """
    
    def __init__(self):
        """初始化 Agent"""
        self.system_prompt = load_prompt_from_file()
        self.model = settings.ANTHROPIC_MODEL
        self._client = None
        
    @property
    def client(self):
        """延迟初始化 Claude SDK Client"""
        if self._client is None:
            try:
                from claude_agent_sdk import ClaudeSDKClient
                
                # 使用私有认证方式
                self._client = ClaudeSDKClient(
                    auth_token=settings.ANTHROPIC_AUTH_TOKEN,
                    base_url=settings.ANTHROPIC_BASE_URL,
                    model=self.model
                )
                logger.info(f"Claude SDK Client 初始化成功，模型: {self.model}")
            except ImportError:
                logger.error("claude-agent-sdk 未安装，请运行: uv add claude-agent-sdk")
                raise
            except Exception as e:
                logger.error(f"初始化 Claude SDK Client 失败: {e}")
                raise
        return self._client
    
    def _build_case_context(
        self,
        case_info: Dict[str, Any],
        commits: List[Dict[str, Any]]
    ) -> str:
        """
        构建案件分析的上下文信息
        
        Args:
            case_info: 案件基本信息
            commits: 提交记录列表
            
        Returns:
            格式化的上下文字符串
        """
        context_parts = []
        
        # 1. 案件基本信息
        context_parts.append("## 案件基本信息")
        context_parts.append(f"- 案件ID: {case_info.get('id', 'N/A')}")
        context_parts.append(f"- 案件类型: {case_info.get('case_type', 'N/A')}")
        context_parts.append(f"- 欠款金额: ¥{case_info.get('loan_amount', 0):,.2f}")
        context_parts.append(f"- 借款日期: {case_info.get('loan_date', 'N/A')}")
        context_parts.append(f"- 管辖法院: {case_info.get('court_name', '待定')}")
        context_parts.append(f"- 案件描述: {case_info.get('description', '无')}")
        
        # 2. 当事人信息
        parties = case_info.get('parties', [])
        if parties:
            context_parts.append("\n## 当事人信息")
            for party in parties:
                role = "原告（债权人）" if party.get('party_role') == 'creditor' else "被告（债务人）"
                context_parts.append(f"\n### {role}")
                context_parts.append(f"- 名称: {party.get('party_name', 'N/A')}")
                context_parts.append(f"- 类型: {party.get('party_type', 'N/A')}")
                if party.get('name'):
                    context_parts.append(f"- 姓名/法定代表人: {party.get('name')}")
                if party.get('company_name'):
                    context_parts.append(f"- 公司/个体工商户名称: {party.get('company_name')}")
                if party.get('address'):
                    context_parts.append(f"- 地址: {party.get('address')}")
                if party.get('phone'):
                    context_parts.append(f"- 联系电话: {party.get('phone')}")
        
        # 3. 案情陈述和材料（从 commits 中提取）
        if commits:
            context_parts.append("\n## 案情陈述与材料")
            context_parts.append(f"共有 {len(commits)} 条提交记录\n")
            
            for i, commit in enumerate(commits, 1):
                context_parts.append(f"### 提交记录 #{commit.get('id', i)}")
                context_parts.append(f"- 提交时间: {commit.get('created_at', 'N/A')}")
                
                statement = commit.get('statement')
                if statement:
                    context_parts.append(f"- 用户陈述:\n  > {statement}")
                
                materials = commit.get('materials', [])
                if materials:
                    context_parts.append(f"- 相关材料: {len(materials)} 份")
                    for mat in materials:
                        mat_name = mat.get('name', mat.get('file_name', '未知材料'))
                        mat_url = mat.get('url', '')
                        context_parts.append(f"  - {mat_name}")
                        if mat_url:
                            context_parts.append(f"    URL: {mat_url}")
                
                context_parts.append("")
        
        return "\n".join(context_parts)
    
    def _build_analysis_prompt(self, case_context: str) -> str:
        """
        构建分析请求的完整提示词
        
        Args:
            case_context: 案件上下文信息
            
        Returns:
            完整的分析提示词
        """
        schema_info = get_legal_report_schema()
        
        prompt = f"""
请分析以下案件信息，并生成一份完整的案件论证报告。

{case_context}

---

## 核心原则（CRITICAL）

1. **事实来源严格限制**：你必须且只能依据上述【案情陈述与材料】部分的内容进行事实认定。
2. **忽略未验证信息**：【案件基本信息】和【当事人信息】仅作为背景参考。如果这些信息在【案情陈述与材料】中没有对应的陈述或证据支持，请勿直接采信。即：事实必须来自用户的明确陈述或提交的证据材料。
3. **保持客观**：如果在提交记录中未找到必要信息（如未提及对方姓名），请在报告对应字段填写"未知"或根据现有材料如实描述，不要编造，也不要直接使用背景信息填充。

## 输出要求

请严格按照以下 JSON Schema 格式输出报告：

```json
{schema_info}
```

## 分析要求

1. **结构化输出**：针对案由、当事人、管辖、诉求、权利义务过程等每个论点，严格填充观点、证据、法律、结论四个维度。
2. **观点维度**：仅从【提交记录】的用户陈述中提取。
3. **证据维度**：仅从【提交记录】的材料中分析提取。
4. **法律维度**：引用相关法律法规。
5. **结论维度**：综合给出高度盖然性评估。
6. **总结论**：必须包含一句话总结、置信度评估及3个关键追问。

请直接输出 JSON 格式的报告，不要包含其他内容。
"""
        return prompt
    
    async def analyze(
        self,
        case_id: int,
        case_info: Dict[str, Any],
        commits: List[Dict[str, Any]],
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        执行案件分析
        
        Args:
            case_id: 案件ID
            case_info: 案件基本信息
            commits: 提交记录列表
            progress_callback: 可选的进度回调函数
            
        Returns:
            LegalReport 格式的分析报告（字典形式）
            
        Raises:
            Exception: 分析失败时抛出异常
        """
        logger.info(f"开始分析案件 #{case_id}，共 {len(commits)} 条提交记录")
        
        if progress_callback:
            await progress_callback({
                "status": "processing",
                "message": "正在构建分析上下文...",
                "progress": 10
            })
        
        # 1. 构建案件上下文
        case_context = self._build_case_context(case_info, commits)
        
        if progress_callback:
            await progress_callback({
                "status": "processing",
                "message": "正在调用 Claude 进行分析...",
                "progress": 30
            })
        
        # 2. 构建分析提示词
        analysis_prompt = self._build_analysis_prompt(case_context)
        
        # 3. 调用 Claude 进行分析
        try:
            # 使用 Claude Agent SDK 进行分析
            response = await self._call_claude_agent(analysis_prompt, case_id, progress_callback)
            
            if progress_callback:
                await progress_callback({
                    "status": "processing",
                    "message": "正在解析分析结果...",
                    "progress": 80
                })
            
            # 4. 解析响应
            report_data = self._parse_response(response, case_id, case_info)
            
            if progress_callback:
                await progress_callback({
                    "status": "completed",
                    "message": "分析完成",
                    "progress": 100
                })
            
            logger.info(f"案件 #{case_id} 分析完成")
            return report_data
            
        except Exception as e:
            logger.error(f"案件 #{case_id} 分析失败: {e}")
            if progress_callback:
                await progress_callback({
                    "status": "failed",
                    "message": f"分析失败: {str(e)}",
                    "progress": 0
                })
            raise
    
    async def _call_claude_agent(
        self, 
        prompt: str, 
        case_id: int,
        progress_callback: Optional[callable] = None
    ) -> str:
        """
        调用 Claude Agent SDK 执行分析（使用 ClaudeSDKClient）
        
        Args:
            prompt: 分析提示词
            case_id: 案件ID (用于生成 session_id)
            
        Returns:
            Claude 的响应文本
        """
        try:
            from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
            from claude_agent_sdk.types import StreamEvent, ResultMessage
            
            # ⚠️ 重要：claude-agent-sdk 使用 ANTHROPIC_API_KEY 环境变量
            # 需要将我们的 ANTHROPIC_AUTH_TOKEN 临时映射过去
            original_api_key = os.environ.get('ANTHROPIC_API_KEY')
            env_vars = os.environ.copy()
            
            if settings.ANTHROPIC_AUTH_TOKEN:
                env_vars['ANTHROPIC_API_KEY'] = settings.ANTHROPIC_AUTH_TOKEN
                logger.info("已将 ANTHROPIC_AUTH_TOKEN 映射到 ANTHROPIC_API_KEY 环境变量")
            
            try:
                # 配置 Agent 选项（参照用户示例 tmp_app.py）
                # 关键：开启 include_partial_messages 以获取实时流
                agent_options_kwargs = {
                    "env": env_vars,
                    "system_prompt": self.system_prompt,
                    "max_turns": 1,
                    # ⚠️ 关键修正：开启部分消息，否则思考过程不会实时流式传输，看起来像卡住
                    "include_partial_messages": True,
                    # 设置合理的思考预算
                    "max_thinking_tokens": 8000,
                }
                
                options = ClaudeAgentOptions(**agent_options_kwargs)
                
                logger.info(f"调用 Claude SDK Client, 模型: {self.model}")
                
                # 使用ClaudeSDKClient
                async with ClaudeSDKClient(options) as client:
                    # 使用固定前缀方便追踪
                    session_id = f"case_analysis_{case_id}_{int(time.time())}"
                    logger.info(f"发送查询到 Claude，session_id: {session_id}")
                    
                    # 设置超时，防止永久卡死
                    await client.query(prompt, session_id=session_id)
                    
                    # 接收响应流
                    response_parts = []
                    event_count = 0
                    
                    # 导入所有可能的类型确保正确 isinstance
                    from claude_agent_sdk.types import (
                        StreamEvent, ResultMessage, SystemMessage, 
                        UserMessage, AssistantMessage
                    )
                    
                    async for msg in client.receive_response():
                        event_count += 1
                        
                        # 1. 处理 SystemMessage (日志中显示的未知类型)
                        if isinstance(msg, SystemMessage):
                            logger.info(f"[Event #{event_count}] 收到 SystemMessage (初始化完成)")
                            continue

                        # 2. 处理流式事件
                        elif isinstance(msg, StreamEvent):
                            event = msg.event
                            event_type = event.get("type")
                            
                            # logging.debug(f"[Event #{event_count}] StreamEvent: {event_type}")
                            
                            if event_type == "content_block_start":
                                block_type = event.get("content_block", {}).get("type")
                                if block_type == "thinking":
                                    logger.info("  → 🤔 开始生成: thinking")
                                    if progress_callback:
                                        await progress_callback({
                                            "status": "processing",
                                            "message": "⚖️ AI正在进行深度法律思维推演...",
                                            "progress": 40
                                        })
                                elif block_type == "text":
                                    logger.info("  → 📝 开始生成: text")
                                    if progress_callback:
                                        await progress_callback({
                                            "status": "processing",
                                            "message": "📝 法律推理完成，正在起草详细报告...",
                                            "progress": 60
                                        })
                                
                            elif event_type == "content_block_delta":
                                delta = event.get("delta", {})
                                delta_type = delta.get("type")
                                
                                # 处理文本增量
                                if delta_type == "text_delta":
                                    text = delta.get("text", "")
                                    if text:
                                        response_parts.append(text)
                                        current_len = len(''.join(response_parts))
                                        # 每收集 100 字符打一次日志
                                        if current_len % 200 < len(text):
                                            logger.info(f"  → 📝 正在生成报告... (已累积 {current_len} 字符)")
                                            if progress_callback:
                                                # 估算进度：60% -> 95%
                                                # 假设平均报告长度 3000 字
                                                est_progress = min(95, 60 + int(current_len / 3000 * 35))
                                                await progress_callback({
                                                    "status": "processing",
                                                    "message": f"📝 正在撰写报告 (已生成 {current_len} 字)...",
                                                    "progress": est_progress
                                                })
                                
                                # 处理思考增量
                                elif delta_type == "thinking_delta":
                                    thinking = delta.get("thinking", "")
                                    if thinking and len(thinking) > 20: 
                                        logger.info(f"  → 💭 思考片段: {thinking[:50]}...")
                                        # 思考过程也可以微调进度，或者只是保持状态消息
                                        # 这里稍微增加一点 randomness 让进度条看起来活着，但不改变 message
                                        # 40% -> 55%
                                        # 这一步比较微妙，如果太频繁更新数据库不好，暂时只记录日志

                            elif event_type == "message_stop":
                                logger.info("  → 🛑 消息生成结束")

                        # 3. 处理结果消息（完成信号）
                        elif isinstance(msg, ResultMessage):
                            logger.info(f"[Event #{event_count}] ✅ 收到 ResultMessage，任务完成")
                            break
                        
                        # 4. 其他类型
                        else:
                            logger.info(f"[Event #{event_count}] 跳过消息类型: {type(msg).__name__}")
                    
                    response_text = ''.join(response_parts).strip()
                    
                    if not response_text:
                        logger.error(f"❌ 响应流结束但未收集到文本。总事件数: {event_count}")
                        # 尝试打印最后收到的几个部分诊断
                        raise ValueError("Claude SDK Client 返回了空内容")
                    
                    logger.info(f"✅ 获取分析报告成功，长度: {len(response_text)} 字符")
                    return response_text
                    
            finally:
                # 恢复原始环境变量
                if original_api_key is not None:
                    os.environ['ANTHROPIC_API_KEY'] = original_api_key
                elif 'ANTHROPIC_API_KEY' in os.environ:
                    del os.environ['ANTHROPIC_API_KEY']
            
        except ImportError as e:
            logger.error(f"claude-agent-sdk 未安装: {e}")
            raise ImportError("需要安装 claude-agent-sdk: uv add claude-agent-sdk")
        except Exception as e:
            logger.error(f"调用 Claude SDK Client 失败: {e}")
            raise
    
    def _parse_response(
        self,
        response: str,
        case_id: int,
        case_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        解析 Claude 的响应，提取 LegalReport 数据
        
        Args:
            response: Claude 的响应文本
            case_id: 案件ID
            case_info: 案件基本信息
            
        Returns:
            LegalReport 格式的字典
        """
        try:
            # 尝试直接解析 JSON
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()
            else:
                # 尝试找到 JSON 对象
                start_idx = response.find("{")
                end_idx = response.rfind("}")
                if start_idx != -1 and end_idx != -1:
                    json_str = response[start_idx:end_idx + 1]
                else:
                    json_str = response
            
            report_data = json.loads(json_str)
            
            # 确保必要字段存在
            report_data["case_id"] = str(case_id)
            if "case_title" not in report_data:
                # 根据案件类型生成标题
                case_type_map = {
                    "debt": "借款纠纷案",
                    "contract": "合同纠纷案"
                }
                case_type = case_info.get("case_type", "")
                title = case_type_map.get(case_type, "民事纠纷案")
                report_data["case_title"] = f"案件#{case_id} - {title}"
            
            # 验证报告格式
            LegalReport.model_validate(report_data)
            
            return report_data
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON 解析失败: {e}")
            logger.debug(f"原始响应: {response[:500]}...")
            raise ValueError(f"无法解析 Claude 响应为 JSON: {e}")
        except Exception as e:
            logger.error(f"报告格式验证失败: {e}")
            raise ValueError(f"报告格式不符合 LegalReport schema: {e}")


# 单例实例
case_analysis_agent = CaseAnalysisAgent()


async def run_case_analysis(
    case_id: int,
    case_info: Dict[str, Any],
    commits: List[Dict[str, Any]],
    progress_callback: Optional[callable] = None
) -> Dict[str, Any]:
    """
    执行案件分析的快捷函数
    
    Args:
        case_id: 案件ID
        case_info: 案件基本信息
        commits: 提交记录列表
        progress_callback: 可选的进度回调函数
        
    Returns:
        LegalReport 格式的分析报告
    """
    return await case_analysis_agent.analyze(
        case_id=case_id,
        case_info=case_info,
        commits=commits,
        progress_callback=progress_callback
    )
