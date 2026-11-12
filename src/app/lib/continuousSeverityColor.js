import { CHART_STATUS } from '../constants/chartStatusColors';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const x = n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${x(r)}${x(g)}${x(b)}`;
}

function lerpRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

const RGB_GREEN = hexToRgb(CHART_STATUS.normal);
const RGB_YELLOW = hexToRgb(CHART_STATUS.warning);
const RGB_RED = hexToRgb(CHART_STATUS.critical);

export const SEVERITY_FEATURES = ['MAP', 'HR', 'pulsatility'];

// Training-set standard deviations: the `std` array in backend/10min_1hr_all_data.npz.
const FEATURE_SD = { MAP: 12.008, pulsatility: 15.019, HR: 18.892 };

// Distance past the yellow band, in feature SDs, at which the line becomes fully green (healthy side) or fully red.
const SHADE_SDS = 1;

// Pure-yellow value bands, as [low side, high side] with each side [lo, hi]. These are the inverses of the
// penalties in backend/reward_func.py at the yellow scores and must change with them:
//   MAP: min_map_penalty 7(60 - x)/20 and hypertention_penalty (x - 106)/18, each in 1..3
//   pulsatility: pulsat_penalty 7(20 - x)/20 and (x - 50)/20, each = 5
//   HR: hr_penalty (x - 75)^2/250 - 1 = 3
const YELLOW_BANDS = {
  MAP: [[60 - 60 / 7, 60 - 20 / 7], [106 + 18, 106 + 54]],
  pulsatility: [[20 - 100 / 7, 20 - 100 / 7], [50 + 100, 50 + 100]],
  HR: [[75 - Math.sqrt(1000), 75 - Math.sqrt(1000)], [75 + Math.sqrt(1000), 75 + Math.sqrt(1000)]],
};

/**
 * Signed distance from the yellow band in feature SDs: 0 inside it, negative toward the healthy range,
 * positive past it. The worse of the low and high sides wins.
 */
export function severityZ(value, feature) {
  const [[lowLo, lowHi], [highLo, highHi]] = YELLOW_BANDS[feature];
  const sd = FEATURE_SD[feature];
  const low = value < lowLo ? (lowLo - value) / sd : value > lowHi ? -(value - lowHi) / sd : 0;
  const high = value > highHi ? (value - highHi) / sd : value < highLo ? -(highLo - value) / sd : 0;
  return Math.max(low, high);
}

/**
 * Green → yellow → red for MAP, HR and pulsatility, driven by the reward-function penalties.
 */
export function continuousSeverityColor(value, feature) {
  if (typeof value !== 'number' || Number.isNaN(value) || !YELLOW_BANDS[feature]) return CHART_STATUS.warning;
  const t = Math.max(-1, Math.min(1, severityZ(value, feature) / SHADE_SDS));
  return rgbToHex(t <= 0 ? lerpRgb(RGB_YELLOW, RGB_GREEN, -t) : lerpRgb(RGB_YELLOW, RGB_RED, t));
}
