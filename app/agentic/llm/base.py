from agno.models.openai.like import OpenAILike, OpenAIChat
from app.core.config import settings
from agno.models.deepseek import DeepSeek

qwen_chat_model = OpenAILike(
    id=settings.QWEN_CHAT_MODEL,
    api_key=settings.QWEN_API_KEY,
    base_url=settings.QWEN_BASE_URL,
)

qwen_muti_model = OpenAILike(
    id=settings.QWEN_MUTI_MODEL,
    api_key=settings.QWEN_API_KEY,
    base_url=settings.QWEN_BASE_URL,
)

openai_image_model = OpenAIChat(
        id=settings.OPENAI_IMAGE_MODEL,
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
    )

deepseek_reasoner_model = DeepSeek(
    id=settings.DEEPSEEK_REASONER_MODEL,
    api_key=settings.DEEPSEEK_API_KEY,
    base_url=settings.DEEPSEEK_BASE_URL,
)
