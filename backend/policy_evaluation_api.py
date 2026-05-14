"""GET /api/policy_evaluation — SAC policy distribution + rollout (impella_ui parity)."""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, List, Literal, Optional

import numpy as np
import torch
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.forecast_api import (
    FEATURE_KEYS,
    _initial_state_tensor,
    _parse_patient_index,
    _safe_float,
    get_forecast_world_model,
)
from backend.cost_func import weaning_score_model_gradient
from backend.policy_models import ActorProb, Critic, DiagGaussian, MLP
from backend.rl_env import AbiomedRLEnv
from backend.sac import SACPolicy

router = APIRouter(tags=["policy_evaluation"])
logger = logging.getLogger(__name__)
_SERVER_POLICY_WEIGHTS = Path(
    "/public/gormpo/models/rl/abiomed/realnvp/seed_42_0310_045907-abiomed_mbpo_realnvp/policy_abiomed.pth"
)

# Mirrors impella_better_ui/src/app/data/mockData.js policyDistributions
_MOCK_DIST: dict[str, List[float]] = {
    "P001": [0.02, 0.06, 0.18, 0.28, 0.26, 0.14, 0.05, 0.01],
    "P002": [0.01, 0.04, 0.14, 0.24, 0.30, 0.18, 0.07, 0.02],
    "P003": [0.00, 0.01, 0.03, 0.06, 0.14, 0.26, 0.32, 0.18],
    "P004": [0.25, 0.35, 0.22, 0.10, 0.05, 0.02, 0.01, 0.00],
}


def _policy_path_candidates() -> List[Path]:
    out: List[Path] = []
    env = os.environ.get("SMARTWEAN_POLICY_PATH")
    if env:
        out.append(Path(env).expanduser())
    out.append(_SERVER_POLICY_WEIGHTS)
    backend = Path(__file__).resolve().parent
    repo_root = backend.parent.parent
    out.extend(
        [
            backend / "policy_abiomed.pth",
            repo_root / "impella_ui" / "policy_abiomed.pth",
            repo_root / "GORMPO_abiomed" / "policy_abiomed.pth",
        ]
    )
    return out


def _resolve_policy_weights() -> Optional[Path]:
    for p in _policy_path_candidates():
        try:
            if p.is_file():
                return p.resolve()
        except OSError:
            continue
    return None


def _load_sac_policy(env: AbiomedRLEnv, policy_path: str, device: torch.device) -> SACPolicy:
    obs_shape = env.observation_space.shape[0]
    action_dim = env.action_space.shape[0]
    dev_str = str(device)

    actor_backbone = MLP(input_dim=obs_shape, hidden_dims=[256, 256])
    critic1_backbone = MLP(input_dim=obs_shape + action_dim, hidden_dims=[256, 256])
    critic2_backbone = MLP(input_dim=obs_shape + action_dim, hidden_dims=[256, 256])

    dist = DiagGaussian(
        latent_dim=getattr(actor_backbone, "output_dim"),
        output_dim=action_dim,
        unbounded=True,
        conditioned_sigma=True,
    )

    actor = ActorProb(actor_backbone, dist, dev_str)
    critic1 = Critic(critic1_backbone, dev_str)
    critic2 = Critic(critic2_backbone, dev_str)

    actor_optim = torch.optim.Adam(actor.parameters(), lr=3e-4)
    critic1_optim = torch.optim.Adam(critic1.parameters(), lr=3e-4)
    critic2_optim = torch.optim.Adam(critic2.parameters(), lr=3e-4)

    target_entropy = -np.prod(env.action_space.shape)
    log_alpha = torch.zeros(1, requires_grad=True, device=device)
    alpha_optim = torch.optim.Adam([log_alpha], lr=3e-4)
    alpha = (target_entropy, log_alpha, alpha_optim)

    sac_policy = SACPolicy(
        actor,
        critic1,
        critic2,
        actor_optim,
        critic1_optim,
        critic2_optim,
        action_space=env.action_space,
        dist=dist,
        tau=0.005,
        gamma=0.99,
        alpha=alpha,
        device=dev_str,
    )
    try:
        state_dict = torch.load(policy_path, map_location=device, weights_only=False)
    except TypeError:
        state_dict = torch.load(policy_path, map_location=device)
    sac_policy.load_state_dict(state_dict)
    sac_policy.eval()
    return sac_policy


def _feature_dict_from_state(wm, state_tensor: torch.Tensor) -> dict[str, float]:
    unnorm = wm.unnorm_output(state_tensor.unsqueeze(0)).squeeze(0)
    last = unnorm[-1].detach().cpu().numpy()
    return {FEATURE_KEYS[i]: float(last[i]) for i in range(len(FEATURE_KEYS))}


