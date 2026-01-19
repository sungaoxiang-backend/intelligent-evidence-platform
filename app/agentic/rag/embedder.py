from agno.knowledge.embedder.openai import OpenAIEmbedder
from app.core.config import settings

def get_qwen_embedder():
    return OpenAIEmbedder(
        id=settings.QWEN_OPENAI_EMBEDDER_MODEL,
        api_key=settings.QWEN_API_KEY,
        base_url=settings.QWEN_BASE_URL,
        dimensions=1536
    )

qwen_embedder = get_qwen_embedder()