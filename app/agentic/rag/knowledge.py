from pathlib import Path
from agno.knowledge.markdown import MarkdownKnowledgeBase
from agno.vectordb.pgvector import PgVector, SearchType
from app.core.config import settings
from app.agentic.rag.embedder import get_qwen_embedder
from typing import Optional

knowledge_base_dir = Path(__file__).parent.resolve() / "docs"

# 延迟初始化的知识库实例
_knowledge_instance: Optional[MarkdownKnowledgeBase] = None

def create_knowledge_base():
    # 在函数内部获取embedder，避免循环导入
    qwen_embedder = get_qwen_embedder()
    # 将PostgresDsn对象转换为字符串并替换异步驱动为同步驱动
    db_url = str(settings.SQLALCHEMY_DATABASE_URI).replace('postgresql+asyncpg', 'postgresql')
    return MarkdownKnowledgeBase(
        path=str(knowledge_base_dir),
        vector_db=PgVector(
            table_name="evidence_classification_kb",
            db_url=db_url,
            embedder=qwen_embedder,
            search_type=SearchType.hybrid
        )
    )

def get_knowledge() -> MarkdownKnowledgeBase:
    """延迟初始化知识库，避免在模块导入时连接数据库"""
    global _knowledge_instance
    if _knowledge_instance is None:
        _knowledge_instance = create_knowledge_base()
    return _knowledge_instance

# 为了向后兼容，提供一个延迟初始化的代理类
class _LazyKnowledge:
    """延迟初始化的知识库代理，避免在模块导入时连接数据库"""
    def __getattr__(self, name):
        return getattr(get_knowledge(), name)

# 导出 knowledge 对象，首次访问时会延迟初始化
knowledge = _LazyKnowledge()