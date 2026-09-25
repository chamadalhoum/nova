import logging
import re
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.seed import seed_demo_data

logger = logging.getLogger("nova.api")
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{8,80}$")


def request_id_from(request: Request) -> str:
    incoming = request.headers.get("x-request-id", "")
    if REQUEST_ID_PATTERN.fullmatch(incoming):
        return incoming
    return str(uuid4())


def error_response(status_code: int, code: str, message: str, request_id: str, detail: object | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "request_id": request_id}, "detail": detail or message},
        headers={"X-Request-ID": request_id},
    )


def create_app() -> FastAPI:
    app = FastAPI(
        title="NOVA API",
        description="AI-first life agent MVP API",
        version="0.1.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request_id_from(request)
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
            },
        )
        return response

    app.include_router(router)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = getattr(request.state, "request_id", request_id_from(request))
        detail = exc.detail
        if isinstance(detail, dict):
            message = str(detail.get("message") or "NOVA could not complete this request. Please try again.")
            code = str(detail.get("code") or "HTTP_ERROR").upper()
        else:
            message = str(detail)
            code = "HTTP_ERROR"
        return error_response(exc.status_code, code, message, request_id, detail)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", request_id_from(request))
        return error_response(
            422,
            "VALIDATION_ERROR",
            "I couldn't complete this request. Please check the information and try again.",
            request_id,
            exc.errors(),
        )

    @app.exception_handler(Exception)
    async def friendly_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        if app.debug:
            raise exc
        request_id = getattr(request.state, "request_id", request_id_from(request))
        logger.exception("unhandled request error", extra={"request_id": request_id})
        return error_response(500, "INTERNAL_ERROR", "NOVA could not complete this request. Please try again.", request_id)

    @app.on_event("startup")
    def startup() -> None:
        if settings.app_env.lower() not in {"dev", "development", "local", "test", "testing"}:
            return
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_demo_data(db)
        finally:
            db.close()

    return app


app = create_app()
