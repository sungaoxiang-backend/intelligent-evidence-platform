from pydantic import BaseModel
from typing import List

class ClassifyRequest(BaseModel):
    # 这个模型现在是空的，因为文件将通过 `File()` 依赖项接收
    pass