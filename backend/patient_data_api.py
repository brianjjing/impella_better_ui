import math
import logging

import torch

from fastapi import APIRouter

from backend.forecast_api import get_forecast_world_model, FEATURE_KEYS

router = APIRouter(tags=["patients"])
logger = logging.getLogger(__name__)


def _safe_float(v):
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def _build_all_timelines(wm):
    """
    For every patient in wm.data_train, build a 6-step timeline from the actual
    observed data window (no autoregressive warmup prediction).
    Returns a list of lists, outer index = patient index, inner = 6 timeline dicts.
    """
    N = wm.data_train.data.shape[0]
    logger.info("[patients] building timelines for N=%s patients", N)

    # Normalized observed states: (N, 6, 12)
    all_states = torch.as_tensor(wm.data_train.data).to(wm.device).float()

    # Unnormalize the actual data
    unnorm = wm.unnorm_output(all_states.cpu()).numpy()  # (N, 6, 12)

    # Build per-patient timeline lists (6 sub-steps, actual observed data only)
    timelines = []
    for patient_idx in range(N):
        timeline = []
        hour_data = unnorm[patient_idx]  # (6, 12)
        # Historical window spans T-1h → T0h (6 points, conceptually 12 min apart).
        for step in range(6):
            if step == 0:
                label = "T-1h"
            elif step == 5:
                label = "T0h"
            else:
                label = f"+{step * 12}m"
            entry = {
                "t": step,
                "timestamp": None,
                "label": label,
            }
            for feat_i, feat_name in enumerate(FEATURE_KEYS):
                entry[feat_name] = _safe_float(hour_data[step, feat_i])
            timeline.append(entry)
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
