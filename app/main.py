from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import time
import os

from app.core.logging import logger

app = FastAPI(
    title="智能证据平台 API",
    description="法律债务纠纷领域的证据智能管理平台",
    version="0.1.0",
)

from app.core.middleware import LoggingMiddleware

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置为特定的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)

@app.get("/")
async def root():
    return {"message": "欢迎使用智能证据平台 API"}


from app.api.v1 import api_router

app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)