from fastapi import APIRouter

from app.staffs.routers import router as staffs_router, login_router
from app.users.routers import router as users_router
from app.cases.routers import router as cases_router
from app.evidences.routers import router as evidences_router
from app.agentic.routers import router as agentic_router

api_router = APIRouter()

api_router.include_router(login_router, prefix="/login", tags=["login"])
api_router.include_router(staffs_router, prefix="/staffs", tags=["staffs"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(cases_router, prefix="/cases", tags=["cases"])
api_router.include_router(evidences_router, prefix="/evidences", tags=["evidences"])
api_router.include_router(agentic_router, prefix="/agentic", tags=["agentic"])