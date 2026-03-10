import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea
} from 'recharts';
import { MessageSquare, X, Users, Eye } from 'lucide-react';
import { useTheme, getFeatureStatus } from '../context/ThemeContext';
import { featureConfigs, featureKeys } from '../data/mockData';
import { useLayoutContext } from '../components/Layout';

const PATIENT_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EC4899'];

export default function PatientTimeline() {
  const { scheme, isDark, thresholds } = useTheme();
  const { patients, selectedPatientId } = useLayoutContext();
  const [comparisonIds, setComparisonIds]     = useState([]);
  const [annotations, setAnnotations]         = useState([]);
  const [annotationForm, setAnnotationForm]   = useState(null);
  const [annotationText, setAnnotationText]   = useState('');
  const [expandedFeatures, setExpandedFeatures] = useState(new Set(['MAP', 'HR', 'LVEDP', 'pulsatility']));
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [hoveredLabel, setHoveredLabel]       = useState(null);

  const bg       = isDark ? '#080E1A' : '#F4F6FA';
  const card     = isDark ? '#0C1526' : '#FFFFFF';
  const border   = isDark ? '#1A2740' : '#E2E8F0';
  const text     = isDark ? '#E2E8F0' : '#1E293B';
  const subtext  = isDark ? '#9CA3AF' : '#4B5563';
  const muted    = isDark ? '#1E293B' : '#F1F5F9';
  const gridColor= isDark ? '#1A2740' : '#E2E8F0';

  const allPatientIds     = [selectedPatientId, ...comparisonIds];
  const activePatientsData = allPatientIds.map(id => patients.find(p => p.id === id)).filter(Boolean);

  const mergedData = activePatientsData[0]?.timeline.map((step, idx) => {
    const row = { label: step.label, timestamp: step.timestamp };
    activePatientsData.forEach(p => {
      const s = p.timeline[idx];
      if (s) featureKeys.forEach(k => { row[`${p.id}_${k}`] = s[k]; });
    });
    return row;
  }) || [];

  const displayedFeatures = showAllFeatures ? featureKeys : featureKeys.filter(k => expandedFeatures.has(k));

  const toggleComparison = (id) =>
    setComparisonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev.slice(0, 2), id]);

  const toggleFeature = (k) =>
    setExpandedFeatures(prev => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });

  const addAnnotation = () => {
    if (!annotationForm || !annotationText.trim()) return;
    setAnnotations(prev => [...prev, {
      id: Date.now().toString(),
      patientId: selectedPatientId,
      feature: annotationForm.feature,
      label: annotationForm.label,
      text: annotationText.trim(),
      color: scheme.accent,
    }]);
    setAnnotationText('');
    setAnnotationForm(null);
  };

  const ChartTooltip = ({ active, payload, label, feature }) => {
    if (!active || !payload?.length) return null;
    const thr = thresholds[feature];
    return (
      <div style={{ background: card, borderColor: border }} className="rounded-xl border p-3 shadow-2xl min-w-[160px]">
        <div style={{ color: subtext }} className="text-xs mb-2 font-mono">{label}</div>
        {payload.map(p => {
          const patId = p.dataKey.split('_')[0];
          const pat   = patients.find(x => x.id === patId);
          const status = getFeatureStatus(p.value, thr);
          const statusColor = status === 'normal' ? scheme.good : status === 'warning' ? scheme.warning : scheme.critical;
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                <span style={{ color: subtext }} className="text-xs">{pat?.name.split(' ')[0]}</span>
              </div>
              <div>
                <span style={{ color: statusColor }} className="text-xs font-mono font-semibold">
                  {typeof p.value === 'number' ? (p.value > 1000 ? Math.round(p.value) : p.value.toFixed(2)) : p.value}
                </span>
                <span style={{ color: subtext }} className="text-xs ml-1">{featureConfigs[feature]?.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div style={{ borderColor: border, background: card }} className="border-b px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <div>
          <h1 style={{ color: text }} className="text-sm font-semibold">Patient Timeline</h1>
          <p style={{ color: subtext }} className="text-xs">1-hour physiological feature history · T-5h → T0h</p>
        </div>
        <div className="h-6 w-px" style={{ background: border }} />
        <div className="flex items-center gap-2">
          <Users size={14} style={{ color: subtext }} />
          <span style={{ color: subtext }} className="text-xs">Compare:</span>
          {patients.filter(p => p.id !== selectedPatientId).map((p, i) => {
            const isOn = comparisonIds.includes(p.id);
            return (
              <button key={p.id} onClick={() => toggleComparison(p.id)}
                style={{
                  background:   isOn ? PATIENT_COLORS[i + 1] + '22' : muted,
                  borderColor:  isOn ? PATIENT_COLORS[i + 1] + '77' : border,
                  color:        isOn ? PATIENT_COLORS[i + 1] : subtext,
                }}
                className="px-2 py-0.5 rounded-full border text-xs transition-all">
                {p.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowAllFeatures(!showAllFeatures)}
            style={{ background: muted, color: subtext }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80">
            <Eye size={12} />
            {showAllFeatures ? 'Show selected' : 'Show all features'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Charts area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: bg }}>
          <AnimatePresence>
            {displayedFeatures.map((feature, idx) => {
              const cfg = featureConfigs[feature];
              const thr = thresholds[feature];
              const featureAnnotations = annotations.filter(a => a.feature === feature && a.patientId === selectedPatientId);

              return (
                <motion.div key={feature} layout
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ delay: idx * 0.04 }}
                  style={{ background: card, borderColor: border }} className="rounded-xl border overflow-hidden">

                  <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: border }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                      <span style={{ color: text }} className="text-sm font-semibold">{cfg.label}</span>
                      <span style={{ color: subtext }} className="text-xs">({cfg.unit})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div style={{ color: subtext }} className="text-xs hidden md:block opacity-60">
                        Normal: {thr.normalMin}–{thr.normalMax}
                      </div>
                      <button
                        onClick={() => setAnnotationForm({ feature, label: mergedData[mergedData.length - 1]?.label || 'T0h' })}
                        style={{ color: subtext }} className="p-1 rounded hover:opacity-70 transition-opacity">
                        <MessageSquare size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="px-2 py-2" style={{ height: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mergedData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                        onMouseMove={e => e.activeLabel && setHoveredLabel(e.activeLabel)}
                        onMouseLeave={() => setHoveredLabel(null)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} strokeOpacity={0.6} />
                        <XAxis dataKey="label" tick={{ fill: subtext, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: subtext, fontSize: 10 }} axisLine={false} tickLine={false} width={36} />

                        <ReferenceArea y1={thr.normalMin}  y2={thr.normalMax}  fill={scheme.good    + '12'} />
                        <ReferenceArea y1={thr.warningMin} y2={thr.normalMin}  fill={scheme.warning + '10'} ifOverflow="visible" />
                        <ReferenceArea y1={thr.normalMax}  y2={thr.warningMax} fill={scheme.warning + '10'} ifOverflow="visible" />
                        <ReferenceLine y={thr.normalMin} stroke={scheme.good + '55'} strokeDasharray="4 3" />
                        <ReferenceLine y={thr.normalMax} stroke={scheme.good + '55'} strokeDasharray="4 3" />

                        {featureAnnotations.map(ann => (
                          <ReferenceLine key={ann.id} x={ann.label} stroke={ann.color} strokeDasharray="4 2"
                            label={{ value: '📌', position: 'insideTopLeft', fontSize: 10 }} />
                        ))}

                        <Tooltip content={props => <ChartTooltip {...props} feature={feature} />} />

                        {activePatientsData.map((p, pi) => (
                          <Line key={p.id} dataKey={`${p.id}_${feature}`}
                            stroke={PATIENT_COLORS[pi] || cfg.color}
                            strokeWidth={pi === 0 ? 2 : 1.5}
                            dot={props => {
                              const val = props.value;
                              const status = getFeatureStatus(val, thr);
                              const dotColor = status === 'normal' ? scheme.good : status === 'warning' ? scheme.warning : scheme.critical;
                              return <circle key={props.key} cx={props.cx} cy={props.cy} r={pi === 0 ? 4 : 3}
                                fill={dotColor} stroke={card} strokeWidth={1.5} />;
                            }}
                            activeDot={{ r: 6, stroke: PATIENT_COLORS[pi] || cfg.color, strokeWidth: 2 }}
                            connectNulls />
                        ))}

                        {hoveredLabel && (
                          <ReferenceLine x={hoveredLabel} stroke={subtext} strokeOpacity={0.3} strokeWidth={1} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="px-4 pb-2.5">
                    <p style={{ color: subtext }} className="text-xs opacity-70">{cfg.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {displayedFeatures.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div style={{ color: subtext }} className="text-sm mb-2">No features selected</div>
                <p style={{ color: subtext }} className="text-xs opacity-60">Select features from the panel on the right</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel — Feature Selector */}
        <div className="flex-shrink-0 p-2 pl-0" style={{ width: 196 }}>
          <div style={{ background: card, borderColor: border }}
            className="h-full rounded-2xl border flex flex-col overflow-hidden">
            <div style={{ borderColor: border }} className="border-b px-3 py-3">
              <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold">Features</div>
              <div style={{ color: subtext }} className="text-xs mt-0.5 opacity-60">
                {showAllFeatures ? 'All shown' : `${expandedFeatures.size} selected`}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {featureKeys.map(key => {
                const cfg = featureConfigs[key];
                const isSelected = expandedFeatures.has(key);
                return (
                  <button key={key} onClick={() => !showAllFeatures && toggleFeature(key)}
                    style={{
                      background:  isSelected && !showAllFeatures ? cfg.color + '18' : 'transparent',
                      borderColor: isSelected && !showAllFeatures ? cfg.color + '55' : 'transparent',
                      opacity: showAllFeatures ? 0.5 : 1,
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all text-left mb-0.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                    <span style={{ color: isSelected && !showAllFeatures ? cfg.color : subtext }}
                      className="text-xs leading-tight">{cfg.label.split(' ').slice(0, 2).join(' ')}</span>
                  </button>
                );
              })}
            </div>

            <SeverityLegend scheme={scheme} border={border} subtext={subtext} />
          </div>
        </div>
      </div>

      {/* Annotation modal */}
      <AnimatePresence>
        {annotationForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setAnnotationForm(null)}>
            <motion.div initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 16 }}
              style={{ background: card, borderColor: border }}
              className="rounded-2xl border p-6 w-80 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: text }} className="text-sm font-semibold">Add Clinical Annotation</h3>
                <button onClick={() => setAnnotationForm(null)} style={{ color: subtext }}><X size={16} /></button>
              </div>
              <div style={{ color: subtext }} className="text-xs mb-3">
                Feature: <span style={{ color: scheme.accent }}>{featureConfigs[annotationForm.feature]?.label}</span>
                {' · '}<span className="font-mono">{annotationForm.label}</span>
              </div>
              <textarea
                value={annotationText}
                onChange={e => setAnnotationText(e.target.value)}
                placeholder="Enter clinical note..."
                style={{ background: muted, borderColor: border, color: text, resize: 'none' }}
                className="w-full rounded-lg border p-3 text-sm h-24 outline-none mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => setAnnotationForm(null)}
                  style={{ background: muted, color: subtext }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium">Cancel</button>
                <button onClick={addAnnotation}
                  style={{ background: scheme.primary, color: 'white' }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium">Save Note</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SeverityLegend({ scheme, border, subtext }) {
  return (
    <div style={{ borderColor: border }} className="border-t p-3">
      <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-70">
        Severity
      </div>
      <div className="flex gap-2.5 items-stretch">
        <div className="w-2.5 rounded-full flex-shrink-0" style={{
          height: 80,
          background: `linear-gradient(to bottom, ${scheme.critical} 0%, ${scheme.warning} 40%, ${scheme.good} 100%)`,
        }} />
        <div className="flex flex-col justify-between" style={{ height: 80 }}>
          <span style={{ color: scheme.critical }} className="text-xs font-medium">Critical</span>
          <span style={{ color: scheme.warning  }} className="text-xs font-medium">Warning</span>
          <span style={{ color: scheme.good     }} className="text-xs font-medium">Normal</span>
        </div>
      </div>
    </div>
  );
}
