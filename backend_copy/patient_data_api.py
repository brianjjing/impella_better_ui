import json
import math
import logging

import torch

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from backend_copy.forecast_api import get_forecast_world_model, FEATURE_KEYS

router = APIRouter(tags=["patients"])
logger = logging.getLogger(__name__)

# Memoized patients payload. The response is fully deterministic (derived from
# the data pickle, no model forward pass), so we build it once and reuse it.
# _patients_payload        — full list (with timeline), used by the detail endpoint
# _patients_list_bytes     — pre-serialized JSON of the list WITHOUT timelines,
#                            returned directly as bytes to skip per-request serialization
_patients_payload = None
_patients_list_bytes: bytes | None = None


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


def get_patients_payload():
    """Build (once) and return the full patients list including timelines. Memoized."""
    global _patients_payload, _patients_list_bytes
    if _patients_payload is not None:
        return _patients_payload

    wm = get_forecast_world_model()
    logger.info("[patients] building payload for the first time …")

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

    _patients_payload = patients

    # Pre-serialize the list WITHOUT timelines so /api/patients never re-encodes.
    slim = [{k: v for k, v in p.items() if k != "timeline"} for p in patients]
    _patients_list_bytes = json.dumps(slim).encode()

    logger.info(
        "[patients] payload built and cached count=%s  list_bytes=%.1f KB",
        N,
        len(_patients_list_bytes) / 1024,
    )
    return _patients_payload


@router.get("/patients")
def get_patients():
    """Returns all patients WITHOUT timeline data (~2 KB/patient instead of ~29 MB total).
    Timeline is fetched separately via GET /api/patients/{patient_id}/timeline.
    """
    try:
        get_patients_payload()  # ensure built
        if _patients_list_bytes is None:
            raise RuntimeError("patients payload not yet built")
        logger.info("[patients] list served from pre-serialized cache (%d bytes)", len(_patients_list_bytes))
        return Response(content=_patients_list_bytes, media_type="application/json")
    except Exception:
        logger.exception("[patients] list request failed")
        raise


@router.get("/patients/{patient_id}/timeline")
def get_patient_timeline(patient_id: str):
    """Returns the 6-step historical timeline for a single patient (fetched on demand)."""
    try:
        payload = get_patients_payload()
    except Exception:
        logger.exception("[patients] timeline request failed")
        raise

    patient_id = patient_id.strip().upper()
    patient = next((p for p in payload if p["id"] == patient_id), None)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")

    logger.info("[patients] timeline served for %s", patient_id)
    return patient["timeline"]
