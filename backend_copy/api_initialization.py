"""Shared FastAPI app setup, CORS, routers, and dataset path resolution."""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parent
_DEFAULT_DATA_PICKLE = _BACKEND_DIR / "10min_1hr_all_data.pkl"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


def get_data_pickle_path() -> str:
    env = os.environ.get("SMARTWEAN_DATA_PICKLE")
    if env and Path(env).is_file():
        return env
    if _DEFAULT_DATA_PICKLE.is_file():
        return str(_DEFAULT_DATA_PICKLE)
    raise FileNotFoundError(
        f"No dataset found. Set SMARTWEAN_DATA_PICKLE or place a pickle at {_DEFAULT_DATA_PICKLE}"
    )


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Warm the heavy singletons at startup so the first user request is fast.

    Without this, the first /api/* call pays the full cost of constructing the
    transformer, loading the 16 MB checkpoint, loading the data pickle, and
    (for policy_evaluation) loading the SAC policy — ~15 s on the first request.
    Doing it here moves that cost to boot time, where no request is waiting.
    """
    from backend_copy.forecast_api import get_forecast_world_model
    from backend_copy.patient_data_api import get_patients_payload

    try:
        get_forecast_world_model()
        # Build + memoize the patients payload (deterministic, data-only).
        get_patients_payload()
        logger.info("[startup] world model + patients payload warmed")
    except Exception:
        # Don't block startup if weights/data are missing in this environment;
        # the per-request handlers still surface a clear error.
        logger.exception("[startup] warm-up failed; continuing (lazy load on first request)")

    # Warm the SAC policy too, if a checkpoint is present.
    try:
        from backend_copy.policy_evaluation_api import warm_sac_policy
        warm_sac_policy()
        logger.info("[startup] SAC policy warmed")
    except Exception:
        logger.exception("[startup] SAC policy warm-up skipped")

    yield


def create_app() -> FastAPI:
    app = FastAPI(lifespan=_lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from backend_copy.forecast_api import router as forecast_router
    from backend_copy.policy_evaluation_api import router as policy_evaluation_router
    from backend_copy.patient_data_api import router as patients_router

    app.include_router(forecast_router, prefix="/api")
    app.include_router(policy_evaluation_router, prefix="/api")
    app.include_router(patients_router, prefix="/api")
    return app


app = create_app()
