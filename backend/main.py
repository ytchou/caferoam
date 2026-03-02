import asyncio
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from api.admin import router as admin_router
from api.admin_shops import router as admin_shops_router
from api.admin_taxonomy import router as admin_taxonomy_router
from api.auth import router as auth_router
from api.checkins import router as checkins_router
from api.feed import router as feed_router
from api.lists import router as lists_router
from api.search import router as search_router
from api.shops import router as shops_router
from api.stamps import router as stamps_router
from api.submissions import router as submissions_router
from core.config import settings
from db.supabase_client import get_service_role_client
from middleware.request_id import RequestIDMiddleware
from workers.scheduler import create_scheduler

logger = structlog.get_logger()

scheduler = create_scheduler()


def _init_sentry() -> None:
    """Initialize Sentry error tracking if DSN is configured."""
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
    logger.info("Sentry initialized", environment=settings.environment)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup and shutdown events."""
    _init_sentry()
    logger.info("Starting CafeRoam API", environment=settings.environment)
    if settings.environment != "test":
        scheduler.start()
        logger.info("Scheduler started")
    yield
    if settings.environment != "test":
        scheduler.shutdown()
    logger.info("Shutting down CafeRoam API")


app = FastAPI(
    title="CafeRoam API",
    description="Backend API for CafeRoam coffee shop directory",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(RequestIDMiddleware)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/deep")
async def deep_health_check() -> JSONResponse:
    """Check connectivity to all critical dependencies."""
    checks: dict = {}
    all_healthy = True

    # Check Postgres via Supabase
    start = time.monotonic()
    try:
        db = get_service_role_client()
        await asyncio.wait_for(
            asyncio.to_thread(lambda: db.table("shops").select("id").limit(1).execute()),
            timeout=5.0,
        )
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        checks["postgres"] = {"status": "healthy", "latency_ms": latency_ms}
    except TimeoutError:
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        checks["postgres"] = {"status": "unhealthy", "latency_ms": latency_ms, "error": "timeout"}
        all_healthy = False
    except Exception:
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        checks["postgres"] = {
            "status": "unhealthy",
            "latency_ms": latency_ms,
            "error": "connection_failed",
        }
        all_healthy = False

    status = "healthy" if all_healthy else "unhealthy"
    status_code = 200 if all_healthy else 503
    return JSONResponse(content={"status": status, "checks": checks}, status_code=status_code)


app.include_router(auth_router)
app.include_router(shops_router)
app.include_router(search_router)
app.include_router(checkins_router)
app.include_router(lists_router)
app.include_router(stamps_router)
app.include_router(feed_router)
app.include_router(submissions_router)
app.include_router(admin_router)
app.include_router(admin_shops_router)
app.include_router(admin_taxonomy_router)
