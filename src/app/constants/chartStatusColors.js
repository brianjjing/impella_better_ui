/**
 * Discrete + ramp anchors: pure RGB green (best) → pure yellow (mid) → pure red (worst).
 * Continuous charts interpolate linearly in RGB between these three.
 */
export const CHART_STATUS = {
  normal: '#00FF00',
  warning: '#FFFF00',
  critical: '#FF0000',
};

/** Map getFeatureStatus() result to a chart color */
export function chartStatusColor(status) {
  if (status === 'normal') return CHART_STATUS.normal;
  if (status === 'warning') return CHART_STATUS.warning;
  return CHART_STATUS.critical;
}
