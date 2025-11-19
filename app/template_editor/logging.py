from typing import Optional, Dict, Any, List
from datetime import datetime


class TemplateLogService:
    def __init__(self):
        self.records: List[Dict[str, Any]] = []

    def add_record(
        self,
        stage: str,
        action: str,
        status: str,
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.records.append(
            {
                "stage": stage,
                "action": action,
                "status": status,
                "meta": meta or {},
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
        )

    def with_warning(self, warning: Dict[str, Any]) -> None:
        self.records.append(
            {
                "stage": "export",
                "action": "warning",
                "status": "warning",
                "meta": warning,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
        )

    def get_records(self) -> List[Dict[str, Any]]:
        return self.records

    def clear(self) -> None:
        self.records.clear()


template_log_service = TemplateLogService()

