"""SAC policy wrapper — same as impella_ui (inference + training hooks)."""
import numpy as np
import torch
import torch.nn as nn

from copy import deepcopy


class SACPolicy(nn.Module):
    def __init__(
        self,
        actor,
        critic1,
        critic2,
        actor_optim,
        critic1_optim,
        critic2_optim,
        action_space,
        dist,
        tau=0.005,
        gamma=0.99,
        alpha=0.2,
        device="cpu",
    ):
        super().__init__()

        self.actor = actor
        self.critic1, self.critic1_old = critic1, deepcopy(critic1)
        self.critic1_old.eval()
        self.critic2, self.critic2_old = critic2, deepcopy(critic2)
        self.critic2_old.eval()

        self.actor_optim = actor_optim
        self.critic1_optim = critic1_optim
        self.critic2_optim = critic2_optim

        self.action_space = action_space
        self.dist = dist

        self._tau = tau
        self._gamma = gamma

        self._is_auto_alpha = False
        if isinstance(alpha, tuple):
            self._is_auto_alpha = True
            self._target_entropy, self._log_alpha, self._alpha_optim = alpha
            self._alpha = self._log_alpha.detach().exp()
        else:
            self._alpha = alpha

        self.__eps = np.finfo(np.float32).eps.item()

        self._device = device

    def train(self):
        self.actor.train()
        self.critic1.train()
        self.critic2.train()

    def eval(self):
        self.actor.eval()
        self.critic1.eval()
        self.critic2.eval()

    def _sync_weight(self):
        for o, n in zip(self.critic1_old.parameters(), self.critic1.parameters()):
            o.data.copy_(o.data * (1.0 - self._tau) + n.data * self._tau)
        for o, n in zip(self.critic2_old.parameters(), self.critic2.parameters()):
            o.data.copy_(o.data * (1.0 - self._tau) + n.data * self._tau)

    def forward(self, obs, deterministic=False):
        dist = self.actor.get_dist(obs)
        if deterministic:
            action = dist.mode()
        else:
            action = dist.rsample()
        log_prob = dist.log_prob(action)

        action_scale = torch.tensor((self.action_space.high - self.action_space.low) / 2, device=action.device)
        squashed_action = torch.tanh(action)
        log_prob = log_prob - torch.log(action_scale * (1 - squashed_action.pow(2)) + self.__eps).sum(
            -1, keepdim=True
        )

        return squashed_action, log_prob

    def sample_action(self, obs, deterministic=False):
        action, _ = self(obs, deterministic)
        return action.cpu().detach().numpy()

    def action_distribution(self, obs, p_levels=None):
        """
        Compute a probability distribution over discrete p-levels (default: 2–10).

        Reimplements the continuous branch of rl_env._action_to_p_level to derive
        the normalization of p-levels from the action space bounds, then computes
        the probability mass assigned to each p-level's bin by integrating the
        actor's base Gaussian distribution (in pre-tanh space) via the Normal CDF.

        Mapping (mirrors _action_to_p_level continuous branch):
            unnorm_pl(tanh_action) = tanh_action * std_pl + mean_pl
            p_level = int(clip(unnorm_pl(tanh_action), 2, 10))

        Bins (by truncation, matching int() used in _action_to_p_level):
            p = p_min : (-∞,  norm_pl(p_min + 1))   — lower tail clipped to p_min
            p = k     : [norm_pl(k),  norm_pl(k+1))  — interior bins
            p = p_max : [norm_pl(p_max), +∞)          — upper tail clipped to p_max

        Args:
            obs:      Observation tensor (same format as sample_action).
            p_levels: List of integer p-levels to evaluate. Defaults to range(2, 11).

        Returns:
            dict:
                'p_levels'      – list[int]
                'probabilities' – np.ndarray [..., len(p_levels)], sums to 1 along last dim
        """
        if p_levels is None:
            p_levels = list(range(2, 11))

        p_min, p_max = min(p_levels), max(p_levels)

        with torch.no_grad():
            dist = self.actor.get_dist(obs)

            device = next(self.actor.parameters()).device

            # Derive unnorm_pl / norm_pl from action space bounds.
            # action_space.low  = normalize_pl(p_min) = (p_min - mean_pl) / std_pl
            # action_space.high = normalize_pl(p_max) = (p_max - mean_pl) / std_pl
            low  = float(self.action_space.low.flat[0])
            high = float(self.action_space.high.flat[0])
            std_pl  = (p_max - p_min) / (high - low)
            mean_pl = p_min - low * std_pl

            def norm_pl(p):
                """Map integer p-level → normalized (tanh-output) action value."""
                return (p - mean_pl) / std_pl

            def to_pretanh(v):
                """Convert a normalized action value to pre-tanh space via atanh."""
                if v == float('-inf'):
                    return torch.tensor(float('-inf'), device=device)
                if v == float('inf'):
                    return torch.tensor(float('inf'), device=device)
                vt = torch.tensor(v, dtype=torch.float32, device=device)
                return torch.atanh(vt.clamp(-1 + 1e-6, 1 - 1e-6))

            # Compute probability mass per p-level bin using Normal CDF.
            # The base distribution (pre-tanh Gaussian) is used directly.
            # For Independent(Normal, 1) the CDF is the product of marginal CDFs.
            probs = []
            for pl in p_levels:
                lower_norm = float('-inf') if pl == p_min else norm_pl(pl)
                upper_norm = float('inf')  if pl == p_max else norm_pl(pl + 1)

                lower_z = to_pretanh(lower_norm)
                upper_z = to_pretanh(upper_norm)

                mu    = dist.mean          # [..., action_dim]
                sigma = dist.stddev        # [..., action_dim]
                base  = torch.distributions.Normal(mu, sigma)

                cdf_upper = base.cdf(upper_z.expand_as(mu)) if upper_z.isfinite() else torch.ones_like(mu)
                cdf_lower = base.cdf(lower_z.expand_as(mu)) if lower_z.isfinite() else torch.zeros_like(mu)

                # Product over action dims (independent Gaussians)
                prob = (cdf_upper - cdf_lower).prod(dim=-1)
                probs.append(prob)

            probs_tensor = torch.stack(probs, dim=-1)          # [..., num_p_levels]
            # Renormalize in case of numerical drift or truncated tails
            probs_normalized = probs_tensor / probs_tensor.sum(dim=-1, keepdim=True).clamp(min=self.__eps)

        return {
            "p_levels":      p_levels,
            "probabilities": probs_normalized.cpu().numpy(),
        }

    def learn(self, data):
        obs, actions, next_obs, terminals, rewards = (
            data["observations"],
            data["actions"],
            data["next_observations"],
            data["terminals"],
            data["rewards"],
        )

        rewards = torch.as_tensor(rewards).to(self._device)
        terminals = torch.as_tensor(terminals).to(self._device)

        q1, q2 = self.critic1(obs, actions).flatten(), self.critic2(obs, actions).flatten()
        with torch.no_grad():
            next_actions, next_log_probs = self(next_obs)
            next_q = torch.min(
                self.critic1_old(next_obs, next_actions), self.critic2_old(next_obs, next_actions)
            ) - self._alpha * next_log_probs
            target_q = rewards.flatten() + self._gamma * (1 - terminals.flatten()) * next_q.flatten()
        critic1_loss = ((q1 - target_q).pow(2)).mean()
        self.critic1_optim.zero_grad()
        torch.nn.utils.clip_grad_norm_(self.critic1.parameters(), max_norm=10.0)
        critic1_loss.backward()
        self.critic1_optim.step()
        critic2_loss = ((q2 - target_q).pow(2)).mean()
        self.critic2_optim.zero_grad()
        critic2_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.critic2.parameters(), max_norm=10.0)
        self.critic2_optim.step()

        a, log_probs = self(obs)
        q1a, q2a = self.critic1(obs, a).flatten(), self.critic2(obs, a).flatten()
        actor_loss = (self._alpha * log_probs.flatten() - torch.min(q1a, q2a)).mean()
        self.actor_optim.zero_grad()
        actor_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.parameters(), max_norm=10.0)
        self.actor_optim.step()

        entropy = -log_probs.mean()

        if self._is_auto_alpha:
            log_probs = log_probs.detach() + self._target_entropy
            alpha_loss = -(self._log_alpha * log_probs).mean()
            self._alpha_optim.zero_grad()
            alpha_loss.backward()
            self._alpha_optim.step()
            self._alpha = self._log_alpha.detach().exp()

        self._sync_weight()

        result = {
            "loss/actor": actor_loss.item(),
            "loss/critic1": critic1_loss.item(),
            "loss/critic2": critic2_loss.item(),
            "entropy": entropy.mean().item(),
        }

        if self._is_auto_alpha:
            result["loss/alpha"] = alpha_loss.item()
            result["alpha"] = self._alpha.item()

        return result, {}
