import { continuousSeverityColor } from './continuousSeverityColor';

const STOP_COUNT = 40;

/**
 * Draws line strokes with per-segment linear gradients where each stop's color
 * matches the *interpolated* y-value at that position along the segment (not
 * just RGB blend between endpoints). Default Chart.js line is hidden via borderWidth: 0.
 */
export const gradientSeverityLinePlugin = {
  id: 'gradientSeverityLine',

  beforeDatasetDraw(chart, args) {
    const meta = args.meta;
    if (meta.type !== 'line') return;

    const dataset = chart.data.datasets[args.index];
    const thr = dataset.severityThreshold;
    const lineW = dataset.gradientLineWidth;
    if (thr == null || lineW == null || lineW <= 0) return;

    const points = meta.data;
    const data = dataset.data;
    if (!points?.length || !data?.length) return;

    const { ctx } = chart;
    const { left, top, width, height } = chart.chartArea;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, width, height);
    ctx.clip();

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      if (p0.skip || p1.skip) continue;

      const v0 = data[i];
      const v1 = data[i + 1];
      if (typeof v0 !== 'number' || typeof v1 !== 'number' || Number.isNaN(v0) || Number.isNaN(v1)) {
        continue;
      }

      const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
      for (let s = 0; s <= STOP_COUNT; s++) {
        const u = s / STOP_COUNT;
        const y = v0 + u * (v1 - v0);
        g.addColorStop(u, continuousSeverityColor(y, thr));
      }

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = g;
      ctx.lineWidth = lineW;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    ctx.restore();
  },
};
