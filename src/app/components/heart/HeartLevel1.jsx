import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useTheme, getHealthColor } from '../../context/ThemeContext';

export function HeartLevel1({ healthScore, heartRate, pulsatility, compact = false }) {
  const { scheme, isDark } = useTheme();
  const [beat, setBeat] = useState(false);
  const color = getHealthColor(healthScore, scheme);
  const bpm = Math.max(30, Math.min(180, heartRate));
  const interval = Math.round(60000 / bpm);

  useEffect(() => {
    const pulse = () => {
      setBeat(true);
      setTimeout(() => setBeat(false), 150);
    };
    pulse();
    const timer = setInterval(pulse, interval);
    return () => clearInterval(timer);
  }, [interval]);

  const size = compact ? 32 : 56;
  const statusLabel = healthScore >= 70 ? 'Stable' : healthScore >= 45 ? 'Monitoring' : 'Critical';
  const statusDesc  = healthScore >= 70 ? 'Heart recovering well' : healthScore >= 45 ? 'Under observation' : 'Needs immediate attention';

  // Medium gray in dark mode, mid-dark gray in light mode
  const subtext = isDark ? '#9CA3AF' : '#4B5563';

  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'p-3 rounded-xl bg-white/5 border border-white/10'}`}>
      <motion.div
        animate={{ scale: beat ? 1.22 : 1 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 ${beat ? 12 : 6}px ${color}88)` }}
      >
        <HeartSVG size={size} color={color} fill={color + '33'} pulsatility={pulsatility} />
      </motion.div>
      {!compact && (
        <div>
          <div style={{ color }} className="text-sm font-semibold tracking-wide">{statusLabel}</div>
          <div className="text-xs" style={{ color: subtext }}>{statusDesc}</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-xs font-mono" style={{ color }}>
              {bpm} <span style={{ color: subtext }}>bpm</span>
            </div>
            <div className="w-px h-3" style={{ backgroundColor: subtext }} />
            <div className="text-xs font-mono" style={{ color: subtext }}>
              PI: <span style={{ color }}>{pulsatility.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeartSVG({ size, color, fill, pulsatility }) {
  const progress = Math.min(1, Math.max(0, (pulsatility - 0.3) / 2.0));
  return (
    <svg width={size} height={size} viewBox="0 0 32 30" fill="none">
      <path
        d="M16 28 C16 28 2 18 2 10 C2 5.5 5.5 2 10 2 C12.5 2 14.8 3.2 16 5.1 C17.2 3.2 19.5 2 22 2 C26.5 2 30 5.5 30 10 C30 18 16 28 16 28Z"
        fill={fill} stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      <clipPath id={`hclip-${size}`}>
        <rect x="0" y={28 - progress * 26} width="32" height="30" />
      </clipPath>
      <path
        d="M16 28 C16 28 2 18 2 10 C2 5.5 5.5 2 10 2 C12.5 2 14.8 3.2 16 5.1 C17.2 3.2 19.5 2 22 2 C26.5 2 30 5.5 30 10 C30 18 16 28 16 28Z"
        fill={color + '55'} clipPath={`url(#hclip-${size})`}
      />
      <line x1="16" y1="3" x2="16" y2="20" stroke="white" strokeWidth="0.8" strokeDasharray="2 1" opacity="0.6" />
      <circle cx="16" cy="14" r="1.5" fill="white" opacity="0.8" />
    </svg>
  );
}
