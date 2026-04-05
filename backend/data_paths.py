"""Shared dataset path resolution for patient list and forecasting APIs."""
import os
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent
_DEFAULT_DATA_PICKLE = _BACKEND_DIR / "10min_1hr_all_data copy.pkl"


def get_data_pickle_path() -> str:
    env = os.environ.get("SMARTWEAN_DATA_PICKLE")
    if env and Path(env).is_file():
        return env
    if _DEFAULT_DATA_PICKLE.is_file():
        return str(_DEFAULT_DATA_PICKLE)
    fallback = _BACKEND_DIR.parent.parent / "GORMPO_abiomed" / "abiomed_env" / "data" / "10min_1hr_all_data.pkl"
    if fallback.is_file():
        return str(fallback)
    raise FileNotFoundError(
        f"No dataset found. Set SMARTWEAN_DATA_PICKLE or place a pickle at {_DEFAULT_DATA_PICKLE}"
    )