# 导入所有模型，以便Alembic可以检测到它们
from app.db.base_class import Base  # noqa

# 导入所有模型
from app.models.staff import Staff  # noqa
from app.models.user import User  # noqa
from app.models.case import Case  # noqa
from app.models.evidence import Evidence  # noqa