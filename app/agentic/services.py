from typing import List, Callable, Awaitable
from fastapi import UploadFile
from agno.media import Image

from app.agentic.agents.evidence_classifier import EvidenceClassifier, EvidenceClassifiResults
from app.agentic.agents.evidence_features_extractor import EvidenceFeaturesExtractor, EvidenceType, EvidenceExtractionResults
from app.integrations.cos import COSService
from sqlalchemy.ext.asyncio import AsyncSession
from app.evidences.models import Evidence
from app.db.session import SessionLocal
from sqlalchemy import select


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


async def classify_evidence_by_urls(
    urls: List[str],
    send_progress: Callable[[dict], Awaitable[None]] = None,
    db: AsyncSession = None
) -> EvidenceClassifiResults:
    async def no_op(data): pass
    if send_progress is None:
        send_progress = no_op

    images = [Image(url=url) for url in urls]
    await send_progress({"status": "classifying", "message": "Starting evidence classification by urls..."})
    evidence_classifier = EvidenceClassifier()
    message_parts = ["请对以下证据进行分类："]
    for i, img in enumerate(images):
        message_parts.append(f"{i+1}. file_url: {img.url}")
    messages = "\n".join(message_parts)
    response = await evidence_classifier.agent.arun(
        messages,
        images=images
    )
    result = response.content
    await send_progress({"status": "completed", "result": result.model_dump()})

    # 更新数据库individual_features
    if db is not None and result and result.results:
        for r in result.results:
            # 查找Evidence
            q = await db.execute(select(Evidence).where(Evidence.file_url == r.image_url))
            evidence = q.scalars().first()
            if evidence:
                evidence.individual_features = {
                    "evidence_type": r.evidence_type,
                    "confidence": r.confidence,
                    "reasoning": r.reasoning
                }
                db.add(evidence)
        await db.commit()
    return result


async def extract_evidence_features(
    urls: List[str],
    evidence_type: str,
    consider_correlations: bool = False,
    send_progress: Callable[[dict], Awaitable[None]] = None,
    db: AsyncSession = None
) -> EvidenceExtractionResults:
    """
    通过URL提取证据特征信息
    """
    async def no_op(data): pass
    if send_progress is None:
        send_progress = no_op

    try:
        evidence_type_enum = EvidenceType(evidence_type)
    except ValueError:
        raise ValueError(f"无效的证据类型: {evidence_type}")

    images = [Image(url=url) for url in urls]
    await send_progress({"status": "extracting", "message": "开始提取证据特征..."})
    
    extractor = EvidenceFeaturesExtractor()
    
    # 构建消息
    message_parts = ["请从以下证据图片中提取关键信息:"]
    for i, img in enumerate(images):
        message_parts.append(f"{i+1}. file_url: {img.url}")
    messages = "\n".join(message_parts)
    
    response = await extractor.agent.arun(
        messages,
        images=images
    )
    result = response.content
    await send_progress({"status": "completed", "result": result.model_dump()})

    # 更新数据库individual_features
    if db is not None and result and result.results:
        # 为每个URL更新对应的证据记录
        for url in urls:
            # 查找Evidence
            q = await db.execute(select(Evidence).where(Evidence.file_url == url))
            evidence = q.scalars().first()
            if evidence:
                # 收集该URL相关的提取结果
                url_features = []
                for slot_result in result.results:
                    if url in slot_result.from_urls:
                        url_features.append({
                            "slot_name": slot_result.slot_name,
                            "slot_value": slot_result.slot_value,
                            "confidence": slot_result.confidence,
                            "reasoning": slot_result.reasoning,
                            "from_urls": slot_result.from_urls
                        })
                
                if url_features:
                    evidence.individual_features = {
                        "evidence_type": evidence_type,
                        "extracted_slots": url_features,
                        "consider_correlations": consider_correlations
                    }
                    db.add(evidence)
        await db.commit()
    
    return result


async def extract_evidence_features_by_upload(
    files: List[UploadFile],
    evidence_type: str,
    consider_correlations: bool = False,
    send_progress: Callable[[dict], Awaitable[None]] = None
) -> EvidenceExtractionResults:
    """
    上传文件并提取证据特征信息
    """
    async def no_op(data): pass
    if send_progress is None:
        send_progress = no_op

    try:
        evidence_type_enum = EvidenceType(evidence_type)
    except ValueError:
        raise ValueError(f"无效的证据类型: {evidence_type}")

    cos_service = COSService()
    
    # 上传文件并获取URL
    uploaded_images = []
    for i, file in enumerate(files):
        await send_progress({
            "status": "uploading", 
            "file_index": i, 
            "total_files": len(files), 
            "filename": file.filename
        })
        file_content = await file.read()
        import io
        file_obj = io.BytesIO(file_content)
        file_url = cos_service.upload_file(file_obj, file.filename, folder='images')
        uploaded_images.append(Image(url=file_url))
        await send_progress({
            "status": "uploaded", 
            "file_index": i, 
            "total_files": len(files), 
            "file_url": file_url
        })

    await send_progress({"status": "extracting", "message": "开始提取证据特征..."})
    
    extractor = EvidenceFeaturesExtractor()
    
    # 构建消息
    message_parts = ["请从以下证据图片中提取关键信息:"]
    for i, img in enumerate(uploaded_images):
        message_parts.append(f"{i+1}. file_url: {img.url}")
    messages = "\n".join(message_parts)
    
    response = await extractor.agent.arun(
        messages,
        images=uploaded_images
    )
    result = response.content
    await send_progress({"status": "completed", "result": result.model_dump()})

    return result