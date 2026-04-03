/**
 * High-saturation status colors for charts (dots, bands, legends).
 * Intentionally brighter than theme palette for clinical readability on graphs.
 */
export const CHART_STATUS = {
  normal: '#4ADE80',
  warning: '#FB923C',
  critical: '#F87171',
};

/** Map getFeatureStatus() result to a chart color */
export function chartStatusColor(status) {
  if (status === 'normal') return CHART_STATUS.normal;
  if (status === 'warning') return CHART_STATUS.warning;
  return CHART_STATUS.critical;
}
