# 导入所有模型，以便Alembic可以检测到它们
from app.db.base_class import Base  # noqa

# 导入所有模型 - 注意导入顺序，避免循环依赖
from app.staffs.models import Staff  # noqa
from app.users.models import User  # noqa
from app.cases.models import Case  # noqa
# 先导入agentic模型，再导入evidences模型，避免关系引用问题
from app.agentic.models import FeatureGroup, EvidenceFeatureGroupAssociation # noqa
from app.evidences.models import Evidence  # noqa