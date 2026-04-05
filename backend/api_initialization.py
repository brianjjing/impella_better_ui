"""Shared FastAPI app setup, CORS, routers, and dataset path resolution."""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

_BACKEND_DIR = Path(__file__).resolve().parent
_DEFAULT_DATA_PICKLE = _BACKEND_DIR / "10min_1hr_all_data.pkl"


def get_data_pickle_path() -> str:
    env = os.environ.get("SMARTWEAN_DATA_PICKLE")
    if env and Path(env).is_file():
        return env
    if _DEFAULT_DATA_PICKLE.is_file():
        return str(_DEFAULT_DATA_PICKLE)
    raise FileNotFoundError(
        f"No dataset found. Set SMARTWEAN_DATA_PICKLE or place a pickle at {_DEFAULT_DATA_PICKLE}"
    )


def create_app() -> FastAPI:
    app = FastAPI()

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

    from backend.forecast_api import router as forecast_router
    from backend.policy_evaluation_api import router as policy_evaluation_router
    from backend.patient_data_api import router as patients_router

    app.include_router(forecast_router, prefix="/api")
    app.include_router(policy_evaluation_router, prefix="/api")
    app.include_router(patients_router, prefix="/api")
    return app


app = create_app()
