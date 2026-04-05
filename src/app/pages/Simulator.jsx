import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Line } from 'react-chartjs-2';
import { Sliders, Play, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { featureConfigs, featureKeys } from '../data/mockData';
import { CHART_STATUS } from '../constants/chartStatusColors';
import { continuousSeverityColor } from '../lib/continuousSeverityColor';
import { useLayoutContext } from '../components/Layout';

const FEATURE_GROUPS = [
  { label: 'Hemodynamics', keys: ['MAP', 'SBP', 'DBP', 'HR'] },
  { label: 'Cardiac Function', keys: ['LVP', 'LVEDP', 'pulsatility', 'eseLV'] },
  { label: 'Pump Metrics', keys: ['pumpSpeed', 'motorCurrent', 'pumpFlow', 'tauLV'] },
];

const P_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9];

const emptyPumpSequence = () => /** @type {(number|null)[]} */ ([null, null, null, null, null, null]);

/** Vivid amber for forecast series (high contrast on dark/light charts) */
const FORECAST_COLOR = '#FACC15';

function SimulatorFeatureChart({
  combinedData,
  feature,
  thr,
  hasResult,
  lastHistLabel,
  isDark,
  gridColor,
  subtext,
  card,
  border,
  scheme,
}) {
  const labels = useMemo(() => combinedData.map(r => r.label), [combinedData]);

  const { datasets, annotations } = useMemo(() => {
    const histData = combinedData.map(r => r[`hist_${feature}`] ?? null);
    const foreData = combinedData.map(r => r[`fore_${feature}`] ?? null);

    const histDs = {
      label: 'Historical',
      isForecast: false,
      data: histData,
      borderWidth: 0,
      severityThreshold: thr,
      gradientLineWidth: 1.5,
      tension: 0,
      spanGaps: true,
      pointRadius: 5,
      pointHoverRadius: 5,
      pointBackgroundColor: ctx => {
        const v = ctx.raw;
        if (v == null || typeof v !== 'number') return 'transparent';
        return continuousSeverityColor(v, thr);
      },
      pointBorderColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.85)',
      pointBorderWidth: 2.25,
      pointHoverBackgroundColor: ctx => {
        const v = ctx.raw;
        if (v == null || typeof v !== 'number') return 'transparent';
        return continuousSeverityColor(v, thr);
      },
      pointHoverBorderColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.85)',
      pointHoverBorderWidth: 2.25,
    };

    const foreDs = hasResult
      ? {
          label: 'Forecast',
          isForecast: true,
          data: foreData,
          borderWidth: 0,
          severityThreshold: thr,
          gradientLineWidth: 3,
          tension: 0,
          spanGaps: true,
          pointRadius: 6,
          pointHoverRadius: 6,
          pointBackgroundColor: ctx => {
            const v = ctx.raw;
            if (v == null || typeof v !== 'number') return 'transparent';
            return continuousSeverityColor(v, thr);
          },
          pointBorderColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.9)',
          pointBorderWidth: 2.25,
          pointHoverBackgroundColor: ctx => {
            const v = ctx.raw;
            if (v == null || typeof v !== 'number') return 'transparent';
            return continuousSeverityColor(v, thr);
          },
          pointHoverBorderColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.9)',
          pointHoverBorderWidth: 2.25,
        }
      : null;

    const ann = {};
    if (hasResult && lastHistLabel && labels.length) {
      ann.nowLine = {
        type: 'line',
        scaleID: 'x',
        value: lastHistLabel,
        borderColor: `${subtext}BB`,
        borderWidth: 2,
        borderDash: [6, 4],
        label: {
          display: true,
          content: 'Now',
          position: 'end',
          color: subtext,
          font: { size: 9 },
        },
      };
      ann.forecastBox = {
        type: 'box',
        xMin: lastHistLabel,
        xMax: labels[labels.length - 1],
        backgroundColor: `${FORECAST_COLOR}28`,
        borderWidth: 0,
      };
    }

    return {
      datasets: foreDs ? [histDs, foreDs] : [histDs],
      annotations: ann,
    };
  }, [combinedData, feature, thr, hasResult, lastHistLabel, labels, isDark, subtext]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        annotation: {
          common: { drawTime: 'beforeDatasetsDraw' },
          annotations,
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          filter: item => item.raw != null,
          backgroundColor: card,
          titleColor: subtext,
          bodyColor: subtext,
          borderColor: border,
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: items => {
              if (!items.length) return '';
              const isFore = items.some(i => i.dataset.isForecast);
              const lbl = items[0].label;
              return `${lbl}${isFore ? ' · forecast' : ' · historical'}`;
            },
            label: ctx => {
              const isFore = ctx.dataset.isForecast;
              const v = ctx.parsed.y;
              const formatted = typeof v === 'number' ? v.toFixed(2) : String(v);
              return `${isFore ? 'Forecast' : 'Historical'}: ${formatted}`;
            },
            labelColor: ctx => {
              const v = ctx.parsed.y;
              if (typeof v !== 'number') {
                return { borderColor: scheme.primary, backgroundColor: scheme.primary };
              }
              const c = continuousSeverityColor(v, thr);
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
    [annotations, card, border, subtext, gridColor, scheme.primary, thr],
  );

  return <Line data={{ labels, datasets }} options={options} />;
}

