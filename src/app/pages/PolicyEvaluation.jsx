import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bar, Line, Radar } from 'react-chartjs-2';
import { useSearchParams } from 'react-router';
import { Activity, Star, BarChart2, TrendingUp, Eye, ArrowDown, ArrowRight, AlertCircle, Award, Coins } from 'lucide-react';
import { useTheme, getSurfaces } from '../context/ThemeContext';
import { featureConfigs } from '../data/mockData';
import { useLayoutContext } from '../components/Layout';
import { useSimulatorContext } from '../context/SimulatorContext';

const HOUR_OPTIONS = [0, 1, 2, 3, 4, 5];

const PUMP_LABELS  = ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];
const KEY_FEATURES = ['MAP', 'HR', 'LVEDP', 'pulsatility'];

// Color for the single R1 (most probable) trajectory
const R1_COLOR = '#10B981';

function PolicyDistributionChart({
  policyData,
  hoveredBarIndex,
  setHoveredBarIndex,
  patient,
  scheme,
  gridColor,
  subtext,
  card,
  border,
  text,
}) {
  const data = useMemo(
    () => ({
      labels: policyData.map(d => d.label),
      datasets: [
        {
          label: 'Probability',
          data: policyData.map(d => d.probability),
          borderRadius: 6,
          borderSkipped: false,
          backgroundColor: ctx => {
            const i = ctx.dataIndex;
            const d = policyData[i];
            const isHovered = hoveredBarIndex === i;
            const fill = d?.isMax ? scheme.good : scheme.primary;
            if (isHovered || d?.isMax) return fill;
            return fill.length === 7 ? `${fill}A6` : fill;
          },
        },
      ],
    }),
    [policyData, hoveredBarIndex, scheme],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      onHover: (event, elements) => {
        if (elements?.length) setHoveredBarIndex(elements[0].index);
        else setHoveredBarIndex(null);
      },
      plugins: {
        legend: { display: false },
        annotation: {
          common: { drawTime: 'beforeDatasetsDraw' },
          annotations:
            patient?.deviceLevel != null
              ? {
                  currentPump: {
                    type: 'line',
                    scaleID: 'x',
                    value: `P${patient.deviceLevel}`,
                    borderColor: scheme.accent,
                    borderWidth: 2,
                    borderDash: [4, 3],
                    label: {
                      display: true,
                      content: 'Current',
                      position: 'start',
                      color: scheme.accent,
                      font: { size: 9 },
                    },
                  },
                }
              : {},
        },
        tooltip: {
          backgroundColor: card,
          titleColor: text,
          bodyColor: scheme.primary,
          borderColor: border,
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: items => items[0]?.label ?? '',
            label: ctx => {
              const v = ctx.parsed.y;
              return `Probability: ${((v ?? 0) * 100).toFixed(1)}%`;
            },
            footer: () => 'Likelihood this pump level is recommended',
          },
          footerColor: subtext,
          footerFont: { size: 11 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: subtext, font: { size: 11 } },
          border: { display: false },
        },
        y: {
          min: 0,
          max: 1,
          grid: { color: gridColor, borderDash: [3, 3] },
          ticks: {
            color: subtext,
            font: { size: 10 },
            callback: v => `${(v * 100).toFixed(0)}%`,
          },
          border: { display: false },
        },
      },
    }),
    [patient, scheme, gridColor, subtext, card, border, text, setHoveredBarIndex],
  );

  return <Bar data={data} options={options} />;
}

