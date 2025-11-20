# 导入所有模型，以便Alembic可以检测到它们
from app.db.base_class import Base  # noqa

# 导入所有模型 - 注意导入顺序，避免循环依赖
from app.staffs.models import Staff  # noqa
from app.users.models import User  # noqa
from app.cases.models import Case  # noqa
from app.evidences.models import Evidence, EvidenceCard  # noqa - 导入 EvidenceCard 以确保关联表被检测到
from app.wecom.models import WeComStaff, ExternalContact, CustomerSession, ContactWay, CustomerEventLog  # noqa
from app.template_editor.models import DocumentTemplate, TemplatePlaceholder  # noqa
from app.document_generation.models import DocumentGeneration  # noqa