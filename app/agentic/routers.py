from typing import List, Annotated
from fastapi import APIRouter, Depends, File, UploadFile, WebSocket, WebSocketDisconnect, HTTPException
from app.core.deps import DBSession, get_current_staff
from app.staffs.models import Staff
from app.agentic.services import (
    classify_evidence, 
    classify_evidence_by_urls,
    extract_evidence_features,
    extract_evidence_features_by_upload
)
from app.agentic.agents.evidence_classifier import EvidenceClassifiResults
from app.agentic.agents.evidence_features_extractor import EvidenceExtractionResults
from app.core.response import SingleResponse
import json
from app.agentic.schemas import (
    EvidenceClassificationByUrlsRequest,
    EvidenceFeatureExtractionByUrlsRequest
)

router = APIRouter()


@router.websocket("/ws/classify")
async def websocket_classify_evidence(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # The first message is expected to be a JSON with metadata (e.g., file count)
            # For simplicity, we'll just wait for files. The client will send binary data.
            data = await websocket.receive_bytes()
            file_name = f"temp_file_{id(data)}.jpg" # A temporary name
            
            # Create an UploadFile-like object
            from io import BytesIO
            upload_file = UploadFile(filename=file_name, file=BytesIO(data))

            # Use a callback to send data back through the websocket
            async def send_progress(update_data: dict):
                await websocket.send_json(update_data)

            # The service function now needs to accept the callback
            await classify_evidence([upload_file], send_progress)

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"An error occurred: {e}")
        await websocket.close(code=1011, reason=str(e))


@router.post("/classification", response_model=SingleResponse[EvidenceClassifiResults])
async def classify_evidence_endpoint(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    files: List[UploadFile] = File(...),
    ):
    """
    Classify evidence based on uploaded files.
    """
    # This endpoint can be kept for non-websocket clients or adapted.
    # For now, we focus on the WebSocket implementation.
    # Note: The original classify_evidence needs to be adapted or a new one created
    # to support both HTTP and WebSocket. For now, we assume it's adapted.
    async def dummy_callback(data):
        pass
    result = await classify_evidence(files, dummy_callback) # Dummy callback for HTTP
    return SingleResponse(data=result)


@router.post("/classification-by-urls", response_model=SingleResponse[EvidenceClassifiResults])
async def classify_evidence_by_urls_endpoint(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    request: EvidenceClassificationByUrlsRequest,
):
    async def dummy_callback(data): pass
    if not request.urls or not isinstance(request.urls, list) or len(request.urls) == 0:
        raise HTTPException(status_code=400, detail="必须提供URL列表")
    result = await classify_evidence_by_urls(request.urls, dummy_callback, db=db)
    return SingleResponse(data=result)


@router.websocket("/ws/extract-features")
async def websocket_extract_features(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # 接收JSON格式的请求
            data = await websocket.receive_json()
            
            # 解析请求参数
            evidence_type = data.get("evidence_type", "微信聊天记录")
            consider_correlations = data.get("consider_correlations", False)
            
            # 接收文件数据
            file_data = await websocket.receive_bytes()
            file_name = f"temp_file_{id(file_data)}.jpg"
            
            # 创建UploadFile-like对象
            from io import BytesIO
            upload_file = UploadFile(filename=file_name, file=BytesIO(file_data))

            # 使用回调发送进度
            async def send_progress(update_data: dict):
                await websocket.send_json(update_data)

            result = await extract_evidence_features_by_upload(
                [upload_file], 
                evidence_type, 
                consider_correlations, 
                send_progress
            )

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"An error occurred: {e}")
        await websocket.close(code=1011, reason=str(e))


@router.post("/extract-features", response_model=SingleResponse[EvidenceExtractionResults])
async def extract_features_endpoint(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    files: List[UploadFile] = File(...),
    evidence_type: str = "微信聊天记录",
    consider_correlations: bool = False,
    ):
    """
    基于上传的文件提取证据特征
    """
    async def dummy_callback(data):
        pass
    result = await extract_evidence_features_by_upload(
        files, 
        evidence_type, 
        consider_correlations, 
        dummy_callback
    )
    return SingleResponse(data=result)


@router.post("/extract-features-by-urls", response_model=SingleResponse[EvidenceExtractionResults])
async def extract_features_by_urls_endpoint(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    request: EvidenceFeatureExtractionByUrlsRequest,
):
    """
    基于URL提取证据特征
    """
    async def dummy_callback(data): pass
    if not request.urls or not isinstance(request.urls, list) or len(request.urls) == 0:
        raise HTTPException(status_code=400, detail="必须提供URL列表")
    result = await extract_evidence_features(
        request.urls, 
        request.evidence_type, 
        request.consider_correlations, 
        dummy_callback, 
        db=db
    )
    return SingleResponse(data=result)