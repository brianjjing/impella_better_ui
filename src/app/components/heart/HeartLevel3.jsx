import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useTheme, getHealthColor, getSurfaces } from '../../context/ThemeContext';

export function HeartLevel3({ features, healthScore, compact = false }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(0);
  const { scheme, isDark } = useTheme();
  const color       = getHealthColor(healthScore, scheme);
  const bpm         = Math.max(30, Math.min(180, features.HR));
  const intervalMs  = 60000 / bpm;
  const pulsatility = features.pulsatility;

  const W = compact ? 200 : 340;
  const H = compact ? 180 : 300;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ecgHistory = new Array(W).fill(H * 0.85);
    let startTime = 0;
    const surf = getSurfaces(isDark);

    function drawHeart(cx, cy, size, scale, elapsed, isBeat) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.6);
      glow.addColorStop(0,   color + (isBeat ? '55' : '33'));
      glow.addColorStop(0.5, color + '18');
      glow.addColorStop(1,   color + '00');
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      const s = size / 16;
      for (let angle = 0; angle <= Math.PI * 2; angle += 0.02) {
        const x = s * 16 * Math.pow(Math.sin(angle), 3);
        const y = -s * (13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle));
        if (angle === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const fillGrad = ctx.createRadialGradient(-size * 0.2, -size * 0.1, 0, 0, 0, size * 1.1);
      fillGrad.addColorStop(0,   color + 'cc');
      fillGrad.addColorStop(0.6, color + '77');
      fillGrad.addColorStop(1,   color + '22');
      ctx.fillStyle = fillGrad;
      ctx.fill();

      ctx.shadowColor = color;
      ctx.shadowBlur = isBeat ? 24 : 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.ellipse(size * 0.25, size * 0.15, size * 0.28, size * 0.42, 0.15, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#0F172A' : surf.inputBg;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-size * 0.22, size * 0.12, size * 0.22, size * 0.35, -0.1, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#0F172A' : surf.inputBg;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.moveTo(0, -size * 1.15);
      ctx.lineTo(0, size * 0.55);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.8 / scale;
      ctx.setLineDash([4 / scale, 2 / scale]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, size * 0.3, 4 / scale, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'white';
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;

      const numP = Math.min(8, Math.floor(pulsatility * 3));
      for (let i = 0; i < numP; i++) {
        const pt = (elapsed / 1200 + i / numP) % 1;
        const px = Math.sin(pt * Math.PI * 2) * size * 0.2;
        const py = Math.cos(pt * Math.PI * 2) * size * 0.28 + size * 0.08;
        ctx.beginPath();
        ctx.arc(px, py, 2 / scale, 0, Math.PI * 2);
        ctx.fillStyle = scheme.accent + 'dd';
        ctx.fill();
      }
      ctx.restore();
    }

    function drawECG(history) {
      if (history.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      history.forEach((y, i) => {
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo((i / history.length) * W, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      const lastY = history[history.length - 1];
      ctx.beginPath();
      ctx.arc(W - 2, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function getECGSample(phase) {
      const p = phase % 1;
      if (p < 0.08) return Math.sin(p * Math.PI / 0.08) * 0.08;
      if (p < 0.2)  return 0;
      if (p < 0.24) return -Math.sin((p - 0.2) * Math.PI / 0.04) * 0.2;
      if (p < 0.30) return Math.sin((p - 0.24) * Math.PI / 0.06);
      if (p < 0.35) return -Math.sin((p - 0.30) * Math.PI / 0.05) * 0.12;
      if (p < 0.52) return Math.sin((p - 0.35) * Math.PI / 0.17) * 0.18;
      return 0;
    }

    function render(timestamp) {
      if (startTime === 0) startTime = timestamp;
      const elapsed   = timestamp - startTime;
      const beatPhase = (elapsed % intervalMs) / intervalMs;
      const isBeat    = beatPhase < 0.12;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = isDark ? '#080E1A' : surf.bg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.05)' : 'rgba(100,116,139,0.07)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      const ecgH   = compact ? 38 : 58;
      const ecgTop = H - ecgH - 6;
      const ecgMid = ecgTop + ecgH / 2;
      const amp    = ecgH * 0.38;

      ctx.fillStyle = isDark ? 'rgba(8,14,26,0.7)' : 'rgba(191,200,214,0.88)';
      ctx.fillRect(0, ecgTop - 2, W, ecgH + 4);
      ctx.beginPath();
      ctx.moveTo(0, ecgTop - 2); ctx.lineTo(W, ecgTop - 2);
      ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.12)';
      ctx.lineWidth = 0.5; ctx.stroke();

      ecgHistory.push(ecgMid - getECGSample(beatPhase) * amp);
      if (ecgHistory.length > W) ecgHistory.shift();

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, ecgTop - 2, W, ecgH + 4);
      ctx.clip();
      drawECG(ecgHistory);
      ctx.restore();

      ctx.fillStyle = isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)';
      ctx.font = `${compact ? 7 : 9}px monospace`;
      ctx.fillText(`ECG  ${Math.round(bpm)} bpm`, 6, ecgTop + 11);

      const hs = compact ? 44 : 74;
      const hx = W / 2;
      const hy = ecgTop / 2;
      const beatScale = isBeat ? 1.0 + 0.065 * (1 - beatPhase / 0.12) : 1.0;
      drawHeart(hx, hy, hs, beatScale, elapsed, isBeat);

      const ar = compact ? 14 : 22;
      const ax = W - ar - (compact ? 8 : 12);
      const ay = ar + (compact ? 8 : 12);
      ctx.beginPath();
      ctx.arc(ax, ay, ar, -Math.PI * 0.75, -Math.PI * 0.75 + (healthScore / 100) * Math.PI * 1.5);
      ctx.strokeStyle = color;
      ctx.lineWidth = compact ? 2.5 : 3.5;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(ax, ay, ar, -Math.PI * 0.75 + (healthScore / 100) * Math.PI * 1.5, -Math.PI * 0.75 + Math.PI * 1.5);
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = compact ? 2 : 3; ctx.stroke();
      ctx.fillStyle = isDark ? '#CBD5E1' : '#1E293B';
      ctx.font = `${compact ? 9 : 12}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${healthScore}`, ax, ay + (compact ? 4 : 5));
      ctx.textAlign = 'left';

      ctx.fillStyle = isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.4)';
      ctx.font = `${compact ? 7 : 9}px monospace`;
      ctx.fillText(`P${Math.round(features.pumpSpeed / 5000)} · PI ${pulsatility.toFixed(2)}`, 6, 14);

      animRef.current = requestAnimationFrame(render);
    }

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [W, H, bpm, intervalMs, pulsatility, color, scheme.accent, isDark, healthScore, features.pumpSpeed]);

  const statusText = healthScore >= 70 ? 'Stable Recovery' : healthScore >= 45 ? 'Monitoring' : 'Critical State';

  return (
    <div className="relative select-none">
      <canvas
        ref={canvasRef} width={W} height={H}
        className="rounded-xl block"
        style={{ boxShadow: `0 0 28px ${color}1A, 0 0 1px ${color}55` }}
      />
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="absolute left-4 right-4 flex justify-between items-end pointer-events-none"
          style={{ bottom: 70 }}>
          <div>
            <div style={{ color }} className="text-xs font-semibold tracking-widest uppercase">{statusText}</div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
