import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
settings = get_settings()

app = FastAPI(title=settings.app_name, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_prefix)


@app.exception_handler(Exception)
async def unhandled_exception(_: Request, exc: Exception):
    logging.exception("Unhandled application error")
    return JSONResponse(status_code=500, content={"success": False, "message": "Internal server error", "detail": str(exc)})


@app.get("/health")
def health():
    return {"success": True, "message": "SmartAttend AI backend is healthy"}