def _discrete_distribution(policy: SACPolicy, env: AbiomedRLEnv, obs: np.ndarray, n_samples: int = 2048) -> List[float]:
    counts = np.zeros(8, dtype=np.float64)
    with torch.no_grad():
        for _ in range(n_samples):
            a = policy.sample_action(obs, deterministic=False)
            p = int(env._action_to_p_level(a))
            if 2 <= p <= 9:
                counts[p - 2] += 1
    s = counts.sum()
    if s <= 0:
        return [1.0 / 8.0] * 8
    return (counts / s).tolist()


def _rollout_sac(
    policy: SACPolicy,
    env: AbiomedRLEnv,
    obs: np.ndarray,
    max_steps: int,
    deterministic: bool = True,
) -> tuple[List[dict[str, Any]], float, float]:
    wm = env.world_model
    steps: List[dict[str, Any]] = []
    total_reward = 0.0
    current_obs = obs
    rollout_states: List[np.ndarray] = []
    rollout_actions: List[int] = []
    for i in range(max_steps):
        rollout_states.append(np.asarray(current_obs, dtype=np.float32))
        with torch.no_grad():
            a = policy.sample_action(current_obs, deterministic=deterministic)
        next_obs, r, terminated, truncated, info = env.step(a)
        total_reward += float(r)
        p_level = int(info.get("p_level", 2))
        rollout_actions.append(p_level)
        row = wm.unnorm_output(env.current_state.unsqueeze(0)).squeeze(0)[-1].detach().cpu().numpy()
        state_dict = {FEATURE_KEYS[j]: _safe_float(row[j]) for j in range(len(FEATURE_KEYS))}
        state_dict["label"] = f"Hour {i + 1}"
        steps.append(
            {
                "state": state_dict,
                "actionLabel": f"P{p_level}",
                "reward": float(r),
            }
        )
        current_obs = next_obs
        if terminated or truncated:
            break
    # Match GORMPO_abiomed evaluation metric: rollout weaning score (gradient definition).
    weaning_score = 0.0
    if rollout_states and rollout_actions:
        ws, _slopes = weaning_score_model_gradient(
            wm,
            np.asarray(rollout_states, dtype=np.float32),
            rollout_actions,
        )
        weaning_score = float(ws)
    return steps, total_reward, weaning_score


def _quality_from_reward(total_reward: float) -> str:
    if total_reward > 0.2:
        return "optimal"
    if total_reward > -0.5:
        return "suboptimal"
    return "adverse"


