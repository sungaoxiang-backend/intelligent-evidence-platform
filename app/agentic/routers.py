from typing import List, Annotated
from fastapi import APIRouter, Depends, File, UploadFile, WebSocket, WebSocketDisconnect
from app.core.deps import DBSession, get_current_staff
from app.staffs.models import Staff
from app.agentic.services import classify_evidence
from app.agentic.agents.evidence_classifier import EvidenceClassifiResults
from app.core.response import SingleResponse
import json

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