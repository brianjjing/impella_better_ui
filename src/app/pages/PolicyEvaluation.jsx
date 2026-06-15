import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { Bar } from 'react-chartjs-2';
import { useSearchParams } from 'react-router';
import { Activity, Star, AlertCircle, Award } from 'lucide-react';
import { useTheme, getSurfaces } from '../context/ThemeContext';
import { useLayoutContext } from '../components/Layout';
import { useSimulatorContext } from '../context/SimulatorContext';

const HOUR_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

const PUMP_LABELS  = ['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'];

function PolicyDistributionChart({
  policyData,
  hoveredBarIndex,
  setHoveredBarIndex,
  scheme,
  gridColor,
  subtext,
  card,
  border,
  text,
  baselinePumpLabel,
  baselineLabelWord,
}) {
  const baselinePumpProb = useMemo(
    () => (baselinePumpLabel
      ? policyData.find(d => d.label === baselinePumpLabel)?.probability ?? 0
      : 0),
    [baselinePumpLabel, policyData],
  );
  const recommendedPumpItem = useMemo(() => policyData.find(d => d.isMax), [policyData]);
  const recommendedPumpLabel = recommendedPumpItem?.label ?? null;
  const recommendedPumpProb = recommendedPumpItem?.probability ?? 0;
  const labelsOverlap = Boolean(
    baselinePumpLabel && recommendedPumpLabel && baselinePumpLabel === recommendedPumpLabel,
  );

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
            const sameBar =
              baselinePumpLabel &&
              recommendedPumpLabel &&
              baselinePumpLabel === recommendedPumpLabel &&
              d?.label === baselinePumpLabel;
            const useRecommendedColor = Boolean(d?.isMax || sameBar);
            const fill = useRecommendedColor ? scheme.good : scheme.primary;
            if (isHovered || useRecommendedColor) return fill;
            return fill.length === 7 ? `${fill}A6` : fill;
          },
        },
      ],
    }),
    [policyData, hoveredBarIndex, scheme, baselinePumpLabel, recommendedPumpLabel],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      // Extra top padding when the combined Recommended / + / baseline label stacks 3 lines.
      layout: { padding: { top: labelsOverlap ? 36 : 16 } },
      onHover: (event, elements) => {
        if (elements?.length) setHoveredBarIndex(elements[0].index);
        else setHoveredBarIndex(null);
      },
      plugins: {
        legend: { display: false },
        annotation: {
          clip: false,
          common: { drawTime: 'afterDatasetsDraw' },
          annotations: (() => {
            const ann = {};
            const labelStyle = {
              type: 'label',
              backgroundColor: 'transparent',
              font: { size: 10, weight: 'bold' },
              padding: 2,
              position: { x: 'center', y: 'end' },
            };
            if (labelsOverlap && recommendedPumpLabel) {
              ann.overlapLabel = {
                ...labelStyle,
                xValue: recommendedPumpLabel,
                yValue: recommendedPumpProb,
                yAdjust: -4,
                content: ['Recommended', '+', baselineLabelWord],
                color: scheme.good,
              };
            } else {
              if (baselinePumpLabel) {
                ann.baselineLabel = {
                  ...labelStyle,
                  xValue: baselinePumpLabel,
                  yValue: baselinePumpProb,
                  yAdjust: -4,
                  content: baselineLabelWord,
                  color: scheme.primary,
                };
              }
              if (recommendedPumpLabel) {
                ann.recommendedLabel = {
                  ...labelStyle,
                  xValue: recommendedPumpLabel,
                  yValue: recommendedPumpProb,
                  yAdjust: -4,
                  content: 'Recommended',
                  color: scheme.good,
                };
              }
            }
            return ann;
          })(),
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
            stepSize: 0.2,
            callback: v => `${(v * 100).toFixed(0)}%`,
          },
          border: { display: false },
        },
      },
    }),
    [scheme, gridColor, subtext, card, border, text, setHoveredBarIndex, baselinePumpLabel, baselinePumpProb, baselineLabelWord, recommendedPumpLabel, recommendedPumpProb, labelsOverlap],
  );

  return <Bar data={data} options={options} />;
}

