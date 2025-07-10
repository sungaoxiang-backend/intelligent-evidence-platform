from typing import List, Annotated
from fastapi import APIRouter, Depends, File, UploadFile
from app.core.deps import DBSession, get_current_staff
from app.staffs.models import Staff
from app.agentic.services import classify_evidence
from app.agentic.agents.evidence_classifier import Results
from app.core.response import SingleResponse

router = APIRouter()


@router.post("/classification", response_model=SingleResponse[Results])
async def classify_evidence_endpoint(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    files: List[UploadFile] = File(...),
    ):
    """
    Classify evidence based on uploaded files.
    """
    result = await classify_evidence(files)
    return SingleResponse(data=result)