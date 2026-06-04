'''
python abiomed_env/evaluate_transformer.py
Evaluates the Transformer world model on the test set with 10 forward passes,
computing MSE, MAE, and CRPS (matching the LLM evaluation protocol).
'''
import sys
import os
import torch
import numpy as np
from scipy import stats

sys.path.insert(0, os.path.dirname(__file__))
from model import WorldModel
from config import model_kwargs_10min_1hr_full

DATA_PATH  = "/public/gormpo/10min_1hr_all_data.pkl"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "data", "10min_1hr_all_data_model.pth")
DEVICE     = "cuda:0"
NUM_SAMPLES = 10


def crps_gaussian(mu: np.ndarray, sigma: np.ndarray, obs: np.ndarray) -> float:
    sigma = np.maximum(sigma, 1e-8)
    z = (obs - mu) / sigma
    return float((sigma * (z * (2 * stats.norm.cdf(z) - 1)
                           + 2 * stats.norm.pdf(z)
                           - 1 / np.sqrt(np.pi))).mean())


def get_transformer_confidence(world_model, state, p_levels, num_samples=NUM_SAMPLES):
    """
    Run `num_samples` stochastic autoregressive rollouts (MC-Dropout) and return
    per-(hour, sub-step, feature) mean and std in **unnormalized** units.

    world_model : loaded WorldModel
    state       : torch.Tensor of shape (1, forecast_horizon, num_features), normalized
    p_levels    : list[int], length = number of hours to roll forward
    num_samples : number of stochastic trajectories

    Returns:
        mean_pred : np.ndarray (steps, forecast_horizon, num_features)
        std_pred  : np.ndarray (steps, forecast_horizon, num_features)
    """
    steps = len(p_levels)
    outputs = world_model.sample_autoregressive_multiple(
        state, steps=steps, custom_pl=list(p_levels), sample_size=num_samples
    )
    # outputs: list[sample_size] of list[steps] of tensors shape (1, forecast_horizon, num_features)

    # Stack into (sample_size, steps, forecast_horizon, num_features), on CPU
    # to mirror world_model.unnorm_output's normalization pattern (mean/std may
    # be numpy arrays or CPU tensors depending on how the pickle was saved).
    trajs = torch.stack(
        [torch.cat(traj, dim=0) for traj in outputs], dim=0
    ).detach().cpu()
    trajs_unnorm = trajs * world_model.std[world_model.columns] + world_model.mean[world_model.columns]

    mean_pred = trajs_unnorm.mean(dim=0).numpy()
    std_pred = trajs_unnorm.std(dim=0).numpy()
    return mean_pred, std_pred

def get_tranformer_metrics(mean_pred, std_pred, all_ys):

    mse_per  = ((mean_pred - all_ys) ** 2).mean(axis=(1, 2))   # (N,)
    mae_per  = np.abs(mean_pred - all_ys).mean(axis=(1, 2))    # (N,)
    crps_per = np.array([
        crps_gaussian(mean_pred[[i]], std_pred[[i]], all_ys[[i]])
        for i in range(len(all_ys))
    ])                                                           # (N,)

    print(f"\n=== Transformer test set metrics (n={len(all_ys)}, normalized space) ===")
    print(f"MSE:  {mse_per.mean():.6f} ± {mse_per.std():.6f}")
    print(f"MAE:  {mae_per.mean():.6f} ± {mae_per.std():.6f}")
    print(f"CRPS: {crps_per.mean():.6f} ± {crps_per.std():.6f}")