function TrajectoryMiniChart({ data, cfg, thr, scheme, gridColor, subtext, card, border, text, R1_COLOR }) {
  const chartData = useMemo(
    () => ({
      labels: data.map(d => d.label),
      datasets: [
        {
          label: cfg.label,
          data: data.map(d => d.value),
          borderColor: R1_COLOR,
          borderWidth: 2.5,
          tension: 0,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: R1_COLOR,
          spanGaps: true,
        },
      ],
    }),
    [data, cfg.label, R1_COLOR],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        annotation: {
          common: { drawTime: 'beforeDatasetsDraw' },
          annotations: {
            refMin: {
              type: 'line',
              scaleID: 'y',
              value: thr.normalMin,
              borderColor: `${scheme.good}55`,
              borderDash: [3, 2],
              borderWidth: 1,
            },
            refMax: {
              type: 'line',
              scaleID: 'y',
              value: thr.normalMax,
              borderColor: `${scheme.good}55`,
              borderDash: [3, 2],
              borderWidth: 1,
            },
          },
        },
        tooltip: {
          backgroundColor: card,
          titleColor: subtext,
          bodyColor: text,
          borderColor: border,
          callbacks: {
            title: items => items[0]?.label ?? '',
            label: ctx => {
              const v = ctx.parsed.y;
              return `${cfg.label}: ${typeof v === 'number' ? v.toFixed(2) : '-'} ${cfg.unit}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor, borderDash: [3, 3] },
          ticks: { color: subtext, font: { size: 9 } },
          border: { display: false },
        },
        y: {
          grid: { color: gridColor, borderDash: [3, 3] },
          ticks: { color: subtext, font: { size: 9 } },
          border: { display: false },
        },
      },
    }),
    [thr, scheme, gridColor, subtext, card, border, text, cfg.label, cfg.unit],
  );

  return <Line data={chartData} options={options} />;
}

function OutcomeRadarChart({ radarData, scheme, gridColor, subtext, card, border, text, R1_COLOR }) {
  const data = useMemo(
    () => ({
      labels: radarData.map(d => d.feature),
      datasets: [
        {
          label: 'Normal Reference',
          data: radarData.map(d => d['Normal Midpoint']),
          borderColor: `${scheme.primary}44`,
          borderDash: [4, 3],
          fill: false,
          pointRadius: 0,
          borderWidth: 1,
        },
        {
          label: 'Projected Patient State',
          data: radarData.map(d => d['Projected State']),
          borderColor: R1_COLOR,
          backgroundColor: `${R1_COLOR}2E`,
          fill: true,
          borderWidth: 2.5,
        },
      ],
    }),
    [radarData, scheme.primary, R1_COLOR],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: { color: subtext, font: { size: 11 }, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: card,
          titleColor: text,
          bodyColor: text,
          borderColor: border,
          callbacks: {
            title: items => items[0]?.label ?? '',
            label: ctx => {
              const v = ctx.parsed.r;
              return `${ctx.dataset.label}: ${typeof v === 'number' ? v.toFixed(1) : '-'}%`;
            },
          },
        },
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false },
          grid: { color: gridColor },
          pointLabels: { color: subtext, font: { size: 11 } },
          border: { display: false },
        },
      },
    }),
    [gridColor, subtext, card, border, text],
  );

  return <Radar data={data} options={options} />;
}

export default function PolicyEvaluation() {
  const { scheme, isDark, thresholds } = useTheme();
  const { patients, selectedPatientId } = useLayoutContext();
  const { getStateFor } = useSimulatorContext();
  const [activeTab, setActiveTab] = useState('distribution');
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [policyApi, setPolicyApi] = useState(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialHour = (() => {
    const raw = searchParams.get('hour');
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 && n <= 5 ? n : 0;
  })();
  const [selectedHour, setSelectedHour] = useState(initialHour);
  /** Set when /api/policy_evaluation fails — UI then falls back to mockData.generateRollouts (placeholder trajectories). */
  const [policyFetchError, setPolicyFetchError] = useState(null);

  const simulatorState = getStateFor(selectedPatientId);
  const simulatorHasResult = Boolean(simulatorState?.hasResult);

  // T+0h is always available; T+1h..T+5h require a completed simulator run.
  const isHourEnabled = h => h === 0 || simulatorHasResult;

  // Sync URL ?hour= with selected hour so external links (e.g., from the
  // simulator dot click) preselect the correct hour.
  useEffect(() => {
    const raw = searchParams.get('hour');
    const n = raw == null ? null : parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 5 && n !== selectedHour && isHourEnabled(n)) {
      setSelectedHour(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, simulatorHasResult]);

  useEffect(() => {
    const current = searchParams.get('hour');
    if (current !== String(selectedHour)) {
      const next = new URLSearchParams(searchParams);
      next.set('hour', String(selectedHour));
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHour]);

  // If the simulator is reset / cleared while the user is on a forecast hour,
  // snap back to T+0h.
  useEffect(() => {
    if (selectedHour > 0 && !simulatorHasResult) {
      setSelectedHour(0);
    }
  }, [selectedHour, simulatorHasResult]);

  const s         = getSurfaces(isDark);
  const bg        = s.bg;
  const card      = s.card;
  const border    = s.border;
  const text      = s.text;
  const subtext   = s.subtext;
  const muted     = s.muted;
  const gridColor = s.gridColor;

  const patient  = patients.find(p => p.id === selectedPatientId);

  useEffect(() => {
    if (!selectedPatientId) return;
    let cancelled = false;
    setPolicyApi(null);
    setPolicyLoading(true);
    setPolicyFetchError(null);
    const params = new URLSearchParams({
      patient_id: selectedPatientId,
      hour: String(selectedHour),
    });
    if (simulatorState?.lastRunPumpSequence?.length === 6) {
      params.set('p_levels', simulatorState.lastRunPumpSequence.join(','));
    }
    fetch(`/api/policy_evaluation?${params.toString()}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = typeof data?.detail === 'string' ? data.detail : Array.isArray(data?.detail)
            ? data.detail.map(d => d.msg).join('; ')
            : res.statusText;
          throw new Error(msg || 'Policy evaluation unavailable');
        }
        return data;
      })
      .then(data => {
        if (!cancelled) {
          setPolicyApi(data);
          setPolicyFetchError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPolicyApi(null);
          setPolicyFetchError(err?.message || 'Network or server error');
        }
      })
      .finally(() => {
        if (!cancelled) setPolicyLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedPatientId, selectedHour, simulatorState?.lastRunPumpSequence]);

  const hasPolicyData = Boolean(
    policyApi?.distribution?.length === 8 && policyApi?.rollout?.steps?.length,
  );

  const dist = hasPolicyData ? policyApi.distribution : [0, 0, 0, 0, 0, 0, 0, 0];

  const r1FromApi = policyApi?.rollout
    ? {
        id: policyApi.rollout.id,
        label: policyApi.rollout.label,
        quality: policyApi.rollout.quality,
        totalReward: policyApi.rollout.totalReward,
        finalScore: policyApi.rollout.finalScore,
        steps: policyApi.rollout.steps,
      }
    : null;

  const r1 = r1FromApi;

  const r1Steps = r1?.steps ?? [];
  const r1LastStep = r1Steps[r1Steps.length - 1];

  const maxProb = Math.max(...dist);
  const policyData = PUMP_LABELS.map((label, i) => ({
    label,
    probability: dist[i] ?? 0,
    isMax: hasPolicyData && maxProb > 0 && dist[i] === maxProb,
  }));

  const mostLikelyAction = hasPolicyData ? PUMP_LABELS[dist.indexOf(maxProb)] : '—';
  const entropy = hasPolicyData
    ? (-dist.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0)).toFixed(3)
    : '—';
  const weaningDown = hasPolicyData && dist.slice(0, 4).reduce((a, b) => a + b, 0) > 0.5;

  // Build trajectory data for R1 only
  const buildTrajData = (feature) =>
    r1Steps.map((step, si) => ({
      label: step.state.label ?? `T+${si + 1}h`,
      value: step.state[feature] ?? null,
    }));

  // Radar: neutral 50 / mid-normal when waiting for API (flat placeholder ring)
  const radarData = KEY_FEATURES.map(key => {
    const cfg  = featureConfigs[key];
    const norm = (v) => Math.min(100, Math.max(0, ((v - cfg.normalMin) / (cfg.normalMax - cfg.normalMin)) * 100));
    const val = hasPolicyData && r1LastStep?.state[key] != null
      ? r1LastStep.state[key]
      : (cfg.normalMin + cfg.normalMax) / 2;
    return {
      feature: cfg.label.split(' ').slice(0, 2).join(' '),
      'Projected State': hasPolicyData ? norm(val) : 50,
      'Normal Midpoint': 50,
    };
  });

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
            <Star size={10} /> Recommended: {hasPolicyData ? mostLikelyAction : '—'}
          </div>
          <span style={{ color: subtext }} className="text-xs">{patient?.name}</span>
          {policyLoading && (
            <span style={{ color: subtext }} className="text-xs">Loading policy…</span>
          )}
          {!policyLoading && policyApi?.source === 'mock' && (
            <span
              title={policyApi?.detail || 'Using mock distribution / rollout (no SAC checkpoint or load failed)'}
              style={{ color: scheme.warning }}
              className="text-xs cursor-help border rounded-full px-2 py-0.5"
            >
              Mock policy
            </span>
          )}
          {!policyLoading && policyApi?.source === 'sac' && (
            <span
              style={{ color: scheme.good, borderColor: scheme.good + '44' }}
              className="text-xs border rounded-full px-2 py-0.5"
            >
              SAC policy
            </span>
          )}
        </div>
      </div>

      {policyFetchError && (
        <div
          style={{ background: scheme.critical + '18', borderColor: scheme.critical + '55', color: text }}
          className="mx-4 mt-3 px-4 py-2.5 rounded-lg border text-xs flex items-start gap-2 flex-shrink-0"
        >
          <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: scheme.critical }} />
          <div>
            <span className="font-semibold">Policy API unavailable — charts stay empty until the server responds successfully.</span>
            <span style={{ color: subtext }} className="block mt-1">{policyFetchError}</span>
            <span style={{ color: subtext }} className="block mt-1 opacity-90">
              Ensure the FastAPI server is running on port 8000, the world model + dataset paths resolve, and this patient id exists in the training split (e.g. try P001).
            </span>
          </div>
        </div>
      )}

      {/* Full-width main content (no right sidebar) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: bg }}>

        {/* Hour selector */}
        <div className="flex items-stretch gap-2">
          {HOUR_OPTIONS.map(h => {
            const enabled = isHourEnabled(h);
            const active = selectedHour === h;
            return (
              <button
                key={h}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && setSelectedHour(h)}
                title={
                  enabled
                    ? `Evaluate at T+${h}h`
                    : 'Run the full simulator forecast to enable this hour'
                }
                style={{
                  background: active ? scheme.primary + '22' : (enabled ? card : muted),
                  borderColor: active ? scheme.primary + '88' : border,
                  color: active ? scheme.primary : (enabled ? text : subtext),
                  opacity: enabled ? 1 : 0.5,
                  cursor: enabled ? 'pointer' : 'not-allowed',
                }}
                className="flex-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all">
                T+{h}h
              </button>
            );
          })}
        </div>
        {!simulatorHasResult && (
          <p style={{ color: subtext }} className="text-xs -mt-2">
            T+1h…T+5h unlock once the full forecast is run on the Simulator page.
          </p>
        )}

        {/* Key Metrics Row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Recommended Pump Level',
              color: scheme.good,
              value: mostLikelyAction,
              desc: hasPolicyData
                ? `${(maxProb * 100).toFixed(0)}% probability — highest-confidence action`
                : 'Awaiting API response',
              icon: Star,
              bg: scheme.good + '12',
            },
            {
              label: 'Weaning Direction',
              color: scheme.primary,
              value: hasPolicyData ? (weaningDown ? 'Reducing ↓' : 'Maintaining →') : '—',
              desc: hasPolicyData
                ? (weaningDown ? 'AI recommends reducing pump support' : 'AI recommends maintaining current support')
                : 'Awaiting API response',
              icon: hasPolicyData ? (weaningDown ? ArrowDown : ArrowRight) : ArrowRight,
              bg: scheme.primary + '12',
            },
            {
            label: 'Reward',                                                                                        
            color: scheme.accent,                                                                                   
            value: hasPolicyData && r1?.totalReward != null ? Number(r1.totalReward).toFixed(2) : '—',              
            desc: hasPolicyData
              ? 'Cumulative reward across the projected trajectory'
              : 'Awaiting API response',
            icon: Coins,                                                                                            
            bg: scheme.accent + '12',                                                                                                                                                            
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
                <PolicyDistributionChart
                  policyData={policyData}
                  hoveredBarIndex={hoveredBarIndex}
                  setHoveredBarIndex={setHoveredBarIndex}
                  patient={patient}
                  scheme={scheme}
                  gridColor={gridColor}
                  subtext={subtext}
                  card={card}
                  border={border}
                  text={text}
                />
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
                          <TrajectoryMiniChart
                            data={data}
                            cfg={cfg}
                            thr={thr}
                            scheme={scheme}
                            gridColor={gridColor}
                            subtext={subtext}
                            card={card}
                            border={border}
                            text={text}
                            R1_COLOR={R1_COLOR}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                  
                {/* Turn this */}
                {/* Action sequence
                <div style={{ background: muted, borderColor: border }} className="mt-4 rounded-lg border p-3">
                  <div style={{ color: subtext }} className="text-xs font-medium mb-2">Projected Pump Level Sequence</div>
                  <div className="flex items-center gap-1.5 flex-wrap min-h-[1.5rem]">
                    {hasPolicyData ? (
                      r1Steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span style={{ background: R1_COLOR + '22', color: R1_COLOR, borderColor: R1_COLOR + '44' }}
                            className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full border">
                            {step.actionLabel}
                          </span>
                          {i < r1Steps.length - 1 && (
                            <span style={{ color: subtext }} className="text-xs">→</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <span style={{ color: subtext }} className="text-xs font-mono">—</span>
                    )}
                  </div>
                  <div style={{ color: subtext }} className="text-xs mt-1.5 opacity-70">
                    {hasPolicyData
                      ? `Pump levels at T+1h through T+${r1Steps.length}h under recommended protocol`
                      : 'Loads when policy evaluation data is available'}
                  </div>
                </div> */}
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
                <OutcomeRadarChart
                  radarData={radarData}
                  scheme={scheme}
                  gridColor={gridColor}
                  subtext={subtext}
                  card={card}
                  border={border}
                  text={text}
                  R1_COLOR={R1_COLOR}
                />
              </div>

              {/* Outcome summary cards */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div style={{ background: muted, borderColor: border }} className="rounded-xl border p-3">
                  <div style={{ color: subtext }} className="text-xs font-medium mb-1">Projected Outcome Score</div>
                  <div style={{ color: R1_COLOR }} className="text-lg font-mono font-semibold">
                    {hasPolicyData && r1?.finalScore != null ? `${Number(r1.finalScore).toFixed(0)}/100` : '—'}
                  </div>
                  <div style={{ color: subtext }} className="text-xs opacity-70">at T+6h under recommended protocol</div>
                </div>
                <div style={{ background: muted, borderColor: border }} className="rounded-xl border p-3">
                  <div style={{ color: subtext }} className="text-xs font-medium mb-1">Cumulative Benefit Score</div>
                  <div style={{ color: scheme.accent }} className="text-lg font-mono font-semibold">
                    {hasPolicyData && r1?.totalReward != null ? Number(r1.totalReward).toFixed(2) : '—'}
                  </div>
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