# 导入所有模型，以便Alembic可以检测到它们
from app.db.base_class import Base  # noqa

# 导入所有模型
from app.staffs.models import Staff  # noqa
from app.users.models import User  # noqa
from app.cases.models import Case  # noqa
from app.evidences.models import Evidence  # noqa