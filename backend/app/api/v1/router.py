from fastapi import APIRouter

from app.api.v1 import admin, analytics, attendance, auth, monitoring, notifications, reports, students

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(students.router)
api_router.include_router(attendance.router)
api_router.include_router(analytics.router)
api_router.include_router(reports.router)
api_router.include_router(monitoring.router)
api_router.include_router(notifications.router)
