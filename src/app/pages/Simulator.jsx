import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router';
import { Sliders, Play, TrendingUp, TrendingDown, Minus, RotateCcw, Activity, X, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { useTheme, getSurfaces } from '../context/ThemeContext';
import { useSimulatorContext, emptyPumpSequence } from '../context/SimulatorContext';
import { featureConfigs, featureKeys } from '../data/mockData';
import { CHART_STATUS } from '../constants/chartStatusColors';
import { continuousSeverityColor } from '../lib/continuousSeverityColor';
import { useLayoutContext } from '../components/Layout';

const FEATURE_GROUPS = [
  { label: 'Hemodynamics', keys: ['MAP', 'SBP', 'DBP', 'HR'] },
  { label: 'Cardiac Function', keys: ['LVP', 'LVEDP', 'pulsatility', 'eseLV'] },
  { label: 'Pump Metrics', keys: ['pumpSpeed', 'motorCurrent', 'pumpFlow', 'tauLV'] },
];

/** Vivid amber for forecast series (high contrast on dark/light charts) */
const FORECAST_COLOR = '#FACC15';

/** Map a chart label like "Hour 3" / "T0h" / "T-1h" to a policy_eval hour (0..6), or null. */
function policyHourFromLabel(label) {
  if (!label || typeof label !== 'string') return null;
  if (label === 'T0h' || label === 'Hour 0') return 0;
  const m = label.match(/^Hour (\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 6 ? n : null;
}

// Labels that mark an "hour boundary" on the forecast chart (gets a larger dot,
// crisp border, and a rendered x-axis tick). Covers historical 'T-1h'/'T0h' and
// forecast 'Hour 1'..'Hour 6'.
function isHourLabel(label) {
  return typeof label === 'string' && (label.startsWith('T') || label.startsWith('Hour '));
}

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
  histLength,
  cfgLabel,
  cfgUnit,
}) {
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const overlayRef = useRef(null);
  const [pinnedIdx, setPinnedIdx] = useState(null);
  const [, forceTick] = useState(0);
  const labels = useMemo(() => combinedData.map(r => r.label), [combinedData]);

  const isSeverityColored = ['MAP', 'HR', 'pulsatility'].includes(feature);
  // A gray slightly darker than the surface subtext, used for non-severity series.
  const plainLineColor = isDark ? '#6B7280' : '#2A3340';

  const { datasets, annotations } = useMemo(() => {
    const histData = combinedData.map(r => r[`hist_${feature}`] ?? null);
    const foreData = combinedData.map(r => r[`fore_${feature}`] ?? null);

    const histDs = {
      label: 'Historical',
      isForecast: false,
      data: histData,
      borderWidth: isSeverityColored ? 0 : 1.5,
      borderColor: isSeverityColored ? undefined : plainLineColor,
      severityThreshold: isSeverityColored ? thr : null,
      gradientLineWidth: isSeverityColored ? 1.5 : 0,
      tension: 0,
      spanGaps: true,
      pointRadius: ctx => !hasResult || labels[ctx.dataIndex]?.startsWith('T') ? 5 : 2.75,
      pointHoverRadius: ctx => !hasResult || labels[ctx.dataIndex]?.startsWith('T') ? 5 : 2.75,
      pointHitRadius: ctx => labels[ctx.dataIndex]?.startsWith('T') ? 14 : 8,
      pointBackgroundColor: ctx => {
        const v = ctx.raw;
        if (v == null || typeof v !== 'number') return 'transparent';
        return isSeverityColored ? continuousSeverityColor(v, thr) : plainLineColor;
      },
      pointBorderColor: ctx => {
        if (!hasResult || labels[ctx.dataIndex]?.startsWith('T')) return plainLineColor;
        return 'transparent';
      },
      pointBorderWidth: ctx => !hasResult || labels[ctx.dataIndex]?.startsWith('T') ? 2.25 : 0,
      pointHoverBackgroundColor: ctx => {
        const v = ctx.raw;
        if (v == null || typeof v !== 'number') return 'transparent';
        return isSeverityColored ? continuousSeverityColor(v, thr) : plainLineColor;
      },
      pointHoverBorderColor: ctx => {
        if (!hasResult || labels[ctx.dataIndex]?.startsWith('T')) return plainLineColor;
        return 'transparent';
      },
      pointHoverBorderWidth: ctx => !hasResult || labels[ctx.dataIndex]?.startsWith('T') ? 2.25 : 0,
    };

    const foreDs = hasResult
      ? {
          label: 'Forecast',
          isForecast: true,
          data: foreData,
          borderWidth: isSeverityColored ? 0 : 3,
          borderColor: isSeverityColored ? undefined : plainLineColor,
          severityThreshold: isSeverityColored ? thr : null,
          gradientLineWidth: isSeverityColored ? 3 : 0,
          tension: 0,
          spanGaps: true,
          pointRadius: ctx => isHourLabel(labels[ctx.dataIndex]) ? 6 : 2.75,
          pointHoverRadius: ctx => isHourLabel(labels[ctx.dataIndex]) ? 6 : 2.75,
          pointHitRadius: ctx => isHourLabel(labels[ctx.dataIndex]) ? 14 : 8,
          pointBackgroundColor: ctx => {
            const v = ctx.raw;
            if (v == null || typeof v !== 'number') return 'transparent';
            return isSeverityColored ? continuousSeverityColor(v, thr) : plainLineColor;
          },
          pointBorderColor: ctx => {
            if (!isHourLabel(labels[ctx.dataIndex])) return 'transparent';
            return plainLineColor;
          },
          pointBorderWidth: ctx => isHourLabel(labels[ctx.dataIndex]) ? 2.25 : 0,
          pointHoverBackgroundColor: ctx => {
            const v = ctx.raw;
            if (v == null || typeof v !== 'number') return 'transparent';
            return isSeverityColored ? continuousSeverityColor(v, thr) : plainLineColor;
          },
          pointHoverBorderColor: ctx => {
            if (!isHourLabel(labels[ctx.dataIndex])) return 'transparent';
            return plainLineColor;
          },
          pointHoverBorderWidth: ctx => isHourLabel(labels[ctx.dataIndex]) ? 2.25 : 0,
        }
      : null;

    const ann = {};
    if (hasResult && histLength > 0 && labels.length > histLength) {
      // Box anchors at T0h (the last historical index) so the tinted region
      // sits flush to the right of the white T0h grid line.
      ann.forecastBox = {
        type: 'box',
        xMin: histLength - 1,
        xMax: labels.length - 1,
        backgroundColor: `${FORECAST_COLOR}28`,
        borderWidth: 0,
      };
    }

    return {
      datasets: foreDs ? [histDs, foreDs] : [histDs],
      annotations: ann,
    };
  }, [combinedData, feature, thr, hasResult, histLength, labels, isDark, subtext, isSeverityColored, plainLineColor]);

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
          grid: { display: false },
          ticks: {
            color: subtext,
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: false,
            callback: (_value, index) => {
              const lbl = labels[index];
              if (isHourLabel(lbl)) return lbl;
              if (lbl === '+30m') return '+30 min';
              return undefined;
            },
          },
          border: { display: false },
        },
        y: {
          grid: { color: gridColor, borderDash: [3, 3] },
          ticks: { color: subtext, font: { size: 10 } },
          border: { display: false },
        },
      },
    }),
    [annotations, card, border, subtext, gridColor, scheme.primary, thr, isDark, labels],
  );

  const optionsWithClick = useMemo(
    () => ({
      ...options,
      onClick: (event, _elements, chart) => {
        const c = chart ?? chartRef.current;
        if (!c) return;
        const nativeEvent = event?.native ?? event;
        // First try a precise hit on a dot. If that misses, snap to the
        // nearest hour-boundary point so the overlay still surfaces.
        let els = c.getElementsAtEventForMode(
          nativeEvent,
          'nearest',
          { intersect: true },
          false,
        );
        if (!els.length) {
          els = c.getElementsAtEventForMode(
            nativeEvent,
            'nearest',
            { intersect: false, axis: 'x' },
            false,
          );
        }
        if (!els.length) {
          setPinnedIdx(null);
          return;
        }
        const idx = els[0].index;
        setPinnedIdx(prev => (prev === idx ? null : idx));
      },
    }),
    [options],
  );

  // Re-render the overlay after the chart resizes so positions stay in sync.
  useEffect(() => {
    const c = chartRef.current;
    const canvas = c?.canvas;
    if (!canvas) return;
    const ro = new ResizeObserver(() => forceTick(t => t + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Reset pin if the underlying data length changes (e.g. forecast cleared).
  useEffect(() => {
    if (pinnedIdx != null && pinnedIdx >= combinedData.length) {
      setPinnedIdx(null);
    }
  }, [combinedData.length, pinnedIdx]);

  let overlay = null;
  if (pinnedIdx != null && chartRef.current) {
    const c = chartRef.current;
    let pt = null;
    for (let dsi = 0; dsi < c.data.datasets.length; dsi += 1) {
      const meta = c.getDatasetMeta(dsi);
      const cand = meta?.data?.[pinnedIdx];
      if (cand && !cand.skip && Number.isFinite(cand.x) && Number.isFinite(cand.y)) {
        pt = cand;
        break;
      }
    }
    if (pt) {
      const lbl = labels[pinnedIdx];
      const row = combinedData[pinnedIdx];
      const isFore = Boolean(row?.isForecast);
      const valKey = isFore ? `fore_${feature}` : `hist_${feature}`;
      const v = row?.[valKey];
      const valueStr = typeof v === 'number' ? v.toFixed(2) : '—';
      const ph = policyHourFromLabel(lbl);
      overlay = { x: pt.x, y: pt.y, label: lbl, isForecast: isFore, valueStr, policyHour: ph };
    }
  }

  return (
    <div className="relative w-full h-full">
      <Line ref={chartRef} data={{ labels, datasets }} options={optionsWithClick} />
      {overlay && (
        <div
          ref={overlayRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: overlay.x,
            top: overlay.y,
            transform: 'translate(-50%, calc(-100% - 12px))',
            background: card,
            borderColor: border,
            color: subtext,
            zIndex: 30,
            minWidth: 180,
            pointerEvents: 'auto',
          }}
          className="rounded-lg border shadow-lg p-2.5 text-xs">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span style={{ color: subtext }} className="font-semibold">
              {overlay.label} · {overlay.isForecast ? 'forecast' : 'historical'}
            </span>
            <button
              type="button"
              onClick={() => setPinnedIdx(null)}
              style={{ color: subtext }}
              aria-label="Close"
              className="hover:opacity-70 transition-opacity">
              <X size={12} />
            </button>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span style={{ color: subtext }} className="text-[10px]">{cfgLabel ?? feature}:</span>
            <span style={{ color: scheme.primary }} className="font-mono font-semibold text-sm">
              {overlay.valueStr}
            </span>
            {cfgUnit && (
              <span style={{ color: subtext }} className="text-[10px]">{cfgUnit}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (overlay.policyHour == null) return;
              navigate(`/policy?hour=${overlay.policyHour}`);
            }}
            disabled={overlay.policyHour == null}
            title={
              overlay.policyHour == null
                ? 'Policy evaluation is only available for Hour 0 through Hour 6'
                : `Open Policy Evaluation at Hour ${overlay.policyHour}`
            }
            style={{
              background: overlay.policyHour == null ? border : scheme.primary,
              color: overlay.policyHour == null ? subtext : 'white',
              opacity: overlay.policyHour == null ? 0.6 : 1,
              cursor: overlay.policyHour == null ? 'not-allowed' : 'pointer',
            }}
            className="w-full px-2 py-1.5 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5">
            <Activity size={11} />
            Evaluate Policy
          </button>
        </div>
      )}
    </div>
  );
}


const P_LEVEL_OPTIONS = [null, 2, 3, 4, 5, 6, 7, 8, 9];

function PLevelDropdown({ value, onChange, card, border, subtext, scheme }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = e => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [open]);

  const display = value == null ? '—' : `P${value}`;
  const isSet = value != null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: card,
          borderColor: open ? scheme.primary : border,
          color: isSet ? scheme.primary : subtext,
        }}
        className="w-full px-1.5 py-1 rounded border text-[11px] font-mono font-semibold leading-none transition-colors hover:opacity-90">
        {display}
      </button>
      {open && (
        <div
          style={{ background: card, borderColor: border }}
          className="absolute z-50 left-0 right-0 mt-0.5 rounded border shadow-lg overflow-hidden">
          {P_LEVEL_OPTIONS.map(p => {
            const isSelected = p === value;
            return (
              <button
                key={p ?? 'none'}
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                style={{
                  color: p == null ? subtext : scheme.primary,
                  background: isSelected ? scheme.primary + '22' : 'transparent',
                }}
                className="block w-full px-1.5 py-1 text-[11px] font-mono font-semibold leading-none text-center hover:opacity-100 hover:bg-black/10">
                {p == null ? '—' : `P${p}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Draggable horizon picker (1..6 hours). Clicking or dragging the track
 * snaps the thumb to the nearest integer position. Changing the horizon
 * only affects the simulator display — the underlying pumpSequence in
 * state is preserved so widening the horizon restores prior P-levels.
 */
function HorizonSlider({ value, onChange, scheme, subtext, border, card, muted, isDark }) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  const valueFromClientX = clientX => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return value;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.max(1, Math.min(6, Math.round(ratio * 5) + 1));
  };

  const handlePointerDown = e => {
    e.preventDefault();
    draggingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    onChange(valueFromClientX(e.clientX));
  };
  const handlePointerMove = e => {
    if (!draggingRef.current) return;
    onChange(valueFromClientX(e.clientX));
  };
  const handlePointerUp = e => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const pct = ((value - 1) / 5) * 100;
  const trackBg = isDark ? '#374151' : '#E5E7EB';

  return (
    <div className="w-full px-2 select-none">
      <div className="flex items-center justify-between mb-1">
        <span style={{ color: subtext }} className="text-[10px] font-semibold uppercase tracking-wider">
          Horizon
        </span>
        <span style={{ color: scheme.primary }} className="text-[11px] font-mono font-semibold">
          {value} {value === 1 ? 'hour' : 'hours'}
        </span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-6 flex items-center cursor-pointer"
        style={{ touchAction: 'none' }}>
        <div className="absolute left-0 right-0 rounded-full" style={{ height: 3, background: trackBg }} />
        <div
          className="absolute left-0 rounded-full"
          style={{ height: 3, width: `${pct}%`, background: scheme.primary }}
        />
        {[1, 2, 3, 4, 5, 6].map((n, i) => {
          const left = (i / 5) * 100;
          const isActive = n <= value;
          return (
            <div
              key={n}
              className="absolute rounded-full"
              style={{
                left: `${left}%`,
                transform: 'translate(-50%, -50%)',
                top: '50%',
                width: 8,
                height: 8,
                background: isActive ? scheme.primary : (muted ?? trackBg),
                border: `1.5px solid ${isActive ? scheme.primary : subtext}`,
              }}
            />
          );
        })}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${pct}%`,
            transform: 'translate(-50%, -50%)',
            top: '50%',
            width: 14,
            height: 14,
            background: scheme.primary,
            border: `2px solid ${card}`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}
        />
      </div>
      <div className="relative h-4 mt-0.5">
        {[1, 2, 3, 4, 5, 6].map((n, i) => (
          <div
            key={n}
            className="absolute"
            style={{ left: `${(i / 5) * 100}%`, transform: 'translateX(-50%)' }}>
            <span
              style={{ color: n === value ? scheme.primary : subtext }}
              className="text-[10px] font-mono font-semibold">
              {n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Pinned P-level sequence configuration chart.
 * X-axis: Hour 0 (current, non-configurable, from patient.deviceLevel)
 *         followed by Hour 1 … Hour 6 (6 draggable dots).
 * Y-axis: 1 (unset) at the bottom, then P2 … P9.
 * The configurable dots are draggable vertically; each snaps to an integer
 * P-level (or below P2 → unset). The line connects all seven dots.
 */
function PLevelConfigChart({
  pumpSequence,
  setPumpSequence,
  currentLevel,
  horizonHours,
  isDark,
  card,
  border,
  subtext,
  scheme,
  gridColor,
}) {
  const chartRef = useRef(/** @type {import('chart.js').Chart | null} */ (null));
  const dragRef = useRef(/** @type {{ idx: number; pointerId: number } | null} */ (null));
  const [tickXs, setTickXs] = useState(/** @type {number[]} */ ([]));
  // Constant blink for the 6 configurable dots — matches HeartLevel1's brief
  // "beat" pattern but at a fixed cadence shared across all patients.
  const [beat, setBeat] = useState(false);
  useEffect(() => {
    const pulse = () => {
      setBeat(true);
      setTimeout(() => setBeat(false), 150);
    };
    pulse();
    const id = setInterval(pulse, 900);
    return () => clearInterval(id);
  }, []);

  // Clamp horizon to the supported range (1..6). The chart shows Hour 0
  // plus `horizon` configurable hours; pumpSequence stays length-6 in state
  // so the values outside the horizon are preserved if the user widens it.
  const horizon = Math.max(1, Math.min(6, typeof horizonHours === 'number' ? horizonHours : 6));
  const labels = useMemo(
    () => ['Hour 0', ...Array.from({ length: horizon }, (_, i) => `Hour ${i + 1}`)],
    [horizon],
  );
  // y = 1 represents "not chosen" (sits below P2 at the bottom of the axis).
  // Index 0 is the read-only current P-level pulled from patient data.
  const currentY = typeof currentLevel === 'number' ? currentLevel : 1;
  const yValues = useMemo(
    () => [
      currentY,
      ...pumpSequence
        .slice(0, horizon)
        .map(v => (typeof v === 'number' ? v : 1)),
    ],
    [currentY, pumpSequence, horizon],
  );

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data: yValues,
          borderColor: scheme.primary,
          borderWidth: 2,
          tension: 0,
          spanGaps: false,
          clip: false,
          pointRadius: yValues.map((_, i) => (i > 0 && beat ? 7.5 : 6)),
          pointHoverRadius: yValues.map((_, i) => (i > 0 && beat ? 8.25 : 7.5)),
          pointHitRadius: 28,
          pointBackgroundColor: yValues.map((v, i) => {
            if (i === 0) return scheme.accent;
            return v <= 1 ? (isDark ? card : '#ffffff') : scheme.primary;
          }),
          pointBorderColor: yValues.map((_, i) => (i === 0 ? scheme.accent : scheme.primary)),
          pointBorderWidth: yValues.map((_, i) => (i > 0 && beat ? 2.625 : 1.875)),
        },
      ],
    }),
    [labels, yValues, scheme.primary, scheme.accent, card, isDark, beat],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 8, bottom: 0, right: 72 } },
      plugins: {
        legend: { display: false },
        annotation: {
          common: { drawTime: 'beforeDatasetsDraw' },
          annotations: {
            configRegion: {
              type: 'box',
              xMin: 1,
              xMax: horizon,
              backgroundColor: '#FACC1518',
              borderWidth: 0,
            },
            configBoundary: {
              type: 'line',
              xMin: 1,
              xMax: 1,
              borderColor: subtext,
              borderWidth: 1.25,
              borderDash: [4, 4],
            },
          },
        },
        tooltip: {
          backgroundColor: card,
          titleColor: subtext,
          bodyColor: subtext,
          borderColor: border,
          borderWidth: 1,
          padding: 8,
          callbacks: {
            title: items => items[0]?.label ?? '',
            label: ctx => {
              const i = ctx.dataIndex;
              const v = yValues[i];
              if (i === 0) {
                return v <= 1 ? 'Current — not set' : `Current — P${v} (read-only)`;
              }
              return v <= 1 ? 'Not set — drag up' : `P${v}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor, lineWidth: 1 },
          ticks: { display: false },
          border: { display: false },
        },
        y: {
          min: 1,
          max: 9,
          title: {
            display: true,
            text: 'P-level',
            color: subtext,
            font: { size: 11, weight: '600' },
          },
          ticks: {
            color: subtext,
            font: { size: 10 },
            stepSize: 1,
            autoSkip: false,
            callback: v => (v <= 1 ? '' : `P${v}`),
          },
          grid: { color: gridColor, borderDash: [3, 3] },
          border: { display: false },
        },
      },
    }),
    [yValues, card, border, subtext, gridColor, horizon],
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const canvas = chart.canvas;

    const valueFromEvent = e => {
      const c = chartRef.current;
      if (!c?.scales?.y) return null;
      const area = c.chartArea;
      const rect = canvas.getBoundingClientRect();
      const yPx = e.clientY - rect.top;
      const clamped = Math.max(area.top, Math.min(area.bottom, yPx));
      const v = c.scales.y.getValueForPixel(clamped);
      if (!Number.isFinite(v)) return null;
      const rounded = Math.round(v);
      return Math.min(9, Math.max(1, rounded));
    };

    const indexFromEvent = e => {
      const c = chartRef.current;
      if (!c) return -1;
      const els = c.getElementsAtEventForMode(e, 'index', { intersect: false }, false);
      return els.length ? els[0].index : -1;
    };

    // chartIdx is into the 7-point chart array; pumpSequence is 6 entries
    // mapped to chartIdx 1..6. chartIdx 0 (current state) is read-only.
    const applyValue = (chartIdx, v) => {
      if (chartIdx <= 0) return;
      setPumpSequence(prev => {
        const n = [...prev];
        n[chartIdx - 1] = v <= 1 ? null : v;
        return n;
      });
    };

    const onPointerDown = e => {
      const idx = indexFromEvent(e);
      if (idx <= 0) return;
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = { idx, pointerId: e.pointerId };
      const v = valueFromEvent(e);
      if (v != null) applyValue(idx, v);
    };

    const onPointerMove = e => {
      if (!dragRef.current) return;
      e.preventDefault();
      const v = valueFromEvent(e);
      if (v != null) applyValue(dragRef.current.idx, v);
    };

    const endDrag = e => {
      if (!dragRef.current) return;
      try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'ns-resize';

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      canvas.style.touchAction = '';
      canvas.style.cursor = '';
    };
  }, [setPumpSequence]);

  // Track x-pixel positions of each data point so we can align the dropdown
  // row directly under each tick. Recomputes on resize.
  useEffect(() => {
    const compute = () => {
      const c = chartRef.current;
      const canvas = c?.canvas;
      if (!c?.scales?.x || !canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      const wrap = canvas.parentElement?.parentElement; // canvas → chart wrapper → flex column
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const offsetLeft = canvasRect.left - wrapRect.left;
      const xs = labels.map((_, i) => offsetLeft + c.scales.x.getPixelForValue(i));
      setTickXs(xs);
    };
    compute();
    const c = chartRef.current;
    const canvas = c?.canvas;
    if (!canvas) return;
    const ro = new ResizeObserver(() => requestAnimationFrame(compute));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [labels]);

  // chartIdx is into the 7-point chart array; pumpSequence is 6 entries
  // mapped to chartIdx 1..6. chartIdx 0 (current state) is read-only and has
  // no dropdown.
  const handleDropdownChange = useCallback(
    (chartIdx, newValue) => {
      if (chartIdx <= 0) return;
      setPumpSequence(prev => {
        const n = [...prev];
        n[chartIdx - 1] = newValue;
        return n;
      });
    },
    [setPumpSequence],
  );

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <Line ref={chartRef} data={data} options={options} />
      </div>
      <div className="relative flex-shrink-0" style={{ height: 24 }}>
        {tickXs.map((x, i) => (
          <div key={`label-${i}`}
            className="absolute top-0 bottom-0 flex items-center"
            style={{ left: x, transform: 'translateX(-50%)' }}>
            <span style={{ color: subtext }} className="text-[11px] font-medium leading-none whitespace-nowrap">
              {labels[i]}
            </span>
          </div>
        ))}
        {tickXs.map((x, i) => {
          if (i === 0) return null;
          return (
            <div key={`drop-${i}`}
              className="absolute top-0 bottom-0 flex items-center"
              style={{ left: x + 16, width: 44 }}>
              <div className="w-full">
                <PLevelDropdown
                  value={pumpSequence[i - 1]}
                  onChange={v => handleDropdownChange(i, v)}
                  card={card}
                  border={border}
                  subtext={subtext}
                  scheme={scheme}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Simulator() {
  const { scheme, isDark, thresholds } = useTheme();
  const { patients, selectedPatientId } = useLayoutContext();
  const {
    getStateFor,
    setStateFor,
    clearStateFor,
    selectedGroup,
    setSelectedGroup,
  } = useSimulatorContext();

  const patient = patients.find(p => p.id === selectedPatientId);
  const currentLevel = patient?.deviceLevel ?? 5;

  // Per-patient state lives in the context so it persists across navigation.
  const persisted = getStateFor(selectedPatientId);
  // Default the 6 configurable hours to the patient's current P-level. The
  // chart shows a flat line at the current level until the user edits a dot.
  const defaultPumpSeq = useMemo(
    () => (typeof currentLevel === 'number' && currentLevel >= 2 && currentLevel <= 9
      ? Array(6).fill(currentLevel)
      : emptyPumpSequence()),
    [currentLevel],
  );
  const pumpSequence = persisted?.pumpSequence ?? defaultPumpSeq;
  const horizonHours = persisted?.horizonHours ?? 6;
  const isRunning = persisted?.isRunning ?? false;
  const hasResult = persisted?.hasResult ?? false;
  const forecastRows = persisted?.forecastRows ?? [];
  const forecastError = persisted?.forecastError ?? null;
  const lastRunPumpSequence = persisted?.lastRunPumpSequence ?? null;

  const setPumpSequence = useCallback(
    updater => setStateFor(selectedPatientId, prev => {
      // First edit after a reset sees the empty context default; treat that
      // as the current-level baseline so the untouched hours stay at P{current}.
      const baseline = !prev.pumpSequence || prev.pumpSequence.every(v => v == null)
        ? defaultPumpSeq
        : prev.pumpSequence;
      return {
        ...prev,
        pumpSequence: typeof updater === 'function' ? updater(baseline) : updater,
      };
    }),
    [selectedPatientId, setStateFor, defaultPumpSeq],
  );
  const setHorizonHours = useCallback(
    v => setStateFor(selectedPatientId, prev => ({
      ...prev,
      horizonHours: Math.max(1, Math.min(6, Math.round(v))),
    })),
    [selectedPatientId, setStateFor],
  );
  const setIsRunning = useCallback(
    v => setStateFor(selectedPatientId, prev => ({ ...prev, isRunning: v })),
    [selectedPatientId, setStateFor],
  );
  const setHasResult = useCallback(
    v => setStateFor(selectedPatientId, prev => ({ ...prev, hasResult: v })),
    [selectedPatientId, setStateFor],
  );
  const setForecastRows = useCallback(
    updater => setStateFor(selectedPatientId, prev => ({
      ...prev,
      forecastRows: typeof updater === 'function' ? updater(prev.forecastRows) : updater,
    })),
    [selectedPatientId, setStateFor],
  );
  const setForecastError = useCallback(
    v => setStateFor(selectedPatientId, prev => ({ ...prev, forecastError: v })),
    [selectedPatientId, setStateFor],
  );
  const setLastRunPumpSequence = useCallback(
    v => setStateFor(selectedPatientId, prev => ({ ...prev, lastRunPumpSequence: v })),
    [selectedPatientId, setStateFor],
  );

  const canRunForecast = useMemo(
    () => pumpSequence.slice(0, horizonHours).every(v => typeof v === 'number' && v >= 2 && v <= 9),
    [pumpSequence, horizonHours],
  );

  // Reset persisted run for this patient if the device level changes.
  const lastDeviceLevelRef = useRef(/** @type {{id: string|null, level: number|null}} */ ({
    id: null,
    level: null,
  }));
  useEffect(() => {
    if (!selectedPatientId) return;
    const prev = lastDeviceLevelRef.current;
    if (prev.id === selectedPatientId && prev.level !== patient?.deviceLevel) {
      clearStateFor(selectedPatientId);
    }
    lastDeviceLevelRef.current = {
      id: selectedPatientId,
      level: patient?.deviceLevel ?? null,
    };
  }, [selectedPatientId, patient?.deviceLevel, clearStateFor]);

  const s = getSurfaces(isDark);
  const bg = s.bg;
  const card = s.card;
  const border = s.border;
  const text = s.text;
  const subtext = s.subtext;
  const muted = s.muted;
  const gridColor = s.gridColor;

  const forecast = useMemo(() => {
    if (!hasResult || !forecastRows.length) return [];
    return forecastRows;
  }, [hasResult, forecastRows]);

  const forecastPumpLegend = useMemo(() => {
    if (!lastRunPumpSequence || lastRunPumpSequence.length !== 6) {
      return null;
    }
    return lastRunPumpSequence.map(p => `P${p}`).join(' → ');
  }, [lastRunPumpSequence]);

  const combinedData = useMemo(() => {
    if (!patient) return [];
    const hist = patient.timeline;
    const all = hasResult ? [...hist, ...forecast] : hist;
    const rows = all.map((step, i) => {
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
    return rows;
  }, [patient, forecast, hasResult]);

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
      if (!Array.isArray(data.forecast) || data.forecast.length !== 36) {
        throw new Error('Invalid forecast response');
      }
      const rows = data.forecast;
      setForecastRows(rows);
      setLastRunPumpSequence(pumpSequence.map(Number));
      setHasResult(true);
    } catch (e) {
      setForecastError(e instanceof Error ? e.message : 'Forecast failed');
      setHasResult(false);
      setForecastRows([]);
      setLastRunPumpSequence(null);
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

  // Fetch policy recommendation at Hour 0 so we can show recommended pump
  // change and stability index on the simulator header.
  const [policyApi, setPolicyApi] = useState(null);
  useEffect(() => {
    if (!selectedPatientId) {
      setPolicyApi(null);
      return;
    }
    let cancelled = false;
    setPolicyApi(null);
    const params = new URLSearchParams({ patient_id: selectedPatientId, hour: '0' });
    fetch(`/api/policy_evaluation?${params.toString()}`)
      .then(async res => {
        if (!res.ok) throw new Error('policy unavailable');
        return res.json();
      })
      .then(data => { if (!cancelled) setPolicyApi(data); })
      .catch(() => { if (!cancelled) setPolicyApi(null); })
    return () => { cancelled = true; };
  }, [selectedPatientId]);

  const policyDist = policyApi?.distribution?.length === 8 ? policyApi.distribution : null;
  const recommendedLevel = policyDist
    ? policyDist.indexOf(Math.max(...policyDist)) + 2
    : null;
  const stabilityIndex = policyApi?.rollout?.finalScore != null
    ? Number(policyApi.rollout.finalScore).toFixed(1)
    : null;

  let changeLabel = '—';
  let ChangeIcon = ArrowRight;
  let changeColor = subtext;
  if (recommendedLevel != null && typeof currentLevel === 'number') {
    if (recommendedLevel > currentLevel) {
      changeLabel = 'Increase';
      ChangeIcon = ArrowUp;
      changeColor = scheme.warning ?? scheme.accent;
    } else if (recommendedLevel < currentLevel) {
      changeLabel = 'Decrease';
      ChangeIcon = ArrowDown;
      changeColor = scheme.good;
    } else {
      changeLabel = 'None';
      ChangeIcon = ArrowRight;
      changeColor = scheme.primary;
    }
  }

  const HEADER_BOX_HEIGHT = 280;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div style={{ borderColor: border, background: card }} className="border-b px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <Sliders size={16} style={{ color: scheme.primary }} />
        <div>
          <h1 style={{ color: text }} className="text-sm font-semibold">Pump Level Simulator</h1>
          <p style={{ color: subtext }} className="text-xs">10-min resolution · T-1h → T0h actual · T0h → Hour 6 forecast</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span style={{ color: subtext }} className="text-xs">Patient:</span>
          <span style={{ color: text }} className="text-sm font-semibold">{patient?.name}</span>
        </div>
      </div>

      {/* Recommendation box (left) + Pump level simulator (right) */}
      <div
        style={{ borderColor: border, background: card }}
        className="flex-shrink-0 border-b">
        <div className="px-5 pt-4 pb-[7px]">
          <div className="flex gap-3 items-stretch" style={{ height: HEADER_BOX_HEIGHT }}>
            {/* Left: recommendation summary (2/3 width) */}
            <div
              style={{ background: card, borderColor: border }}
              className="w-2/3 rounded-2xl border-2 overflow-hidden flex flex-col">
              {/* Top 2/3: recommended pump change */}
              <div className="flex-[2] p-5 flex flex-col">
                <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold">
                  Recommended Pump Change
                </div>
                <div className="flex-1 flex items-center gap-5 mt-2">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: changeColor + '18' }}>
                    <ChangeIcon size={40} style={{ color: changeColor }} strokeWidth={2.5} />
                  </div>
                  <span style={{ color: changeColor }} className="text-4xl font-bold tracking-tight">
                    {changeLabel}
                  </span>
                </div>
              </div>
              {/* Bottom 1/3: three stat cells */}
              <div
                className="flex-1 grid grid-cols-3 border-t"
                style={{ borderColor: border }}>
                {[
                  {
                    label: 'Current Pump Level',
                    value: typeof currentLevel === 'number' ? `P${currentLevel}` : '—',
                    color: scheme.accent,
                  },
                  {
                    label: 'Recommended Pump Level',
                    value: recommendedLevel != null ? `P${recommendedLevel}` : '—',
                    color: scheme.good,
                  },
                  {
                    label: 'Stability Index',
                    value: stabilityIndex ?? '—',
                    color: scheme.primary,
                  },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    className={'px-3 py-2 flex flex-col items-center justify-center text-center' + (i < 2 ? ' border-r' : '')}
                    style={{ borderColor: border }}>
                    <div style={{ color: subtext }} className="text-[11px] font-medium mb-1">
                      {stat.label}
                    </div>
                    <div style={{ color: stat.color }} className="text-2xl font-bold font-mono">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: pump level simulator chart (1/3 width) */}
            <div
              style={{ background: card, borderColor: border }}
              className="w-1/3 rounded-2xl border-2 overflow-hidden flex flex-col p-3">
              <div style={{ color: subtext }} className="text-xs font-semibold text-center mb-2">
                Click the dots to evaluate simulated P-level!
              </div>
              <div className="flex-1 min-h-0 relative">
                <PLevelConfigChart
                  pumpSequence={pumpSequence}
                  setPumpSequence={setPumpSequence}
                  currentLevel={currentLevel}
                  horizonHours={horizonHours}
                  isDark={isDark}
                  card={card}
                  border={border}
                  subtext={subtext}
                  scheme={scheme}
                  gridColor={gridColor}
                />
              </div>
              <div className="flex-shrink-0 pt-2 mt-1 border-t" style={{ borderColor: border }}>
                <HorizonSlider
                  value={horizonHours}
                  onChange={setHorizonHours}
                  scheme={scheme}
                  subtext={subtext}
                  border={border}
                  card={card}
                  muted={muted}
                  isDark={isDark}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3">
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
              className="px-5 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all border">
              <motion.div
                animate={{ rotate: isRunning ? 360 : 0 }}
                transition={{ repeat: isRunning ? Infinity : 0, duration: 0.8, ease: 'linear' }}>
                <Play size={14} />
              </motion.div>
              {isRunning ? 'Simulating…' : 'Run forecast'}
            </button>
            {!canRunForecast && (
              <span style={{ color: subtext }} className="text-[10px] opacity-75">
                Set all six hours to enable Run forecast.
              </span>
            )}
            {forecastError && (
              <p style={{ color: CHART_STATUS.warning }} className="text-xs leading-snug">
                {forecastError}
              </p>
            )}
            <button
              type="button"
              onClick={() => clearStateFor(selectedPatientId)}
              style={{ color: subtext, borderColor: border, background: muted }}
              className="ml-auto px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <RotateCcw size={12} />
              Reset Simulator
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Charts area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: bg }}>
          {/* Group tabs */}
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

                <div className="flex flex-col px-2 pt-3 pb-2">
                  <div className="relative w-full" style={{ height: 170 }}>
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
                      histLength={patient?.timeline?.length ?? 6}
                      cfgLabel={cfg.label}
                      cfgUnit={cfg.unit}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}

        </div>

        {/* Right sidebar: Current State + 6h Summary */}
        <div className="flex-shrink-0 p-2 pl-0 w-[min(100%,16rem)] min-w-[14rem]">
          <div style={{ background: card, borderColor: border }} className="h-full rounded-2xl border flex flex-col overflow-hidden">
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
                </div>
              </div>

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

              {/* Chart key */}
              <div>
                <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold mb-2">Chart Key</div>
                <div style={{ background: muted, borderColor: border }} className="rounded-xl border p-3 space-y-2">
                  <p style={{ color: subtext }} className="text-xs leading-snug">
                    Lines colored <span style={{ color: CHART_STATUS.normal }} className="font-semibold">green</span>,{' '}
                    <span style={{ color: CHART_STATUS.warning }} className="font-semibold">yellow</span>, and{' '}
                    <span style={{ color: CHART_STATUS.critical }} className="font-semibold">red</span> indicate severity.
                    Other lines have no severity threshold.
                  </p>
                  {hasResult && forecastPumpLegend && (
                    <div className="pt-2 mt-1 border-t space-y-1.5" style={{ borderColor: border }}>
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-5 h-1 rounded flex-shrink-0" style={{ background: scheme.primary, opacity: 0.6 }} />
                        <span style={{ color: subtext }}>Historical (P{currentLevel})</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-xs">
                        <div
                          className="w-5 h-1 mt-1 rounded flex-shrink-0"
                          style={{ background: FORECAST_COLOR }}
                          aria-hidden
                        />
                        <span style={{ color: FORECAST_COLOR }} className="font-medium leading-snug break-words">
                          Forecast: {forecastPumpLegend}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Severity legend */}
              <div>
                <div style={{ color: subtext }} className="text-xs uppercase tracking-widest font-semibold mb-2">Severity</div>
                <div style={{ background: muted, borderColor: border }} className="rounded-xl border p-3">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
