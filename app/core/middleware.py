import time
from fastapi import Request
from loguru import logger
from fastapi.responses import JSONResponse
from datetime import datetime
from fastapi.exceptions import HTTPException, RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
import pytz
from fastapi.encoders import jsonable_encoder

async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTPException: {exc.detail} - {request.method} {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder({
            "code": exc.status_code,
            "message": exc.detail,
            "timestamp": datetime.now(pytz.timezone('Asia/Shanghai')).isoformat(),
            "data": None
        })
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # 尝试从 request.state 读取 body，避免重复消费
    body = getattr(request.state, 'body', None)
    logger.error(f"Validation error: {exc.errors()} for request body: {body}")
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({
            "code": 422,
            "message": "请求参数验证失败",
            "timestamp": datetime.now(pytz.timezone('Asia/Shanghai')).isoformat(),
            "data": None,
            "detail": exc.errors()
        })
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error: {exc}")
    return JSONResponse(
        content=jsonable_encoder({
            "code": 500,
            "message": "Internal Server Error",
            "timestamp": datetime.now(pytz.timezone('Asia/Shanghai')).isoformat(),
            "data": None
        }),
        status_code=500
    )

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.time()
        
        logger.info(f"开始请求: {request.method} {request.url}")
        
        try:
            response = await call_next(request)
            
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)
            
            logger.info(f"完成请求: {request.method} {request.url} - 状态码: {response.status_code} - 耗时: {process_time:.4f}秒")
            
            return response
        except Exception as e:
            logger.error(f"请求异常: {request.method} {request.url} - 错误: {str(e)}")
            raise