def _mock_rollout_optimal(wm, state_tensor: torch.Tensor, pump_level: int = 6) -> tuple[List[dict[str, Any]], float, float, str]:
    """Port of mockData.js generateRollout(..., 'optimal') for offline / no-policy mode."""
    cur = _feature_dict_from_state(wm, state_tensor)
    steps: List[dict[str, Any]] = []
    total_steps = 6
    total_reward = 0.0

    for i in range(total_steps):
        progress = i / total_steps
        action = max(2, pump_level - (i // 2))
        mult = 1.0 - progress * 0.15

        def noise() -> float:
            return (np.random.random() - 0.5) * 0.04

        nxt = {
            "MAP": cur["MAP"] * 1.012 + noise() * 3,
            "pumpSpeed": cur["pumpSpeed"] * 0.992 + noise() * 200,
            "motorCurrent": cur["motorCurrent"] * mult + noise() * 0.1,
            "pumpFlow": cur["pumpFlow"] * 0.994 + noise() * 0.05,
            "LVP": cur["LVP"] * 0.985 + noise() * 2,
            "LVEDP": cur["LVEDP"] * 0.93 + noise() * 0.5,
            "HR": cur["HR"] * 0.988 + noise() * 1,
            "SBP": cur["SBP"] * 1.012 + noise() * 2,
            "DBP": cur["DBP"] * 1.008 + noise() * 1,
            "pulsatility": cur["pulsatility"] * 1.08 + noise() * 0.02,
            "tauLV": cur["tauLV"] * 0.96 + noise() * 0.5,
            "eseLV": cur["eseLV"] * 1.06 + noise() * 0.03,
        }
        rw = 0.8 + (np.random.random() - 0.5) * 0.1
        total_reward += rw
        step_state = {**nxt, "label": f"Hour {i + 1}"}
        steps.append({"state": step_state, "actionLabel": f"P{action}", "reward": rw})
        cur = nxt

    final_score = 72.0 + float(np.random.random() * 20.0)
    return steps, total_reward, final_score, "optimal"


class PolicyStepOut(BaseModel):
    state: dict[str, Any]
    actionLabel: str
    reward: float


class RolloutOut(BaseModel):
    id: str = "R1"
    label: str
    quality: str
    totalReward: float
    finalScore: float
    steps: List[PolicyStepOut]


class PolicyEvaluationResponse(BaseModel):
    patient_id: str
    source: Literal["sac", "mock"]
    distribution: List[float] = Field(..., min_length=8, max_length=8)
    rollout: RolloutOut
    detail: Optional[str] = None


@router.get("/policy_evaluation", response_model=PolicyEvaluationResponse)
def get_policy_evaluation(
    patient_id: str = Query(..., description="Patient id, e.g. P001 (must exist in training split)"),
    hour: int = Query(
        0,
        ge=0,
        le=6,
        description="Which forecast hour to evaluate from. 0 uses the initial T-1h→T0h state; 1..6 roll the world model forward using `p_levels`.",
    ),
    p_levels: Optional[str] = Query(
        None,
        description="Comma-separated pump levels (length 6, values 2-9) used to roll the world model forward when hour > 0.",
    ),
) -> PolicyEvaluationResponse:
    try:
        wm = get_forecast_world_model()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model unavailable: {e}") from e

    try:
        idx = _parse_patient_index(patient_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        state = _initial_state_tensor(wm, idx).to(wm.device)
    except IndexError:
        raise HTTPException(status_code=404, detail="Unknown patient_id for training split") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if hour > 0:
        if not p_levels:
            raise HTTPException(
                status_code=400,
                detail="p_levels query param is required when hour > 0",
            )
        try:
            seq = [int(x) for x in p_levels.split(",") if x != ""]
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"p_levels must be comma-separated integers: {e}") from e
        if len(seq) < hour:
            raise HTTPException(
                status_code=400,
                detail=f"p_levels must contain at least {hour} entries (got {len(seq)})",
            )
        for p in seq[:hour]:
            if p < 2 or p > 9:
                raise HTTPException(status_code=400, detail="each p_level must be between 2 and 9")
        rolled = state.unsqueeze(0)
        with torch.no_grad():
            for h in range(hour):
                rolled = wm.step(rolled, int(seq[h]))
        state = rolled.squeeze(0).to(wm.device)

    pid = patient_id.strip().upper()
    policy_path = _resolve_policy_weights()

    env = AbiomedRLEnv(
        world_model=wm,
        max_steps=6,
        action_space_type="continuous",
        reward_type="smooth",
        normalize_rewards=True,
        seed=42,
    )

    device = wm.device
    obs, _info = env.reset(options={"state": state})

    if policy_path is None:
        dist = _MOCK_DIST.get(pid, _MOCK_DIST["P001"])
        steps, total_reward, final_score, quality = _mock_rollout_optimal(wm, state)
        logger.info(
            "[policy_evaluation] source=mock patient_id=%s hour=%s reason=no_policy_checkpoint_found",
            pid,
            hour,
        )
        rollout = RolloutOut(
            id="R1",
            label="Mock optimal trajectory (no policy checkpoint)",
            quality=quality,
            totalReward=float(total_reward),
            finalScore=float(final_score),
            steps=[PolicyStepOut(**s) for s in steps],
        )
        return PolicyEvaluationResponse(
            patient_id=pid,
            source="mock",
            distribution=dist,
            rollout=rollout,
            detail="SMARTWEAN_POLICY_PATH / policy_abiomed.pth not found; using mock distribution and rollout.",
        )

    try:
        policy = _load_sac_policy(env, str(policy_path), device)
    except Exception as e:
        dist = _MOCK_DIST.get(pid, _MOCK_DIST["P001"])
        steps, total_reward, final_score, quality = _mock_rollout_optimal(wm, state)
        logger.info(
            "[policy_evaluation] source=mock patient_id=%s hour=%s reason=policy_load_failed error=%s",
            pid,
            hour,
            str(e),
        )
        rollout = RolloutOut(
            id="R1",
            label="Mock optimal trajectory (policy load failed)",
            quality=quality,
            totalReward=float(total_reward),
            finalScore=float(final_score),
            steps=[PolicyStepOut(**s) for s in steps],
        )
        return PolicyEvaluationResponse(
            patient_id=pid,
            source="mock",
            distribution=dist,
            rollout=rollout,
            detail=f"Policy load failed ({e}); using mock.",
        )

    dist = _discrete_distribution(policy, env, obs)
    env2 = AbiomedRLEnv(
        world_model=wm,
        max_steps=6,
        action_space_type="continuous",
        reward_type="smooth",
        normalize_rewards=True,
        seed=42,
    )
    obs2, _ = env2.reset(options={"state": state})
    steps, total_reward, final_score = _rollout_sac(policy, env2, obs2, max_steps=6, deterministic=True)
    quality = _quality_from_reward(total_reward)
    logger.info(
        "[policy_evaluation] source=sac patient_id=%s hour=%s policy_path=%s total_reward=%.6f final_score=%.6f",
        pid,
        hour,
        str(policy_path),
        float(total_reward),
        float(final_score),
    )

    rollout = RolloutOut(
        id="R1",
        label="SAC policy trajectory",
        quality=quality,
        totalReward=float(total_reward),
        finalScore=float(final_score),
        steps=[PolicyStepOut(**s) for s in steps],
    )
    return PolicyEvaluationResponse(
        patient_id=pid,
        source="sac",
        distribution=dist,
        rollout=rollout,
        detail=None,
    )
