import time
from fastapi import Request
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

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