export default function PolicyEvaluation() {
  const { scheme, isDark } = useTheme();
  const { patients, selectedPatientId } = useLayoutContext();
  const { getStateFor } = useSimulatorContext();
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [policyApi, setPolicyApi] = useState(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialHour = (() => {
    const raw = searchParams.get('hour');
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 && n <= 6 ? n : 0;
  })();
  const [selectedHour, setSelectedHour] = useState(initialHour);
  /** Set when /api/policy_evaluation fails — UI then falls back to mockData.generateRollouts (placeholder trajectories). */
  const [policyFetchError, setPolicyFetchError] = useState(null);

  const simulatorState = getStateFor(selectedPatientId);
  const simulatorHasResult = Boolean(simulatorState?.hasResult);
  const horizonHours = simulatorState?.horizonHours ?? 6;

  // Hour 0 is the current patient state and is always available. Hours
  // 1..horizonHours unlock with a completed simulator run; hours beyond
  // the horizon stay gated regardless of forecast state.
  const isHourEnabled = h => h === 0 || (simulatorHasResult && h <= horizonHours);

  // Sync URL ?hour= with selected hour so external links (e.g., from the
  // simulator dot click) preselect the correct hour.
  useEffect(() => {
    const raw = searchParams.get('hour');
    const n = raw == null ? null : parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 6 && n !== selectedHour && isHourEnabled(n)) {
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
  // or the horizon shrinks below the selected hour, snap back to Hour 0.
  useEffect(() => {
    if (selectedHour > 0 && (!simulatorHasResult || selectedHour > horizonHours)) {
      setSelectedHour(0);
    }
  }, [selectedHour, simulatorHasResult, horizonHours]);

  const s         = getSurfaces(isDark);
  const bg        = s.bg;
  const card      = s.card;
  const border    = s.border;
  const text      = s.text;
  const subtext   = s.subtext;
  const muted     = s.muted;
  const gridColor = s.gridColor;

  const patient  = patients.find(p => p.id === selectedPatientId);

  const baselinePumpLevel = useMemo(() => {
    if (selectedHour >= 1) {
      const seq = simulatorState?.lastRunPumpSequence;
      if (seq?.length >= selectedHour) return seq[selectedHour - 1];
      return null;
    }
    return typeof patient?.deviceLevel === 'number' ? patient.deviceLevel : null;
  }, [selectedHour, simulatorState?.lastRunPumpSequence, patient?.deviceLevel]);

  const baselinePumpLabel = baselinePumpLevel != null ? `P${baselinePumpLevel}` : null;
  const baselineLabelWord = selectedHour >= 1 ? 'Simulated' : 'Current';

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

  const maxProb = Math.max(...dist);
  const policyData = PUMP_LABELS.map((label, i) => ({
    label,
    probability: dist[i] ?? 0,
    isMax: hasPolicyData && maxProb > 0 && dist[i] === maxProb,
  }));

  const mostLikelyAction = hasPolicyData ? PUMP_LABELS[dist.indexOf(maxProb)] : '—';
  const recommendedLevel = hasPolicyData ? dist.indexOf(maxProb) + 2 : null;
  const pumpLevelScore =
    hasPolicyData && policyApi?.rollout?.finalScore != null
      ? Number(policyApi.rollout.finalScore).toFixed(1)
      : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div style={{ borderColor: border, background: s.sidebar }} className="border-b px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <Activity size={16} style={{ color: scheme.primary }} />
        <div>
          <h1 style={{ color: text }} className="text-sm font-semibold">Weaning Policy Evaluation</h1>
          <p style={{ color: subtext }} className="text-xs">Success Probability Distribution of P-Levels</p>
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

      {/* Horizontally scrollable page body: holds a usable minimum width and scrolls
          instead of compressing the boxes and graphs when the window is dragged thin. */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="h-full min-w-[900px] flex flex-col">

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
              <div key={h} className="flex-1 relative group">
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => enabled && setSelectedHour(h)}
                  title={enabled ? (h === 0 ? 'Evaluate at Current Hour' : `Evaluate at Hour ${h}`) : ''}
                  style={{
                    background: active ? scheme.primary + '22' : (enabled ? card : muted),
                    borderColor: active ? scheme.primary + '88' : border,
                    color: active ? scheme.primary : (enabled ? text : subtext),
                    opacity: enabled ? 1 : 0.5,
                    cursor: enabled ? 'pointer' : 'not-allowed',
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all">
                  {h === 0 ? 'Current Hour' : `Hour ${h}`}
                </button>
                {!enabled && (
                  <div
                    style={{ background: card, borderColor: border, color: text }}
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 whitespace-nowrap px-2.5 py-1.5 rounded-lg border shadow-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-75">
                    Run the simulator for this hour to evaluate it!
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {simulatorHasResult && horizonHours < 6 && (
          <p style={{ color: subtext }} className="text-xs -mt-2">
            Hour {horizonHours + 1}{horizonHours + 1 < 6 ? `…Hour 6` : ''} {horizonHours + 1 < 6 ? 'are' : 'is'} outside the simulator horizon.
          </p>
        )}

        {/* Key Metrics Row — same order as Simulator: baseline (current vs simulated), recommended, stability index */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: baselineLabelWord === 'Simulated' ? 'Simulated Pump Level' : 'Current Pump Level',
              color: scheme.accent,
              value: baselinePumpLevel != null ? `P${baselinePumpLevel}` : '—',
              desc: selectedHour >= 1
                ? 'Pump level from the simulator trajectory at this forecast hour.'
                : 'Active pump power level from patient device data.',
              icon: Activity,
              bg: scheme.accent + '12',
            },
            {
              label: 'Recommended Pump Level',
              color: scheme.good,
              value: recommendedLevel != null ? `P${recommendedLevel}` : '—',
              desc: hasPolicyData
                ? `${(maxProb * 100).toFixed(0)}% probability of being deemed best action - highest-confidence`
                : 'Awaiting API response',
              icon: Star,
              bg: scheme.good + '12',
            },
            {
              label: 'Stability Index',
              color: scheme.primary,
              value: pumpLevelScore ?? '—',
              desc: hasPolicyData
                ? "0–10 score on the simulated P-level's effectiveness, based on hemodynamic stability."
                : 'Awaiting API response',
              icon: Award,
              bg: scheme.primary + '12',
            },
          ].map(({ label, value, desc, color, icon: Icon, bg: ibg }) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: s.sidebar, borderColor: color + '55' }}
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

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: s.sidebar, borderColor: border }} className="rounded-xl border p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 style={{ color: text }} className="text-sm font-semibold">Success Probability Distribution</h2>
              <p style={{ color: subtext }} className="text-xs mt-0.5">
                Likelihood of each pump level being deemed best, given patient's hemodynamic state
              </p>
            </div>
            <div style={{ background: scheme.primary + '18', color: scheme.primary }} className="text-xs px-3 py-1.5 rounded-full">
              {selectedHour === 0
                ? <>P{patient?.deviceLevel ?? '—'} active</>
                : <>P{baselinePumpLevel ?? '—'} simulated</>}
            </div>
          </div>
          <div style={{ height: 280 }}>
            <PolicyDistributionChart
              policyData={policyData}
              hoveredBarIndex={hoveredBarIndex}
              setHoveredBarIndex={setHoveredBarIndex}
              scheme={scheme}
              gridColor={gridColor}
              subtext={subtext}
              card={card}
              border={border}
              text={text}
              baselinePumpLabel={baselinePumpLabel}
              baselineLabelWord={baselineLabelWord}
            />
          </div>
          {/* <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: scheme.good }} />
              <span style={{ color: subtext }} className="text-xs">Recommended action</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: scheme.primary, opacity: 0.65 }} />
              <span style={{ color: subtext }} className="text-xs">Alternative actions</span>
            </div>
          </div> */}
        </motion.div>
      </div>
        </div>
      </div>
    </div>
  );
}