export default function Simulator() {
  const { scheme, isDark, thresholds } = useTheme();
  const { patients, selectedPatientId } = useLayoutContext();

  const patient = patients.find(p => p.id === selectedPatientId);
  const currentLevel = patient?.deviceLevel ?? 5;

  const [pumpSequence, setPumpSequence] = useState(emptyPumpSequence);
  const [isRunning, setIsRunning] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [forecastRows, setForecastRows] = useState([]);
  const [forecastError, setForecastError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(0);

  const canRunForecast = useMemo(
    () => pumpSequence.every(v => typeof v === 'number' && v >= 2 && v <= 9),
    [pumpSequence],
  );

  useEffect(() => {
    setPumpSequence(emptyPumpSequence());
    setHasResult(false);
    setForecastRows([]);
    setForecastError(null);
  }, [selectedPatientId, patient?.deviceLevel]);

  useEffect(() => {
    setHasResult(false);
    setForecastRows([]);
    setForecastError(null);
  }, [pumpSequence]);

  const bg = isDark ? '#080E1A' : '#F4F6FA';
  const card = isDark ? '#0C1526' : '#FFFFFF';
  const border = isDark ? '#1A2740' : '#E2E8F0';
  const text = isDark ? '#E2E8F0' : '#1E293B';
  const subtext = isDark ? '#64748B' : '#94A3B8';
  const muted = isDark ? '#1E293B' : '#F1F5F9';
  const gridColor = isDark ? '#1A2740' : '#E2E8F0';

  const forecast = useMemo(() => {
    if (!hasResult || !forecastRows.length) return [];
    return forecastRows;
  }, [hasResult, forecastRows]);

  const sequenceSummary = canRunForecast
    ? pumpSequence.map(p => `P${p}`).join(' → ')
    : null;

  const combinedData = useMemo(() => {
    if (!patient) return [];
    const hist = patient.timeline;
    const all = hasResult ? [...hist, ...forecast] : hist;
    return all.map((step, i) => {
      const isFore = i >= hist.length;
      const row = { label: step.label, isForecast: isFore };
      featureKeys.forEach(k => {
        if (isFore) {
          row[`fore_${k}`] = step[k];
        } else {
          row[`hist_${k}`] = step[k];
          if (i === hist.length - 1 && hasResult) row[`fore_${k}`] = step[k];
        }
      });
      return row;
    });
  }, [patient, forecast, hasResult]);

  const setLevelAt = (index, raw) => {
    if (raw === '' || raw == null) {
      setPumpSequence(prev => {
        const n = [...prev];
        n[index] = null;
        return n;
      });
      return;
    }
    const v = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (!Number.isFinite(v)) return;
    const clamped = Math.min(9, Math.max(2, v));
    setPumpSequence(prev => {
      const n = [...prev];
      n[index] = clamped;
      return n;
    });
  };

  const runSimulation = async () => {
    if (!canRunForecast || !patient) return;
    const base = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:8000');
    setIsRunning(true);
    setForecastError(null);
    try {
      const res = await fetch(`${base}/api/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patient.id,
          p_levels: pumpSequence.map(Number),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail ?? res.statusText;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }
      if (!Array.isArray(data.forecast) || data.forecast.length !== 6) {
        throw new Error('Invalid forecast response');
      }
      setForecastRows(data.forecast);
      setHasResult(true);
    } catch (e) {
      setForecastError(e instanceof Error ? e.message : 'Forecast failed');
      setHasResult(false);
      setForecastRows([]);
    } finally {
      setIsRunning(false);
    }
  };

  const getTrend = feature => {
    if (!hasResult || forecast.length === 0 || !patient) return null;
    const current = patient.timeline[patient.timeline.length - 1][feature];
    const predicted = forecast[forecast.length - 1][feature];
    const diff = predicted - current;
    const pct = Math.abs(diff) / (Math.abs(current) || 1) * 100;
    return { diff, pct, direction: diff > 1 ? 'up' : diff < -1 ? 'down' : 'flat' };
  };

  const activeFeatureKeys = FEATURE_GROUPS[selectedGroup].keys;
  const lastHistLabel = patient?.timeline[patient.timeline.length - 1]?.label;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div style={{ borderColor: border, background: card }} className="border-b px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <Sliders size={16} style={{ color: scheme.primary }} />
        <div>
          <h1 style={{ color: text }} className="text-sm font-semibold">Pump Level Simulator</h1>
          <p style={{ color: subtext }} className="text-xs">Forecast hemodynamic response · T-0 hrs → T+6 hrs</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span style={{ color: subtext }} className="text-xs">Patient:</span>
          <span style={{ color: text }} className="text-sm font-semibold">{patient?.name}</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Charts area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: bg }}>
          {/* Group tabs + legend */}
          <div className="flex items-center gap-2 flex-wrap">
            {FEATURE_GROUPS.map((g, i) => (
              <button
                key={i}
                onClick={() => setSelectedGroup(i)}
                style={{
                  background: selectedGroup === i ? scheme.primary + '22' : muted,
                  borderColor: selectedGroup === i ? scheme.primary + '55' : border,
                  color: selectedGroup === i ? scheme.primary : subtext,
                }}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all">
                {g.label}
              </button>
            ))}
            {hasResult && sequenceSummary && (
              <div className="ml-auto flex flex-col items-end gap-1 text-xs max-w-[min(100%,20rem)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-1 rounded flex-shrink-0" style={{ background: scheme.primary, opacity: 0.6 }} />
                  <span style={{ color: subtext }}>Historical (P{currentLevel})</span>
                </div>
                <div className="flex items-start gap-1.5 text-right">
                  <div className="w-5 h-1 rounded mt-0.5 flex-shrink-0" style={{ background: FORECAST_COLOR }} />
                  <span style={{ color: FORECAST_COLOR }} className="font-medium leading-snug break-words">
                    Forecast: {sequenceSummary}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Feature charts */}
          {activeFeatureKeys.map((feature, idx) => {
            const cfg = featureConfigs[feature];
            const thr = thresholds[feature];
            const trend = getTrend(feature);
            const isGoodDown = ['LVEDP', 'tauLV', 'pumpSpeed', 'motorCurrent'].includes(feature);
            const trendGood = trend
              ? trend.direction === 'flat'
                ? null
                : trend.direction === 'down'
                  ? isGoodDown
                  : !isGoodDown
              : null;

            return (
              <motion.div
                key={feature}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{ background: card, borderColor: border }}
                className="rounded-xl border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: border }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                    <span style={{ color: text }} className="text-sm font-semibold">{cfg.label}</span>
                    <span style={{ color: subtext }} className="text-xs">({cfg.unit})</span>
                  </div>
                  {trend && Math.abs(trend.pct) > 0.5 && (
                    <div
                      className="flex items-center gap-1.5"
                      style={{
                        color: trendGood === null ? subtext : trendGood ? CHART_STATUS.normal : CHART_STATUS.warning,
                      }}>
                      {trend.direction === 'up' ? <TrendingUp size={12} /> :
                       trend.direction === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
                      <span className="text-xs font-mono">
                        {trend.diff > 0 ? '+' : ''}{trend.diff.toFixed(2)} {cfg.unit} over 6h
                      </span>
                    </div>
                  )}
                </div>

                <div className="px-2 py-3" style={{ height: 170 }}>
                  <SimulatorFeatureChart
                    combinedData={combinedData}
                    feature={feature}
                    thr={thr}
                    hasResult={hasResult}
                    lastHistLabel={lastHistLabel}
                    isDark={isDark}
                    gridColor={gridColor}
                    subtext={subtext}
                    card={card}
                    border={border}
                    scheme={scheme}
                  />
                </div>
              </motion.div>
            );
          })}

          {!hasResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ borderColor: scheme.primary + '44', background: scheme.primary + '0A' }}
              className="rounded-xl border p-6 text-center">
              <div style={{ color: scheme.primary }} className="text-sm font-semibold mb-2">
                6-hour pump sequence
              </div>
              <p style={{ color: subtext }} className="text-xs">
                Choose P2–P9 for each hour (T+1h … T+6h) in the panel, then run forecast.
              </p>
            </motion.div>
          )}
        </div>

        {/* Right Control Panel */}
        <div className="flex-shrink-0 p-2 pl-0 w-[min(100%,20rem)] min-w-[17.5rem]">
          <div style={{ background: card, borderColor: border }} className="h-full rounded-2xl border flex flex-col overflow-hidden">
            {/* <div style={{ borderColor: border }} className="border-b px-4 py-3">
              <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold">
                Simulator Controls
              </div>
            </div> */}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Current state */}
              <div>
                <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold mb-2">Current State</div>
                <div style={{ background: muted, borderColor: border }} className="rounded-xl border p-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span style={{ color: subtext }} className="text-xs">Active Level</span>
                    <span style={{ color: scheme.primary }} className="font-mono font-semibold text-sm">P{currentLevel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: subtext }} className="text-xs">Status</span>
                    <span className="text-xs font-semibold capitalize" style={{ color: CHART_STATUS.normal }}>{patient?.status}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: subtext }} className="text-xs">Health Score</span>
                    <span style={{ color: text }} className="text-xs font-mono">{patient?.healthScore}/100</span>
                  </div>
                </div>
              </div>

              {/* Hourly P-level sequence T+1 … T+6 */}
              <div>
                <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold mb-2">
                  Pump Level Simulator (Hourly)
                </div>
                <p style={{ color: subtext }} className="text-[10px] opacity-80 mb-2 leading-snug">
                  Set P2–P9 for each hour. Type a number or use the menu.
                </p>
                <div className="space-y-2 mb-3">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-2">
                      <span style={{ color: subtext }} className="text-[10px] font-mono w-9 flex-shrink-0">
                        T+{i + 1}h
                      </span>
                      <select
                        aria-label={`Pump level at T+${i + 1} hour`}
                        value={pumpSequence[i] == null ? '' : String(pumpSequence[i])}
                        onChange={e => setLevelAt(i, e.target.value)}
                        style={{
                          background: muted,
                          borderColor: border,
                          color: text,
                        }}
                        className="flex-1 min-w-0 rounded-lg border px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-offset-0">
                        <option value="">—</option>
                        {P_LEVELS.map(lvl => (
                          <option key={lvl} value={lvl}>
                            P{lvl}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={2}
                        max={9}
                        step={1}
                        placeholder="—"
                        aria-label={`Type pump level T+${i + 1}h`}
                        value={pumpSequence[i] ?? ''}
                        onChange={e => setLevelAt(i, e.target.value)}
                        style={{ background: muted, borderColor: border, color: text }}
                        className="w-14 flex-shrink-0 rounded-lg border px-1.5 py-1.5 text-center text-xs font-mono outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  ))}
                </div>
                {!canRunForecast && (
                  <p style={{ color: subtext }} className="text-[10px] mb-3 opacity-75">
                    Select all six hours to enable Run forecast.
                  </p>
                )}
              </div>

              {/* Run button */}
              <button
                type="button"
                onClick={runSimulation}
                disabled={isRunning || !canRunForecast}
                style={{
                  background: canRunForecast && !isRunning ? scheme.primary : muted,
                  color: canRunForecast && !isRunning ? 'white' : subtext,
                  borderColor: border,
                  opacity: isRunning ? 0.85 : 1,
                }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all border">
                <motion.div
                  animate={{ rotate: isRunning ? 360 : 0 }}
                  transition={{ repeat: isRunning ? Infinity : 0, duration: 0.8, ease: 'linear' }}>
                  <Play size={14} />
                </motion.div>
                {isRunning ? 'Simulating…' : 'Run forecast'}
              </button>
              {forecastError && (
                <p style={{ color: CHART_STATUS.warning }} className="text-[10px] leading-snug">
                  {forecastError}
                </p>
              )}

              {/* Trend summary */}
              <AnimatePresence>
                {hasResult && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold mb-2">6h Summary</div>
                    <div className="space-y-1">
                      {activeFeatureKeys.map(key => {
                        const trend = getTrend(key);
                        if (!trend) return null;
                        const cfg = featureConfigs[key];
                        const isGoodDown = ['LVEDP', 'tauLV', 'pumpSpeed', 'motorCurrent'].includes(key);
                        const isGood =
                          trend.direction === 'flat'
                            ? true
                            : trend.direction === 'down'
                              ? isGoodDown
                              : !isGoodDown;
                        const trendColor =
                          Math.abs(trend.pct) < 2 ? subtext : isGood ? CHART_STATUS.normal : CHART_STATUS.warning;
                        return (
                          <div key={key} style={{ background: muted }} className="rounded-lg p-1.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                              <span style={{ color: subtext }} className="text-xs truncate max-w-[80px]">
                                {cfg.label.split(' ').slice(0, 2).join(' ')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1" style={{ color: trendColor }}>
                              {trend.direction === 'up' ? <TrendingUp size={10} /> :
                               trend.direction === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
                              <span className="text-xs font-mono">
                                {trend.diff > 0 ? '+' : ''}{trend.diff.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Severity Legend */}
            <div style={{ borderColor: border }} className="border-t p-3">
              <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold mb-2 opacity-70">Severity</div>
              <div className="flex gap-2.5 items-stretch mb-2">
                <div
                  className="w-2.5 rounded-full flex-shrink-0"
                  style={{
                    height: 72,
                    background: `linear-gradient(to bottom, ${CHART_STATUS.critical} 0%, ${CHART_STATUS.warning} 45%, ${CHART_STATUS.normal} 100%)`,
                  }}
                />
                <div className="flex flex-col justify-between" style={{ height: 72 }}>
                  <span style={{ color: CHART_STATUS.critical }} className="text-xs font-medium">Critical</span>
                  <span style={{ color: CHART_STATUS.warning }} className="text-xs font-medium">Warning</span>
                  <span style={{ color: CHART_STATUS.normal }} className="text-xs font-medium">Normal</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-0.5 w-6 rounded" style={{ background: FORECAST_COLOR }} />
                <span style={{ color: FORECAST_COLOR }} className="text-xs font-medium">Forecast</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
