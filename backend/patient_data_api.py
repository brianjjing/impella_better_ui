import math
import logging

import torch

from fastapi import APIRouter

from backend.forecast_api import get_forecast_world_model, FEATURE_KEYS

router = APIRouter(tags=["patients"])
logger = logging.getLogger(__name__)

_DEFAULT_PUMP_LEVEL = 6  # P-level used for autoregressive prediction steps


def _safe_float(v):
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def _build_all_timelines(wm):
    """
    For every patient in wm.data_train, build a 36-step timeline:
      - Hour 0 (T-5h): actual first-hour data from the dataset (6 timesteps)
      - Hours 1–5 (T-4h … T-0h): 5 autoregressive steps via wm.step(), each yielding 6 timesteps
    Returns a list of lists, outer index = patient index, inner = 36 timeline dicts.
    """
    N = wm.data_train.data.shape[0]
    logger.info("[patients] building timelines for N=%s patients", N)

    # Normalized first-hour states: (N, 6, 12) — data_train.data may be numpy or tensor
    all_states = torch.as_tensor(wm.data_train.data).to(wm.device).float()

    # Pre-compute normalized pump-level tensor for the constant P-level prediction
    mean_pl_val = float(wm.mean[-1])
    std_pl_val = float(wm.std[-1])
    raw_pl = torch.full((N, wm.forecast_horizon), float(_DEFAULT_PUMP_LEVEL))
    norm_pl = (raw_pl - mean_pl_val) / std_pl_val
    norm_pl = norm_pl.to(wm.device)

    # Collect normalized hourly tensors: index 0 = real, 1-5 = predicted
    hourly_norm = [all_states.cpu()]  # list of (N, 6, 12)

    with torch.no_grad():
        current = all_states
        for _ in range(5):
            next_hour = wm.step(current, norm_pl)  # (N, 6, 12), normalized
            hourly_norm.append(next_hour.cpu())
            current = next_hour

    # Unnormalize all hours at once: (6, N, 6, 12) → unnorm per hour
    hourly_unnorm = []
    for h_norm in hourly_norm:
        h_unnorm = wm.unnorm_output(h_norm).numpy()  # (N, 6, 12)
        hourly_unnorm.append(h_unnorm)

    # Build per-patient timeline lists
    timelines = []
    for patient_idx in range(N):
        timeline = []
        t_global = 0
        for h in range(6):
            hour_offset = 5 - h  # 5, 4, 3, 2, 1, 0
            hour_data = hourly_unnorm[h][patient_idx]  # (6, 12)
            for step in range(6):
                minute = step * 10
                if minute == 0:
                    label = f"T-{hour_offset}h"
                else:
                    label = f"+{minute}m"
                entry = {
                    "t": t_global,
                    "timestamp": None,
                    "label": label,
                }
                for feat_i, feat_name in enumerate(FEATURE_KEYS):
                    entry[feat_name] = _safe_float(hour_data[step, feat_i])
                timeline.append(entry)
                t_global += 1
        timelines.append(timeline)

    return timelines


@router.get("/patients")
def get_patients():
    logger.info("[patients] request started")
    try:
        wm = get_forecast_world_model()
        logger.info("[patients] world model loaded")

        timelines = _build_all_timelines(wm)
        N = len(timelines)

        # Read p-level (last column) from the first hour to derive a representative deviceLevel
        first_hour_norm = torch.as_tensor(wm.data_train.data[:, :, -1]).float()  # (N, 6)
        pl_unnorm = first_hour_norm * float(wm.std[-1]) + float(wm.mean[-1])  # (N, 6)
        mean_pl = pl_unnorm.mean(dim=1)  # (N,)
        device_levels = mean_pl.round().clamp(2, 9).int().tolist()

        patients = []
        for patient_idx in range(N):
            patients.append({
                "id": f"P{patient_idx:03d}",
                "name": f"Patient {patient_idx}",
                "age": 60,
                "gender": "U",
                "condition": "Unknown condition",
                "diagnosis": "Unknown diagnosis",
                "deviceLevel": device_levels[patient_idx],
                "status": "stable",
                "admissionDate": "2026-01-01",
                "physician": "Dr. Sins",
                "mrn": f"MRN-{patient_idx:06d}",
                "timeline": timelines[patient_idx],
            })

        logger.info("[patients] request complete count=%s", N)
        return patients

    except Exception:
        logger.exception("[patients] request failed with unhandled error")
        raise
