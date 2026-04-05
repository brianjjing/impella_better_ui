"""POST /api/forecast — world-model rollout for the pump simulator."""
from __future__ import annotations

import math
import os
import pickle
import re
from pathlib import Path
from typing import Any, List, Optional

import torch
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.config import model_configs
from backend.api_initialization import get_data_pickle_path
from backend.model import WorldModel

router = APIRouter(tags=["forecast"])

_BACKEND_DIR = Path(__file__).resolve().parent

FEATURE_KEYS = [
    "MAP",
    "pumpSpeed",
    "pumpFlow",
    "LVP",
    "LVEDP",
    "SBP",
    "DBP",
    "pulsatility",
    "motorCurrent",
    "HR",
    "eseLV",
    "tauLV",
]

_world_model: Optional[WorldModel] = None


def _safe_float(v: Any) -> Optional[float]:
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def _world_model_weight_candidates() -> list[Path]:
    """Ordered list of paths to try (first match wins)."""
    out: list[Path] = []
    env = os.environ.get("SMARTWEAN_MODEL_PATH")
    if env:
        out.append(Path(env).expanduser())

    # Same directory as this API (typical drop-in location)
    out.append(_BACKEND_DIR / "10min_1hr_all_data_model.pth")
    # rl_env factory used this naming pattern for the same checkpoint family
    out.append(_BACKEND_DIR / "10min_1hr_window_model.pth")

    # Repo checkout layout: …/Impella/GORMPO_abiomed/…
    repo_root = _BACKEND_DIR.parent.parent
    out.extend(
        [
            repo_root / "GORMPO_abiomed" / "abiomed_env" / "10min_1hr_all_data_model.pth",
            repo_root / "GORMPO_abiomed" / "models" / "10min_1hr_all_data_model.pth",
            repo_root / "GORMPO_abiomed" / "10min_1hr_all_data_model.pth",
        ]
    )

    # Cluster / legacy default (only used if the file actually exists)
    out.append(Path("/public/gormpo/models/10min_1hr_all_data_model.pth"))
    return out


def _resolve_world_model_weights() -> Path:
    for p in _world_model_weight_candidates():
        try:
            if p.is_file():
                return p.resolve()
        except OSError:
            continue
    tried = "\n".join(f"  - {p}" for p in _world_model_weight_candidates())
    raise FileNotFoundError(
        "World model weights (.pth) not found. This repo does not ship the checkpoint.\n"
        "Do one of the following:\n"
        f"  • Set SMARTWEAN_MODEL_PATH to your 10min_1hr_all_data_model.pth file, or\n"
        f"  • Copy that file into: {_BACKEND_DIR / '10min_1hr_all_data_model.pth'}\n"
        "Searched locations:\n"
        f"{tried}"
    )


def get_forecast_world_model() -> WorldModel:
    """Lazy singleton: trained 10min_1hr model with forecast_horizon=6 (matches checkpoint)."""
    global _world_model
    if _world_model is not None:
        return _world_model

    model_name = "10min_1hr_all_data"
    if model_name not in model_configs:
        raise RuntimeError(f"Missing config entry: {model_name}")

    device_s = os.environ.get("SMARTWEAN_DEVICE", "cpu")
    kwargs = dict(model_configs[model_name])
    kwargs["device"] = torch.device(device_s)

    wm = WorldModel(**kwargs)
    path = _resolve_world_model_weights()
    wm.load_model(str(path))
    wm.load_data(get_data_pickle_path())
    _world_model = wm
    return wm


def _parse_patient_index(patient_id: str) -> int:
    m = re.fullmatch(r"P(\d+)", patient_id.strip(), re.IGNORECASE)
    if not m:
        raise ValueError("patient_id must look like P000, P001, …")
    return int(m.group(1))


def _initial_state_tensor(wm: WorldModel, patient_idx: int) -> torch.Tensor:
    """Same 6-step window as /api/patients timeline: last 6 of the first 11 timesteps per sequence."""
    path = get_data_pickle_path()
    with open(path, "rb") as f:
        data = pickle.load(f)
    train = data["train"]
    if patient_idx < 0 or patient_idx >= train.shape[0]:
        raise IndexError("patient index out of range")
    mean = data["mean"]
    std = data["std"]
    # Patient list uses forecast_horizon=11 on TimeSeriesDataset → only the first 11 steps per row.
    patient_horizon = 11
    raw = train[patient_idx, :patient_horizon]
    seq = (raw - mean) / std
    seq = seq[:, wm.columns]
    h = wm.forecast_horizon
    if seq.shape[0] < h:
        raise ValueError("sequence shorter than forecast horizon")
    return seq[-h:, :].to(dtype=torch.float32)


class ForecastRequest(BaseModel):
    patient_id: str = Field(..., description="e.g. P000 from /api/patients")
    p_levels: List[int] = Field(..., min_length=6, max_length=6)

    @field_validator("p_levels")
    @classmethod
    def p_levels_range(cls, v: List[int]) -> List[int]:
        for p in v:
            if p < 2 or p > 9:
                raise ValueError("each p_level must be between 2 and 9")
        return v


class ForecastResponse(BaseModel):
    patient_id: str
    forecast: List[dict]


@router.post("/forecast", response_model=ForecastResponse)
def post_forecast(body: ForecastRequest) -> ForecastResponse:
    try:
        wm = get_forecast_world_model()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model unavailable: {e}") from e

    try:
        idx = _parse_patient_index(body.patient_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        state = _initial_state_tensor(wm, idx)
    except IndexError:
        raise HTTPException(status_code=404, detail="Unknown patient_id for training split") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    state = state.to(wm.device)
    forecast_rows: List[dict] = []

    with torch.no_grad():
        for hour, p in enumerate(body.p_levels):
            state = wm.step(state.unsqueeze(0), int(p)).squeeze(0)
            unnorm = wm.unnorm_output(state.unsqueeze(0)).squeeze(0)
            row = unnorm[-1].cpu().numpy()
            h = hour + 1
            entry = {
                "t": 6 + hour,
                "label": f"T+{h}h",
                "timestamp": None,
            }
            for i, key in enumerate(FEATURE_KEYS):
                entry[key] = _safe_float(row[i])
            forecast_rows.append(entry)

    return ForecastResponse(patient_id=body.patient_id.upper(), forecast=forecast_rows)
