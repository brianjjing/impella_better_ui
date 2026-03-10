import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ReferenceLine
} from 'recharts';
import { Activity, Star, BarChart2, TrendingUp, Eye, ArrowDown, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { policyDistributions, generateRollouts, featureConfigs } from '../data/mockData';
import { useLayoutContext } from '../components/Layout';

const PUMP_LABELS  = ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
const KEY_FEATURES = ['MAP', 'HR', 'LVEDP', 'pulsatility'];

// Color for the single R1 (most probable) trajectory
const R1_COLOR = '#10B981';

export default function PolicyEvaluation() {
  const { scheme, isDark, thresholds } = useTheme();
  const { patients, selectedPatientId } = useLayoutContext();
  const [activeTab, setActiveTab] = useState('distribution');
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);

  const bg        = isDark ? '#080E1A' : '#F4F6FA';
  const card      = isDark ? '#0C1526' : '#FFFFFF';
  const border    = isDark ? '#1A2740' : '#E2E8F0';
  const text      = isDark ? '#E2E8F0' : '#1E293B';
  const subtext   = isDark ? '#9CA3AF' : '#4B5563';
  const muted     = isDark ? '#1E293B' : '#F1F5F9';
  const gridColor = isDark ? '#1A2740' : '#E2E8F0';

  const patient  = patients.find(p => p.id === selectedPatientId);
  const dist     = policyDistributions[selectedPatientId] ?? policyDistributions['P001'] ?? [0.2, 0.2, 0.2, 0.2, 0.1, 0.05, 0.03, 0.02];
  const rollouts = useMemo(() => generateRollouts(selectedPatientId, patients), [selectedPatientId, patients]);

  // R1 is always the most probable rollout (first optimal trajectory)
  const r1 = rollouts[0];

  // Safe access for buildTrajData / radarData when no rollout yet
  const r1Steps = r1?.steps ?? [];
  const r1LastStep = r1Steps[r1Steps.length - 1];

  const policyData = PUMP_LABELS.map((label, i) => ({
    label,
    probability: dist[i] ?? 0,
    isMax: dist[i] === Math.max(...dist),
  }));

  const mostLikelyAction = PUMP_LABELS[dist.indexOf(Math.max(...dist))];
  const entropy          = (-dist.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0)).toFixed(3);
  const weaningDown      = dist.slice(0, 4).reduce((a, b) => a + b, 0) > 0.5;

  // Build trajectory data for R1 only
  const buildTrajData = (feature) =>
    r1Steps.map((step, si) => ({
      label: step.state.label ?? `T+${si + 1}h`,
      value: step.state[feature] ?? null,
    }));

  // Radar data for R1's final projected state
  const radarData = KEY_FEATURES.map(key => {
    const cfg  = featureConfigs[key];
    const norm = (v) => Math.min(100, Math.max(0, ((v - cfg.normalMin) / (cfg.normalMax - cfg.normalMin)) * 100));
    const val = r1LastStep?.state[key] ?? cfg.normalMin;
    return {
      feature: cfg.label.split(' ').slice(0, 2).join(' '),
      'Projected State': norm(val),
      'Normal Midpoint': 50,
    };
  });

  const PolicyBarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: card, borderColor: border }} className="rounded-xl border p-3 shadow-2xl">
        <div style={{ color: text }} className="text-sm font-semibold mb-1">{label}</div>
        <div style={{ color: scheme.primary }} className="text-xs">
          Probability: <span className="font-mono font-semibold">{((payload[0]?.value ?? 0) * 100).toFixed(1)}%</span>
        </div>
        <div style={{ color: subtext }} className="text-xs mt-1">Likelihood this pump level is recommended</div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div style={{ borderColor: border, background: card }} className="border-b px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <Activity size={16} style={{ color: scheme.primary }} />
        <div>
          <h1 style={{ color: text }} className="text-sm font-semibold">Weaning Policy Evaluation</h1>
          <p style={{ color: subtext }} className="text-xs">AI-guided weaning recommendations · action probabilities and predicted patient trajectories</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div style={{ background: scheme.primary + '18', color: scheme.primary, borderColor: scheme.primary + '44' }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs">
            <Star size={10} /> Recommended: {mostLikelyAction}
          </div>
          <span style={{ color: subtext }} className="text-xs">{patient?.name}</span>
        </div>
      </div>

      {/* Full-width main content (no right sidebar) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: bg }}>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Policy Certainty',
              color: scheme.accent,
              value: entropy,
              desc: 'Higher values indicate greater uncertainty in the recommendation',
              icon: BarChart2,
              bg: scheme.accent + '12',
            },
            {
              label: 'Recommended Pump Level',
              color: scheme.good,
              value: mostLikelyAction,
              desc: `${(Math.max(...dist) * 100).toFixed(0)}% probability — highest-confidence action`,
              icon: Star,
              bg: scheme.good + '12',
            },
            {
              label: 'Weaning Direction',
              color: scheme.primary,
              value: weaningDown ? 'Reducing ↓' : 'Maintaining →',
              desc: weaningDown ? 'AI recommends reducing pump support' : 'AI recommends maintaining current support',
              icon: weaningDown ? ArrowDown : ArrowRight,
              bg: scheme.primary + '12',
            },
          ].map(({ label, value, desc, color, icon: Icon, bg: ibg }) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: card, borderColor: color + '55' }}
              className="rounded-2xl border-2 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: ibg }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <span style={{ color: subtext }} className="text-xs font-medium">{label}</span>
              </div>
              <div style={{ color }} className="text-xl font-bold font-mono mb-0.5">{value}</div>
              <div style={{ color: subtext }} className="text-xs opacity-70">{desc}</div>
            </motion.div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'distribution', label: 'Action Probabilities',      icon: BarChart2 },
            { id: 'trajectory',   label: 'Patient State Trajectories', icon: TrendingUp },
            { id: 'radar',        label: 'Outcome Assessment',         icon: Eye },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{
                background:  activeTab === id ? scheme.primary + '22' : muted,
                borderColor: activeTab === id ? scheme.primary + '55' : border,
                color:       activeTab === id ? scheme.primary : subtext,
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all">
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* Action Probability Distribution */}
          {activeTab === 'distribution' && (
            <motion.div key="dist" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ background: card, borderColor: border }} className="rounded-xl border p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 style={{ color: text }} className="text-sm font-semibold">Action Probability Distribution</h2>
                  <p style={{ color: subtext }} className="text-xs mt-0.5">
                    Likelihood of each pump power level being recommended given the patient's current hemodynamic state
                  </p>
                </div>
                <div style={{ background: scheme.primary + '18', color: scheme.primary }} className="text-xs px-3 py-1.5 rounded-full">
                  P{patient?.deviceLevel} active
                </div>
              </div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={policyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.6} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: subtext, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: subtext, fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                    <ReferenceLine x={`P${patient?.deviceLevel}`} stroke={scheme.accent} strokeWidth={2} strokeDasharray="4 3"
                      label={{ value: 'Current', position: 'top', fill: scheme.accent, fontSize: 9 }} />
                    <Bar
                      dataKey="probability"
                      onMouseEnter={(_, index) => setHoveredBarIndex(index)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      shape={props => {
                        const d = policyData[props.index];
                        const isHovered = props.index === hoveredBarIndex;
                        const fill = d?.isMax ? scheme.good : scheme.primary;
                        const baseOpacity = d?.isMax ? 1 : 0.65;
                        return (
                          <rect
                            x={props.x}
                            y={props.y}
                            width={props.width}
                            height={props.height}
                            rx={6}
                            ry={6}
                            fill={fill}
                            opacity={isHovered ? 1 : baseOpacity}
                            style={{
                              transformBox: 'fill-box',
                              transformOrigin: 'bottom center',
                              transform: isHovered ? 'scaleY(1.07)' : 'scaleY(1)',
                              transition: 'transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease',
                              filter: isHovered
                                ? `drop-shadow(0 0 8px ${fill}99)`
                                : d?.isMax
                                  ? `drop-shadow(0 0 6px ${scheme.good}66)`
                                  : 'none',
                            }}
                          />
                        );
                      }}
                    />
                    <Tooltip
                      content={<PolicyBarTooltip />}
                      cursor={{ fill: 'transparent' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: scheme.good }} />
                  <span style={{ color: subtext }} className="text-xs">Recommended action</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: scheme.primary, opacity: 0.65 }} />
                  <span style={{ color: subtext }} className="text-xs">Alternative actions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 rounded" style={{ background: scheme.accent }} />
                  <span style={{ color: subtext }} className="text-xs">Current pump level</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Patient State Trajectories */}
          {activeTab === 'trajectory' && (
            <motion.div key="traj" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div style={{ background: card, borderColor: border }} className="rounded-xl border p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 style={{ color: text }} className="text-sm font-semibold">Patient State Trajectories</h2>
                    <p style={{ color: subtext }} className="text-xs mt-0.5">
                      Projected evolution of key hemodynamic parameters over the next 6 hours under the recommended weaning protocol
                    </p>
                  </div>
                  <div style={{ background: R1_COLOR + '18', color: R1_COLOR, borderColor: R1_COLOR + '44' }}
                    className="text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: R1_COLOR }} />
                    Most probable trajectory
                  </div>
                </div>

                {/* Reference lines legend */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 rounded" style={{ background: scheme.good + '66', borderTop: `1px dashed ${scheme.good}` }} />
                    <span style={{ color: subtext }} className="text-xs">Normal range boundaries</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {KEY_FEATURES.map(feature => {
                    const cfg  = featureConfigs[feature];
                    const thr  = thresholds[feature];
                    const data = buildTrajData(feature);
                    return (
                      <div key={feature}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                          <span style={{ color: subtext }} className="text-xs">{cfg.label} ({cfg.unit})</span>
                        </div>
                        <div style={{ height: 160 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.4} />
                              <XAxis dataKey="label" tick={{ fill: subtext, fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: subtext, fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
                              <ReferenceLine y={thr.normalMin} stroke={scheme.good + '55'} strokeDasharray="3 2" />
                              <ReferenceLine y={thr.normalMax} stroke={scheme.good + '55'} strokeDasharray="3 2" />
                              <Line
                                dataKey="value"
                                stroke={R1_COLOR}
                                strokeWidth={2.5}
                                dot={{ fill: R1_COLOR, r: 3, strokeWidth: 0 }}
                                connectNulls
                              />
                              <Tooltip content={({ active, payload, label: l }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div style={{ background: card, borderColor: border }} className="rounded-lg border p-2 shadow-xl text-xs">
                                    <div style={{ color: subtext }} className="mb-1 font-mono">{l}</div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: R1_COLOR }} />
                                      <span style={{ color: text }} className="font-mono">
                                        {cfg.label}: {Number(payload[0]?.value).toFixed(2)} {cfg.unit}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action sequence */}
                <div style={{ background: muted, borderColor: border }} className="mt-4 rounded-lg border p-3">
                  <div style={{ color: subtext }} className="text-xs font-medium mb-2">Projected Pump Level Sequence</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r1Steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span style={{ background: R1_COLOR + '22', color: R1_COLOR, borderColor: R1_COLOR + '44' }}
                          className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full border">
                          {step.actionLabel}
                        </span>
                        {i < r1Steps.length - 1 && (
                          <span style={{ color: subtext }} className="text-xs">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ color: subtext }} className="text-xs mt-1.5 opacity-70">
                    Pump levels at T+1h through T+{r1Steps.length}h under recommended protocol
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Outcome Assessment Radar */}
          {activeTab === 'radar' && (
            <motion.div key="radar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ background: card, borderColor: border }} className="rounded-xl border p-5">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 style={{ color: text }} className="text-sm font-semibold">Patient State Quality Radar</h2>
                  <p style={{ color: subtext }} className="text-xs mt-0.5">
                    Normalized final hemodynamic state after 6 hours under the recommended weaning protocol (0 = far below normal, 100 = far above normal, 50 = mid-normal)
                  </p>
                </div>
                <div style={{ background: R1_COLOR + '18', color: R1_COLOR, borderColor: R1_COLOR + '44' }}
                  className="text-xs px-3 py-1.5 rounded-full border">
                  Projected at T+6h
                </div>
              </div>
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 10, right: 60, left: 60, bottom: 10 }}>
                    <PolarGrid stroke={gridColor} />
                    <PolarAngleAxis dataKey="feature" tick={{ fill: subtext, fontSize: 11 }} />
                    <Radar
                      name="Normal Reference"
                      dataKey="Normal Midpoint"
                      stroke={scheme.primary + '44'}
                      fill="none"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />
                    <Radar
                      name="Projected Patient State"
                      dataKey="Projected State"
                      stroke={R1_COLOR}
                      fill={R1_COLOR}
                      fillOpacity={0.18}
                      strokeWidth={2.5}
                    />
                    <Legend formatter={v => <span style={{ color: subtext, fontSize: 11 }}>{v}</span>} />
                    <Tooltip content={({ active, payload, label: l }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div style={{ background: card, borderColor: border }} className="rounded-xl border p-3 shadow-xl text-xs">
                          <div style={{ color: text }} className="font-semibold mb-2">{l}</div>
                          {payload.map(p => (
                            <div key={p.name} className="flex justify-between gap-4">
                              <span style={{ color: p.stroke ?? subtext }}>{p.name}</span>
                              <span style={{ color: text }} className="font-mono">
                                {typeof p.value === 'number' ? p.value.toFixed(1) : '-'}%
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Outcome summary cards */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div style={{ background: muted, borderColor: border }} className="rounded-xl border p-3">
                  <div style={{ color: subtext }} className="text-xs font-medium mb-1">Projected Outcome Score</div>
                  <div style={{ color: R1_COLOR }} className="text-lg font-mono font-semibold">{(r1?.finalScore ?? 0).toFixed(0)}/100</div>
                  <div style={{ color: subtext }} className="text-xs opacity-70">at T+6h under recommended protocol</div>
                </div>
                <div style={{ background: muted, borderColor: border }} className="rounded-xl border p-3">
                  <div style={{ color: subtext }} className="text-xs font-medium mb-1">Cumulative Benefit Score</div>
                  <div style={{ color: scheme.accent }} className="text-lg font-mono font-semibold">{(r1?.totalReward ?? 0).toFixed(2)}</div>
                  <div style={{ color: subtext }} className="text-xs opacity-70">aggregated across all projected steps</div>
                </div>
                <div style={{ background: muted, borderColor: border }} className="rounded-xl border p-3">
                  <div style={{ color: subtext }} className="text-xs font-medium mb-1">Protocol Quality</div>
                  <div style={{ color: R1_COLOR }} className="text-lg font-semibold capitalize">{r1?.quality ?? '—'}</div>
                  <div style={{ color: subtext }} className="text-xs opacity-70">classification of projected trajectory</div>
                </div>
              </div>

              {/* Severity legend */}
              <div style={{ borderColor: border }} className="mt-4 pt-4 border-t flex items-center gap-6">
                <div style={{ color: subtext }} className="text-xs font-medium uppercase tracking-widest opacity-70">Severity Scale</div>
                <div className="flex gap-2.5 items-center">
                  <div className="w-2 rounded-full" style={{
                    height: 48,
                    background: `linear-gradient(to bottom, ${scheme.critical} 0%, ${scheme.warning} 50%, ${scheme.good} 100%)`,
                  }} />
                  <div className="flex flex-col justify-between" style={{ height: 48 }}>
                    <span style={{ color: scheme.critical }} className="text-xs font-medium">Critical</span>
                    <span style={{ color: scheme.warning  }} className="text-xs font-medium">Warning</span>
                    <span style={{ color: scheme.good     }} className="text-xs font-medium">Normal</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}