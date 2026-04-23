import math
import logging
import os
from pathlib import Path

from fastapi import APIRouter

from backend.api_initialization import get_data_pickle_path
from backend.model import WorldModel, pd, np

router = APIRouter(tags=["patients"])
logger = logging.getLogger(__name__)
_SERVER_DATA_PICKLE = Path("/public/gormpo/10min_1hr_all_data.pkl")


def _resolve_patients_data_path() -> str:
    """Prefer server dataset path when available, then fall back."""
    env_path = os.environ.get("SMARTWEAN_DATA_PICKLE")
    if env_path and Path(env_path).is_file():
        return env_path
    if _SERVER_DATA_PICKLE.is_file():
        return str(_SERVER_DATA_PICKLE)
    return get_data_pickle_path()


def _safe_float(v):
    """Convert to float for JSON; use None for NaN/Inf (becomes null)."""
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


@router.get("/patients")
def get_patients():
    logger.info("[patients] request started")
    try:
        # 1. Load raw Abiomed data
        logger.info("[patients] creating WorldModel")
        world_model = WorldModel(num_features=12, forecast_horizon=11)

        logger.info("[patients] resolving pickle path")
        data_path = _resolve_patients_data_path()
        logger.info("[patients] loading data from path=%s", data_path)
        world_model.load_data(path=data_path)
        logger.info("[patients] data loaded into world_model")

        # Converting the data tensor to a pandas df:
        logger.info("[patients] extracting train tensor")
        data_tensor = world_model.data_train.data  # torch.Tensor [N, T, F] (normalized)
        logger.info("[patients] converting tensor to numpy")
        arr = data_tensor.detach().cpu().numpy()   # → NumPy array
        N, T, F = arr.shape
        logger.info("[patients] array shape N=%s T=%s F=%s", N, T, F)

        # Unnormalize: data is stored as (x - mean) / std; reverse to get real units (BPM, mmHg, etc.)
        logger.info("[patients] reading mean/std")
        mean_arr = world_model.mean[world_model.columns]
        std_arr = world_model.std[world_model.columns]
        if hasattr(mean_arr, "detach"):
            logger.info("[patients] mean/std are tensors, converting to numpy")
            mean_arr = mean_arr.detach().cpu().numpy()
            std_arr = std_arr.detach().cpu().numpy()
        else:
            logger.info("[patients] mean/std are not tensors, coercing to numpy arrays")
            mean_arr = np.asarray(mean_arr)
            std_arr = np.asarray(std_arr)
        logger.info("[patients] applying unnormalization")
        arr = arr * std_arr + mean_arr

        # Name feature columns to match impella_ui / cost_func canonical order:
        #  0: MAP, 1: pumpSpeed, 2: pumpFlow, 3: LVP, 4: LVEDP, 5: SBP, 6: DBP,
        #  7: pulsatility, 8: motorCurrent, 9: HR, 10: eseLV, 11: tauLV (raw idx 12)
        if F == 12:
            logger.info("[patients] using canonical 12 feature names")
            feature_names = [
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
        else:
            logger.info("[patients] using fallback feature names for F=%s", F)
            feature_names = [f"feature_{i}" for i in range(F)]

        logger.info("[patients] reshaping into flat dataframe inputs")
        flat = arr.reshape(N * T, F)
        df = pd.DataFrame(flat, columns=feature_names)
        logger.info("[patients] dataframe created rows=%s cols=%s", len(df), len(df.columns))

        # Add synthetic patient_id per (N*T) block so we can group rows into patients.
        logger.info("[patients] adding patient_id and time columns")
        df["patient_id"] = np.repeat(np.arange(N), T)
        df["time"] = np.tile(np.arange(T), N)

        # 2. Transform to the structure MainMenu expects
        #    (id, name, deviceLevel, status, timeline[0..5] with MAP, HR, etc.)
        logger.info("[patients] building response objects")
        patients = []
        for idx, (patient_id, pdf) in enumerate(df.groupby("patient_id")):
            if idx < 5:
                logger.info("[patients] processing patient_id=%s", int(patient_id))
            elif idx == 5:
                logger.info("[patients] processing additional patients (logs truncated)")

            pdf = pdf.sort_values("time").tail(6)  # last 6 steps per patient
            timeline = []
            for i, row in enumerate(pdf.itertuples(index=False)):
                timeline.append({
                    "t": i,
                    "timestamp": None,
                    "label": f"T-{5 - i}h",
                    "MAP":        _safe_float(row.MAP),
                    "pumpSpeed":  _safe_float(row.pumpSpeed),
                    "motorCurrent": _safe_float(row.motorCurrent),
                    "pumpFlow":   _safe_float(row.pumpFlow),
                    "LVP":        _safe_float(row.LVP),
                    "LVEDP":      _safe_float(row.LVEDP),
                    "HR":         _safe_float(row.HR),
                    "SBP":        _safe_float(row.SBP),
                    "DBP":        _safe_float(row.DBP),
                    "pulsatility": _safe_float(row.pulsatility),
                    "tauLV":      _safe_float(row.tauLV),
                    "eseLV":      _safe_float(row.eseLV),
                })

            patients.append({
                "id": f"P{int(patient_id):03d}",
                "name": f"Patient {int(patient_id)}",
                "age": 60,
                "gender": "U",
                "condition": "Unknown condition",
                "diagnosis": "Unknown diagnosis",
                "deviceLevel": 6,
                "status": "stable",          # or derive from metrics
                "admissionDate": "2026-01-01",
                "physician": "Dr. Sins",
                "mrn": f"MRN-{int(patient_id):06d}",
                "timeline": timeline,
            })

        logger.info("[patients] request complete count=%s", len(patients))
        return patients
    except Exception:
        logger.exception("[patients] request failed with unhandled error")
        raise