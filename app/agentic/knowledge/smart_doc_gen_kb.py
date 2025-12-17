from pathlib import Path
from agno.knowledge.markdown import MarkdownKnowledgeBase
from agno.vectordb.pgvector import PgVector, SearchType
from app.core.config import settings
from app.agentic.rag.embedder import get_qwen_embedder

# Define the path to the documents
kb_docs_dir = Path(__file__).parent / "docs" / "smart_doc_gen"

def get_smart_doc_gen_kb():
    """
    Creates and returns the Knowledge Base for Smart Document Generation.
    It uses PgVector to store embeddings of markdown files containing filling rules and examples.
    """
    # Get the embedder
    qwen_embedder = get_qwen_embedder()
    
    # Use synchronous driver for PgVector
    db_url = str(settings.SQLALCHEMY_DATABASE_URI).replace('postgresql+asyncpg', 'postgresql')
    
    return MarkdownKnowledgeBase(
        path=str(kb_docs_dir),
        vector_db=PgVector(
            table_name="smart_doc_gen_kb",
            db_url=db_url,
            embedder=qwen_embedder,
            search_type=SearchType.hybrid
        )
    )

# Singleton instance
smart_doc_gen_kb = get_smart_doc_gen_kb()
