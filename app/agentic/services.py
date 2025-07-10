from typing import List
from fastapi import UploadFile
from agno.media import Image

from app.agentic.agents.evidence_classifier import EvidenceClassifier, Results
from app.integrations.cos import COSService

async def classify_evidence(files: List[UploadFile]) -> Results:
    """
    Uploads files to COS, then classifies them.
    """
    cos_service = COSService()
    
    # 上传文件并获取URL
    uploaded_images = []
    for file in files:
        file_content = await file.read()
        # COSService.upload_file 需要一个文件对象
        import io
        file_obj = io.BytesIO(file_content)
        # 假设所有上传的都是图片，并存放在 'images' 文件夹
        file_url = cos_service.upload_file(file_obj, file.filename, folder='images')
        uploaded_images.append(Image(url=file_url))

    evidence_classifier = EvidenceClassifier()
    
    # 自动组装 messages
    message_parts = ["请对以下证据进行分类："]
    for i, img in enumerate(uploaded_images):
        message_parts.append(f"{i+1}. file_url: {img.url}")
    messages = "\n".join(message_parts)

    response = evidence_classifier.agent.run(
        messages,
        images=uploaded_images
    )
    return response.content