from typing import List, Callable, Awaitable
from fastapi import UploadFile
from agno.media import Image

from app.agentic.agents.evidence_classifier import EvidenceClassifier, EvidenceClassifiResults
from app.integrations.cos import COSService

async def classify_evidence(
    files: List[UploadFile], 
    send_progress: Callable[[dict], Awaitable[None]] = None
) -> EvidenceClassifiResults:
    """
    Uploads files to COS, then classifies them, sending progress updates if a callback is provided.
    """
    async def no_op(data): #  An async no-op function
        pass

    if send_progress is None:
        send_progress = no_op

    cos_service = COSService()
    
    # 上传文件并获取URL
    uploaded_images = []
    for i, file in enumerate(files):
        await send_progress({"status": "uploading", "file_index": i, "total_files": len(files), "filename": file.filename})
        file_content = await file.read()
        # COSService.upload_file 需要一个文件对象
        import io
        file_obj = io.BytesIO(file_content)
        # 假设所有上传的都是图片，并存放在 'images' 文件夹
        file_url = cos_service.upload_file(file_obj, file.filename, folder='images')
        uploaded_images.append(Image(url=file_url))
        await send_progress({"status": "uploaded", "file_index": i, "total_files": len(files), "file_url": file_url})

    await send_progress({"status": "classifying", "message": "Starting evidence classification..."})
    evidence_classifier = EvidenceClassifier()
    
    # 自动组装 messages
    message_parts = ["请对以下证据进行分类："]
    for i, img in enumerate(uploaded_images):
        message_parts.append(f"{i+1}. file_url: {img.url}")
    messages = "\n".join(message_parts)

    response = await evidence_classifier.agent.arun(
        messages,
        images=uploaded_images
    )
    
    result = response.content
    await send_progress({"status": "completed", "result": result.model_dump()})

    return result