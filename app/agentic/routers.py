from typing import List, Annotated
from fastapi import APIRouter, Depends, File, UploadFile, WebSocket, WebSocketDisconnect, HTTPException, Form
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
    EvidenceFeatureExtractionByUrlsRequest,
    SmartFillRequest,
    SmartFillResponse
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


# --- Smart Doc Gen Endpoint ---
from app.agentic.schemas import SmartDocGenResponse
from app.agentic.agents.smart_doc_gen_agent import generate_document_for_case
from app.agentic.agents.smart_json_doc_gen_agent import SmartJsonDocGenAgent
import os
import tempfile
import uuid
from datetime import datetime


GENERATED_DOCS_DIR = os.path.join(os.path.dirname(__file__), "agents", "generated_docs")
os.makedirs(GENERATED_DOCS_DIR, exist_ok=True)


@router.post("/smart-doc-gen/generate", response_model=SingleResponse[SmartDocGenResponse])
async def generate_smart_document(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    case_id: int = Form(..., description="案件ID"),
    template: UploadFile = File(..., description="DOCX模板文件"),
):
    """
    基于案件数据和上传的DOCX模板智能生成文书
    """
    # 1. Save uploaded template to a temporary file
    template_suffix = os.path.splitext(template.filename)[1] or ".docx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=template_suffix) as tmp_template:
        content = await template.read()
        tmp_template.write(content)
        template_path = tmp_template.name
    
    # 2. Generate output path
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    output_filename = f"case_{case_id}_{timestamp}_{uuid.uuid4().hex[:8]}.docx"
    output_path = os.path.join(GENERATED_DOCS_DIR, output_filename)
    
    try:
        agent_message = await generate_document_for_case(
            db, 
            case_id, 
            template_path, 
            output_path
        )
        return SingleResponse(data=SmartDocGenResponse(
            status="success",
            output_path=output_path,
            message=agent_message
        ))
    except Exception as e:
        return SingleResponse(data=SmartDocGenResponse(
            status="failed",
            output_path=None,
            message=str(e)
        ))
    finally:
        # Cleanup temporary template file
        if os.path.exists(template_path):
            os.remove(template_path)


@router.post("/smart-doc-gen/fill-json", response_model=SingleResponse[SmartFillResponse])
async def smart_fill_json(
    db: DBSession,
    request: SmartFillRequest,
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """
    智能填充 ProseMirror JSON 文档内容
    """
    from app.cases.services import get_by_id as get_case_by_id
    from app.evidences.services import list_evidences_by_case_id
    
    # 1. Fetch Case Data
    case = await get_case_by_id(db, request.case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case with ID {request.case_id} not found.")

    # 2. Fetch Evidence Data
    evidences, _ = await list_evidences_by_case_id(db, request.case_id, limit=100)
    
    # 3. Serialize Data (Reuse logic if possible, but simpler to inline here for now)
    case_dict = {
        "id": case.id,
        "loan_amount": case.loan_amount,
        "case_type": case.case_type.value if case.case_type else None,
        "case_status": case.case_status.value if case.case_status else None,
        "loan_date": case.loan_date.isoformat() if case.loan_date else None,
        "court_name": case.court_name,
        "description": case.description,
        "parties": [
            {
                "party_name": p.party_name,
                "party_role": p.party_role,
                "party_type": p.party_type,
                "name": p.name,
                "phone": p.phone,
                "address": p.address,
                "id_card": p.id_card,
                "company_name": p.company_name,
                "company_address": p.company_address,
                "company_code": p.company_code
            } for p in case.case_parties
        ]
    }
    
    evidence_list = [
        {
            "id": e.id,
            "file_name": e.file_name,
            "classification_category": e.classification_category,
            "evidence_status": e.evidence_status
        } for e in evidences
    ]
    
    context_data = {
        "case": case_dict,
        "evidence": evidence_list
    }
    
    case_context = json.dumps(context_data, ensure_ascii=False, indent=2)
    
    # 4. Invoke Agent
    try:
        agent = SmartJsonDocGenAgent()
        filled_json = await agent.run(case_context, request.content_json)
        
        return SingleResponse(data=SmartFillResponse(
            status="success",
            filled_content=filled_json,
            message="智能填充完成"
        ))
    except Exception as e:
        print(f"Smart fill error: {e}")
        return SingleResponse(data=SmartFillResponse(
            status="failed",
            filled_content=None,
            message=f"智能填充失败: {str(e)}"
        ))
