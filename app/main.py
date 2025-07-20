from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="智能证据平台 API",
    description="法律债务纠纷领域的证据智能管理平台",
    version="0.1.0",
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置为特定的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "欢迎使用智能证据平台 API"}


# 导入和包含路由器
from app.api.v1 import login, staff, users, cases, evidences

# 添加API路由
app.include_router(login.router, prefix="/api/v1")
app.include_router(staff.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(cases.router, prefix="/api/v1")
app.include_router(evidences.router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)