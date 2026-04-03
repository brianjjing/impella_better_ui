import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Line } from 'react-chartjs-2';
import { MessageSquare, X, Users, Eye, Search } from 'lucide-react';
import { useTheme, getFeatureStatus } from '../context/ThemeContext';
import { featureConfigs, featureKeys } from '../data/mockData';
import { CHART_STATUS, chartStatusColor } from '../constants/chartStatusColors';
import { useLayoutContext } from '../components/Layout';

const PATIENT_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EC4899'];

function severitySegmentBorderColor(thr) {
  return ctx => {
    if (ctx.p0.skip || ctx.p1.skip) return undefined;
    const y = ctx.p1.parsed.y;
    if (y == null || typeof y !== 'number' || Number.isNaN(y)) return undefined;
    return chartStatusColor(getFeatureStatus(y, thr));
  };
}

function TimelineFeatureChart({
  mergedData,
  feature,
  featureAnnotations,
  hoveredLabel,
  setHoveredLabel,
  activePatientsData,
  thr,
  cfg,
  patients,
  isDark,
  gridColor,
  subtext,
  card,
  border,
  text,
}) {
  const labels = useMemo(() => mergedData.map(d => d.label), [mergedData]);

  const datasets = useMemo(
    () =>
      activePatientsData.map((p, pi) => {
        const lineColor = PATIENT_COLORS[pi] || cfg.color;
        return {
          label: p.name,
          patientId: p.id,
          data: mergedData.map(row => row[`${p.id}_${feature}`]),
          borderColor: CHART_STATUS.normal,
          borderWidth: pi === 0 ? 2.25 : 1.75,
          tension: 0,
          segment: {
            borderColor: severitySegmentBorderColor(thr),
            borderWidth: ctx => {
              if (ctx.p0.skip || ctx.p1.skip) return undefined;
              return pi === 0 ? 2.25 : 1.75;
            },
          },
          pointRadius: 5,
          pointHoverRadius: 5,
          spanGaps: true,
          pointBackgroundColor: ctx => {
            const v = ctx.raw;
            if (v == null || typeof v !== 'number') return 'transparent';
            return chartStatusColor(getFeatureStatus(v, thr));
          },
          pointBorderColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.85)',
          pointBorderWidth: 2.25,
          pointHoverBackgroundColor: ctx => {
            const v = ctx.raw;
            if (v == null || typeof v !== 'number') return 'transparent';
            return chartStatusColor(getFeatureStatus(v, thr));
          },
          pointHoverBorderColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.85)',
          pointHoverBorderWidth: 2.25,
        };
      }),
    [mergedData, feature, activePatientsData, thr, isDark, cfg.color],
  );

  const annotationEntries = useMemo(() => {
    const ann = {};
    featureAnnotations.forEach(a => {
      ann[`ann_${a.id}`] = {
        type: 'line',
        scaleID: 'x',
        value: a.label,
        borderColor: a.color,
        borderDash: [4, 2],
        borderWidth: 1,
      };
    });
    if (hoveredLabel) {
      ann.hoverLine = {
        type: 'line',
        scaleID: 'x',
        value: hoveredLabel,
        borderColor: subtext,
        borderWidth: 1,
        opacity: 0.3,
      };
    }
    return ann;
  }, [featureAnnotations, hoveredLabel, subtext]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      onHover: (event, _els, chart) => {
        const e = event?.native ?? event;
        if (!chart || !e) return;
        const pts = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, true);
        if (pts.length) {
          const i = pts[0].index;
          setHoveredLabel(mergedData[i]?.label ?? null);
        } else {
          setHoveredLabel(null);
        }
      },
      plugins: {
        legend: { display: false },
        annotation: {
          common: { drawTime: 'beforeDatasetsDraw' },
          annotations: annotationEntries,
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: card,
          titleColor: subtext,
          bodyColor: text,
          borderColor: border,
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: items => items[0]?.label ?? '',
            label: ctx => {
              const patId = ctx.dataset.patientId;
              const pat = patients.find(x => x.id === patId);
              const v = ctx.parsed.y;
              const formatted =
                typeof v === 'number' ? (v > 1000 ? Math.round(v) : v.toFixed(2)) : String(v);
              const unit = featureConfigs[feature]?.unit ?? '';
              return `${pat?.name?.split(' ')[0] ?? ''}: ${formatted} ${unit}`.trim();
            },
            labelColor: ctx => {
              const v = ctx.parsed.y;
              const c = chartStatusColor(getFeatureStatus(v, thr));
              return { borderColor: c, backgroundColor: c };
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: subtext, font: { size: 10 }, maxRotation: 0 },
          border: { display: false },
        },
        y: {
          grid: { color: gridColor, borderDash: [3, 3] },
          ticks: { color: subtext, font: { size: 10 } },
          border: { display: false },
        },
      },
    }),
    [
      annotationEntries,
      mergedData,
      setHoveredLabel,
      card,
      border,
      subtext,
      text,
      gridColor,
      thr,
      patients,
      feature,
    ],
  );

  return <Line data={{ labels, datasets }} options={options} />;
}

