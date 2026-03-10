import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useTheme, getHealthColor } from '../../context/ThemeContext';

export function HeartLevel2({ features, healthScore, compact = false }) {
  const { scheme, isDark } = useTheme();
  const [beat, setBeat] = useState(false);
  const [phase, setPhase] = useState(0);

  // Safely coerce feature values coming from backend
  const safeNumber = (v, fallback = 0) =>
    Number.isFinite(v) ? v : fallback;

  const rawBpm      = safeNumber(features?.HR, 80);
  const bpm         = rawBpm > 0 ? rawBpm : 0;
//   const bpm         = safeNumber(features?.HR, 80);
  const pulsatility = safeNumber(features?.pulsatility, 1.0);
  const map         = safeNumber(features?.MAP, 75);
  const lvedp       = safeNumber(features?.LVEDP, 12);

  const color    = getHealthColor(healthScore, scheme);
  const interval = bpm > 0
    ? Math.round(60000 / Math.min(220, bpm))
    : null;
//   const interval = Math.round(60000 / Math.max(30, Math.min(180, bpm)));

//   useEffect(() => {
//     const pulse = () => {
//       setBeat(true);
//       setPhase(p => (p + 1) % 4);
//       setTimeout(() => setBeat(false), 200);
//     };
//     pulse();
//     const timer = setInterval(pulse, interval);
//     return () => clearInterval(timer);
//   }, [interval]);

  useEffect(() => {
    if (!interval) return;        // no beat when bpm <= 0
    const pulse = () => {
        setBeat(true);
        setPhase(p => (p + 1) % 4);
        setTimeout(() => setBeat(false), 200);
    };
    pulse();
    const timer = setInterval(pulse, interval);
    return () => clearInterval(timer);
  }, [interval]);

  const lvColor   = lvedp > 18 ? scheme.critical : lvedp > 12 ? scheme.warning : scheme.good;
  const mapColor  = map < 60 ? scheme.critical : map < 70 ? scheme.warning : scheme.good;

  const bg      = isDark ? '#0F172A' : '#F8FAFC';
  const surface = isDark ? '#1E293B' : '#FFFFFF';
  const text    = isDark ? '#FFFFFF' : '#000000';
  // subtext: noticeably dimmer than primary — medium gray in dark mode, mid-dark gray in light mode
  const subtext = isDark ? '#9CA3AF' : '#4B5563';

  return (
    <div
      style={{ background: surface, borderColor: isDark ? '#334155' : '#E2E8F0' }}
      className="w-full rounded-2xl border p-5 select-none"
    >
      <div className="flex items-center justify-between mb-4">
        {/* <div className="flex-1 text-center"> */}
        <div>
          <div style={{ color: text }} className="text-m font-semibold">Cardiac Status</div>
          <div style={{ color: subtext }} className="text-xs mt-0.5">Live visualization</div>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ scale: beat ? 1.3 : 1, opacity: beat ? 1 : 0.6 }}
            transition={{ duration: 0.15 }}
            className="w-2 h-2 rounded-full"
            style={{ background: color }}
          />
          <span style={{ color: subtext }} className="text-xs">{Math.round(bpm)} bpm</span>
        </div>
      </div>

      <div className="flex justify-center mb-5">
        <motion.div
          animate={{ scale: beat ? 1.04 : 1 }}
          transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ filter: `drop-shadow(0 0 ${beat ? 20 : 10}px ${color}66)` }}
        >
          <AnatomicalHeart
            lvColor={lvColor}
            mapColor={mapColor}
            pulsatility={pulsatility}
            beat={beat}
            phase={phase}
            scheme={scheme}
            isDark={isDark}
            compact={compact}
          />
        </motion.div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between mb-1">
          <span style={{ color: subtext }} className="text-xs">Weaning Progress</span>
          <span style={{ color: color }} className="text-xs font-semibold">{healthScore}%</span>
        </div>
        <div style={{ background: bg }} className="h-2 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${healthScore}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
            className="h-full rounded-full"
          />
        </div>
      </div>
    </div>
  );
}

function AnatomicalHeart({ lvColor, mapColor, pulsatility, beat, phase, scheme, isDark, compact = false }) {
  const safePuls = Number.isFinite(pulsatility) && pulsatility > 0 ? pulsatility : 0;
  const dotCount = Math.max(0, Math.min(5, Math.floor(safePuls * 2)));

  const fillOpacity = 0.25 + Math.min(0.5, safePuls * 0.2);
  const bg = isDark ? '#0F172A' : '#F8FAFC';

  // Compact (sidebar): ~2/3 of full size (160x150 vs 240x225)
  const w = compact ? 160 : 240;
  const h = compact ? 150 : 225;

  return (
    <svg width={w} height={h} viewBox="0 0 160 150" fill="none">
      <defs>
        <radialGradient id="lvGrad" cx="50%" cy="50%">
          <stop offset="0%"   stopColor={lvColor}  stopOpacity="0.6" />
          <stop offset="100%" stopColor={lvColor}  stopOpacity="0.1" />
        </radialGradient>
        <radialGradient id="rvGrad" cx="50%" cy="50%">
          <stop offset="0%"   stopColor={mapColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={mapColor} stopOpacity="0.1" />
        </radialGradient>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path
        d="M80 138 C80 138 18 95 18 52 C18 35 30 22 47 22 C58 22 67 28 72 36 L80 48 L88 36 C93 28 102 22 113 22 C130 22 142 35 142 52 C142 95 80 138 80 138Z"
        fill="url(#lvGrad)" stroke={lvColor} strokeWidth="1.5" filter="url(#glow2)"
      />
      <path d="M80 48 L80 125" stroke={isDark ? '#475569' : '#CBD5E1'} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
      <ellipse cx="94" cy="85" rx="22" ry="32" fill={lvColor}  opacity={fillOpacity} />
      <ellipse cx="66" cy="82" rx="18" ry="28" fill={mapColor} opacity={fillOpacity * 0.8} />
      <path d="M88 36 C88 28 92 18 92 10 C92 6 95 4 98 4 C104 4 108 8 108 14 C108 22 104 28 100 32"
        stroke={mapColor} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M72 32 C72 24 68 14 60 10 C56 8 52 10 50 14"
        stroke={scheme.accent} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <line x1="80" y1="4" x2="80" y2="110" stroke="white" strokeWidth="1.5" opacity="0.7" />
      <circle cx="80" cy="80" r="4" fill="none" stroke="white" strokeWidth="1.2" opacity="0.8" />
      <circle cx="80" cy="80" r="1.5" fill="white" opacity="0.9" />
      {[...Array(dotCount)].map((_, i) => (
        <motion.circle
          key={i}
          cx={60 + i * 10}
          cy={beat ? 140 + Math.sin(i) * 3 : 142}
          r="1.5"
          fill={scheme.good}
          opacity={0.7}
          animate={{ cy: [142, 137, 142], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
        />
      ))}
      <text x="104" y="92" fill={isDark ? '#94A3B8' : '#64748B'} fontSize="7" textAnchor="middle">LV</text>
      <text x="58"  y="89" fill={isDark ? '#94A3B8' : '#64748B'} fontSize="7" textAnchor="middle">RV</text>
    </svg>
  );
}