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

/**
 * Continuous 0..1 "stress" from feature value and thresholds.
 * 0 ≈ center of normal band; 1 ≈ far into warning/critical.
 */
export function stress01(value, thr) {
  if (value == null || typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  const { normalMin, normalMax, warningMin, warningMax } = thr;
  const center = (normalMin + normalMax) / 2;
  const lo = Math.min(warningMin, normalMin);
  const hi = Math.max(warningMax, normalMax);
  const span = hi - lo;
  if (span <= 0) return 0.5;
  const u = (value - lo) / span;
  const uc = (center - lo) / span;
  const dist = Math.abs(u - uc);
  return Math.min(1, dist * 2.05);
}

/**
 * Linear ramp in RGB: stress 0 → pure green, 0.5 → pure yellow, 1 → pure red.
 */
export function continuousSeverityColor(value, thr) {
  const t = stress01(value, thr);
  if (t <= 0.5) {
    return rgbToHex(lerpRgb(RGB_GREEN, RGB_YELLOW, t / 0.5));
  }
  return rgbToHex(lerpRgb(RGB_YELLOW, RGB_RED, (t - 0.5) / 0.5));
}