export default function PatientTimeline() {
  const { scheme, isDark, thresholds } = useTheme();
  const { patients, selectedPatientId } = useLayoutContext();
  const [comparisonIds, setComparisonIds] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [annotationForm, setAnnotationForm] = useState(null);
  const [annotationText, setAnnotationText] = useState('');
  const [expandedFeatures, setExpandedFeatures] = useState(new Set(['MAP', 'HR', 'LVEDP', 'pulsatility']));
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [hoveredLabel, setHoveredLabel] = useState(null);
  const [compareQuery, setCompareQuery] = useState('');
  const [showCompareSearch, setShowCompareSearch] = useState(false);
  const compareSearchRef = useRef(null);

  const bg = isDark ? '#080E1A' : '#F4F6FA';
  const card = isDark ? '#0C1526' : '#FFFFFF';
  const border = isDark ? '#1A2740' : '#E2E8F0';
  const text = isDark ? '#E2E8F0' : '#1E293B';
  const subtext = isDark ? '#9CA3AF' : '#4B5563';
  const muted = isDark ? '#1E293B' : '#F1F5F9';
  const gridColor = isDark ? '#1A2740' : '#E2E8F0';

  const allPatientIds = [selectedPatientId, ...comparisonIds];
  const activePatientsData = allPatientIds.map(id => patients.find(p => p.id === id)).filter(Boolean);

  const mergedData =
    activePatientsData[0]?.timeline.map((step, idx) => {
      const row = { label: step.label, timestamp: step.timestamp };
      activePatientsData.forEach(p => {
        const s = p.timeline[idx];
        if (s) featureKeys.forEach(k => { row[`${p.id}_${k}`] = s[k]; });
      });
      return row;
    }) || [];

  const displayedFeatures = showAllFeatures ? featureKeys : featureKeys.filter(k => expandedFeatures.has(k));

  const MAX_COMPARE = 2;
  const toggleComparison = id =>
    setComparisonIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });

  const compareCandidates = useMemo(() => {
    const q = compareQuery.trim().toLowerCase();
    const base = patients.filter(p => p.id !== selectedPatientId && p.timeline?.length);
    if (!q) return base.slice(0, 8);
    return base.filter(p => {
      const name = (p.name || '').toLowerCase();
      const mrn = (p.mrn || '').toLowerCase();
      const id = (p.id || '').toLowerCase();
      return name.includes(q) || mrn.includes(q) || id.includes(q);
    });
  }, [patients, selectedPatientId, compareQuery]);

  useEffect(() => {
    const onDown = e => {
      if (compareSearchRef.current && !compareSearchRef.current.contains(e.target)) {
        setShowCompareSearch(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const toggleFeature = k =>
    setExpandedFeatures(prev => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const addAnnotation = () => {
    if (!annotationForm || !annotationText.trim()) return;
    setAnnotations(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        patientId: selectedPatientId,
        feature: annotationForm.feature,
        label: annotationForm.label,
        text: annotationText.trim(),
        color: scheme.accent,
      },
    ]);
    setAnnotationText('');
    setAnnotationForm(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div style={{ borderColor: border, background: card }} className="border-b px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <div>
          <h1 style={{ color: text }} className="text-sm font-semibold">Patient Timeline</h1>
          <p style={{ color: subtext }} className="text-xs">Hourly physiological feature history · T-5 hrs → T-0 hrs</p>
        </div>
        <div className="h-6 w-px" style={{ background: border }} />
        <div ref={compareSearchRef} className="relative flex items-center gap-2 flex-1 min-w-0 max-w-xl">
          <Users size={14} style={{ color: subtext }} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div
              style={{
                background: muted,
                borderColor: showCompareSearch && compareQuery ? scheme.primary + '77' : border,
              }}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors">
              <Search size={12} style={{ color: subtext, flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search up to 2 patients by name or MRN to compare…"
                value={compareQuery}
                onChange={e => { setCompareQuery(e.target.value); setShowCompareSearch(true); }}
                onFocus={() => setShowCompareSearch(true)}
                style={{ background: 'transparent', color: text }}
                className="flex-1 min-w-0 text-xs outline-none"
              />
              {compareQuery && (
                <button
                  type="button"
                  onClick={() => { setCompareQuery(''); setShowCompareSearch(false); }}
                  style={{ color: subtext }}
                  className="p-0.5 rounded hover:opacity-70 flex-shrink-0"
                  aria-label="Clear search">
                  <X size={11} />
                </button>
              )}
            </div>
            <AnimatePresence>
              {showCompareSearch && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  style={{ background: card, borderColor: border }}
                  className="absolute left-0 right-0 top-full z-40 mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-xl">
                  {compareCandidates.length === 0 ? (
                    <div style={{ color: subtext }} className="px-3 py-2 text-xs">
                      {compareQuery.trim() ? 'No matching patients' : 'No other patients to compare'}
                    </div>
                  ) : (
                    compareCandidates.map((p, i) => {
                      const isOn = comparisonIds.includes(p.id);
                      const atLimit = comparisonIds.length >= MAX_COMPARE && !isOn;
                      const c = isOn
                        ? PATIENT_COLORS[comparisonIds.indexOf(p.id) + 1]
                        : PATIENT_COLORS[(i % (PATIENT_COLORS.length - 1)) + 1];
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={atLimit}
                          title={atLimit ? 'Remove a patient from comparison to add another' : undefined}
                          onClick={() => {
                            if (atLimit) return;
                            toggleComparison(p.id);
                            setCompareQuery('');
                            setShowCompareSearch(false);
                          }}
                          style={{
                            background: isOn ? c + '14' : 'transparent',
                            borderBottom: i < compareCandidates.length - 1 ? `1px solid ${border}` : 'none',
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-opacity ${atLimit ? 'opacity-45 cursor-not-allowed' : 'hover:opacity-90'}`}>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                          <span style={{ color: text }} className="font-medium truncate flex-1">{p.name}</span>
                          <span style={{ color: subtext }} className="font-mono flex-shrink-0">{p.mrn}</span>
                          {isOn && <span style={{ color: c }} className="flex-shrink-0 text-[10px]">On chart</span>}
                        </button>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {comparisonIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {comparisonIds.map((id, i) => {
                  const p = patients.find(x => x.id === id);
                  const c = PATIENT_COLORS[i + 1] || scheme.primary;
                  if (!p) return null;
                  return (
                    <span
                      key={id}
                      style={{
                        background: c + '22',
                        borderColor: c + '77',
                        color: c,
                      }}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full border text-[11px] font-medium">
                      {p.name.split(' ')[0]}
                      <button
                        type="button"
                        onClick={() => toggleComparison(id)}
                        style={{ color: c }}
                        className="p-0.5 rounded-full hover:opacity-70"
                        aria-label={`Remove ${p.name} from comparison`}>
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowAllFeatures(!showAllFeatures)}
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
              const featureAnnotations = annotations.filter(
                a => a.feature === feature && a.patientId === selectedPatientId,
              );

              return (
                <motion.div
                  key={feature}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{ background: card, borderColor: border }}
                  className="rounded-xl border overflow-hidden">
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
                        style={{ color: subtext }}
                        className="p-1 rounded hover:opacity-70 transition-opacity">
                        <MessageSquare size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="px-2 py-2" style={{ height: 140 }}>
                    <TimelineFeatureChart
                      mergedData={mergedData}
                      feature={feature}
                      featureAnnotations={featureAnnotations}
                      hoveredLabel={hoveredLabel}
                      setHoveredLabel={setHoveredLabel}
                      activePatientsData={activePatientsData}
                      thr={thr}
                      cfg={cfg}
                      patients={patients}
                      isDark={isDark}
                      gridColor={gridColor}
                      subtext={subtext}
                      card={card}
                      border={border}
                      text={text}
                    />
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
          <div style={{ background: card, borderColor: border }} className="h-full rounded-2xl border flex flex-col overflow-hidden">
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
                  <button
                    key={key}
                    onClick={() => !showAllFeatures && toggleFeature(key)}
                    style={{
                      background: isSelected && !showAllFeatures ? cfg.color + '18' : 'transparent',
                      borderColor: isSelected && !showAllFeatures ? cfg.color + '55' : 'transparent',
                      opacity: showAllFeatures ? 0.5 : 1,
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all text-left mb-0.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                    <span style={{ color: isSelected && !showAllFeatures ? cfg.color : subtext }} className="text-xs leading-tight">
                      {cfg.label.split(' ').slice(0, 2).join(' ')}
                    </span>
                  </button>
                );
              })}
            </div>

            <SeverityLegend border={border} subtext={subtext} />
          </div>
        </div>
      </div>

      {/* Annotation modal */}
      <AnimatePresence>
        {annotationForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setAnnotationForm(null)}>
            <motion.div
              initial={{ scale: 0.9, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 16 }}
              style={{ background: card, borderColor: border }}
              className="rounded-2xl border p-6 w-80 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: text }} className="text-sm font-semibold">Add Clinical Annotation</h3>
                <button onClick={() => setAnnotationForm(null)} style={{ color: subtext }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ color: subtext }} className="text-xs mb-3">
                Feature: <span style={{ color: scheme.accent }}>{featureConfigs[annotationForm.feature]?.label}</span>
                {' · '}
                <span className="font-mono">{annotationForm.label}</span>
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
                <button
                  onClick={() => setAnnotationForm(null)}
                  style={{ background: muted, color: subtext }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium">
                  Cancel
                </button>
                <button
                  onClick={addAnnotation}
                  style={{ background: scheme.primary, color: 'white' }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium">
                  Save Note
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SeverityLegend({ border, subtext }) {
  return (
    <div style={{ borderColor: border }} className="border-t p-3">
      <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-70">
        Severity
      </div>
      <div className="flex gap-2.5 items-stretch">
        <div
          className="w-2.5 rounded-full flex-shrink-0"
          style={{
            height: 80,
            background: `linear-gradient(to bottom, ${CHART_STATUS.critical} 0%, ${CHART_STATUS.warning} 40%, ${CHART_STATUS.normal} 100%)`,
          }}
        />
        <div className="flex flex-col justify-between" style={{ height: 80 }}>
          <span style={{ color: CHART_STATUS.critical }} className="text-xs font-medium">Critical</span>
          <span style={{ color: CHART_STATUS.warning }} className="text-xs font-medium">Warning</span>
          <span style={{ color: CHART_STATUS.normal }} className="text-xs font-medium">Normal</span>
        </div>
      </div>
    </div>
  );
}
