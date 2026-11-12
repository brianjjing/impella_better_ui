"""Check for GET /api/policy_forecast. Run from the repo root: python -m backend.test_policy_forecast
(needs the world model and the /public/gormpo policy checkpoints)."""
from fastapi import HTTPException

import backend.api_initialization  # noqa: F401  load first, like uvicorn does (forecast_api <-> api_initialization cycle)
from backend.policy_evaluation_api import get_policy_forecast


def test_policy_forecast():
    for model in ("CORMPO", "GORMPO-KDE", "GORMPO-DDPM"):
        body = get_policy_forecast(patient_id="P026", model=model)
        assert len(body["p_levels"]) == 6 and all(2 <= p <= 10 for p in body["p_levels"]), body["p_levels"]
        assert isinstance(body["reward"], float), body["reward"]
        assert len(body["forecast"]) == 36 and body["forecast"][-1]["label"] == "Hour 6"
    # Known-good rewards for the right checkpoints (P-levels as those checkpoints give them); a wrong checkpoint fails.
    for pid, model, levels, reward in [
        ("P10655", "GORMPO-NeuralODE", [5, 4, 8, 8, 7, 7], 3.84),
        ("P11474", "CORMPO", [4, 5, 6, 7, 8, 8], 3.12),
        ("P9242", "CORMPO", [4, 6, 6, 6, 6, 6], 2.21),
    ]:
        body = get_policy_forecast(patient_id=pid, model=model)
        assert body["p_levels"] == levels and round(body["reward"], 2) == reward, (pid, model, body["p_levels"], body["reward"])
    try:
        get_policy_forecast(patient_id="P026", model="nope")
        raise AssertionError("unknown model should be rejected")
    except HTTPException as e:
        assert e.status_code == 400


if __name__ == "__main__":
    test_policy_forecast()
    print("ok")
