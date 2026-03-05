import time
import uuid
from typing import Any

import sentry_sdk
import structlog
import structlog.contextvars
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger()

_SKIP_LOG_PATHS = {"/health", "/health/deep"}


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())

        structlog.contextvars.bind_contextvars(request_id=request_id)
        sentry_sdk.set_tag("request_id", request_id)

        start = time.monotonic()
        try:
            response: Response = await call_next(request)
        finally:
            structlog.contextvars.clear_contextvars()

        duration_ms = round((time.monotonic() - start) * 1000, 1)
        response.headers["X-Request-ID"] = request_id

        if request.url.path not in _SKIP_LOG_PATHS:
            logger.info(
                "request",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=duration_ms,
            )

        return response
