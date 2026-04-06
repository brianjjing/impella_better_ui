import math

from fastapi import APIRouter

from backend.api_initialization import get_data_pickle_path
from backend.model import WorldModel, pd, np

router = APIRouter(tags=["patients"])


def _safe_float(v):
    """Convert to float for JSON; use None for NaN/Inf (becomes null)."""
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


@router.get("/patients")
def get_patients():
    # 1. Load raw Abiomed data
    world_model = WorldModel(num_features=12, forecast_horizon=11)
    world_model.load_data(path=get_data_pickle_path())

    # Converting the data tensor to a pandas df:
    data_tensor = world_model.data_train.data  # torch.Tensor [N, T, F] (normalized)
    arr = data_tensor.detach().cpu().numpy()   # → NumPy array
    N, T, F = arr.shape

    # Unnormalize: data is stored as (x - mean) / std; reverse to get real units (BPM, mmHg, etc.)
    mean_arr = world_model.mean[world_model.columns]
    std_arr = world_model.std[world_model.columns]
    if hasattr(mean_arr, "detach"):
        mean_arr = mean_arr.detach().cpu().numpy()
        std_arr = std_arr.detach().cpu().numpy()
    else:
        mean_arr = np.asarray(mean_arr)
        std_arr = np.asarray(std_arr)
    arr = arr * std_arr + mean_arr

    # Name feature columns to match impella_ui / cost_func canonical order:
    #  0: MAP, 1: pumpSpeed, 2: pumpFlow, 3: LVP, 4: LVEDP, 5: SBP, 6: DBP,
    #  7: pulsatility, 8: motorCurrent, 9: HR, 10: eseLV, 11: tauLV (raw idx 12)
    if F == 12:
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
        feature_names = [f"feature_{i}" for i in range(F)]

    flat = arr.reshape(N * T, F)
    df = pd.DataFrame(flat, columns=feature_names)

    # Add synthetic patient_id per (N*T) block so we can group rows into patients.
    df["patient_id"] = np.repeat(np.arange(N), T)
    df["time"] = np.tile(np.arange(T), N)

    # 2. Transform to the structure MainMenu expects
    #    (id, name, deviceLevel, status, timeline[0..5] with MAP, HR, etc.)
    patients = []
    for patient_id, pdf in df.groupby("patient_id"):
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

    return patients