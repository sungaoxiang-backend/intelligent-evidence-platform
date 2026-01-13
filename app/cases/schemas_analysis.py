from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.core.schemas import BaseSchema

class CaseInfoCommitCreate(BaseModel):
    statement: Optional[str] = None
    materials: List[Dict[str, Any]] = []

class CaseInfoCommit(BaseSchema):
    id: int
    case_id: int
    statement: Optional[str] = None
    materials: List[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True

class CaseInfoCommitDelete(BaseModel):
    ids: List[int]

class CaseAnalysisReport(BaseSchema):
    id: int
    case_id: int
    content: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
