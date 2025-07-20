from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import time
import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.core.middleware import http_exception_handler, validation_exception_handler, global_exception_handler
from app.core.logging import logger

app = FastAPI(
    title="智能证据平台 API",
    description="法律债务纠纷领域的证据智能管理平台",
    version="0.1.0",
)

# app.mount("/static", StaticFiles(directory="static"), name="static")
# templates = Jinja2Templates(directory="templates")

from app.core.middleware import LoggingMiddleware

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置为特定的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 中间件
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)
app.add_middleware(LoggingMiddleware)

# @app.get("/")
# async def root(request: Request):
#     return templates.TemplateResponse("index.html", {"request": request})
@app.get("/")
async def index():
    return {"server_status": "running"}

from app.api.v1 import api_router

app.include_router(api_router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)