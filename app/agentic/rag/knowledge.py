from pathlib import Path
from agno.knowledge.markdown import MarkdownKnowledgeBase
from agno.vectordb.pgvector import PgVector, SearchType
from app.core.config import settings
from app.agentic.rag.embedder import get_qwen_embedder

knowledge_base_dir = Path(__file__).parent.resolve()

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

knowledge = create_knowledge_base()