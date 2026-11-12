"""Check for GET /api/policy_forecast. Run from the repo root: python -m backend.test_policy_forecast
(needs the world model and the /public/gormpo policy checkpoints)."""
from fastapi import HTTPException

import backend.api_initialization  # noqa: F401  load first, like uvicorn does (forecast_api <-> api_initialization cycle)
from backend.policy_evaluation_api import get_policy_forecast


def test_policy_forecast():
    for model in ("CORMPO", "GORMPO-KDE", "GORMPO-DDPM"):
        body = get_policy_forecast(patient_id="P026", model=model)
        assert len(body["p_levels"]) == 6 and all(2 <= p <= 10 for p in body["p_levels"]), body["p_levels"]
        assert len(body["forecast"]) == 36 and body["forecast"][-1]["label"] == "Hour 6"
    try:
        get_policy_forecast(patient_id="P026", model="nope")
        raise AssertionError("unknown model should be rejected")
    except HTTPException as e:
        assert e.status_code == 400


if __name__ == "__main__":
    test_policy_forecast()
    print("ok")
