import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Line } from 'react-chartjs-2';
import { Play, Search, X } from 'lucide-react';
import { useTheme, getSurfaces, getStatusColor } from '../context/ThemeContext';
import { featureConfigs, featureDisplayOrder } from '../data/mockData';
import { CHART_STATUS } from '../constants/chartStatusColors';
import { continuousSeverityColor, SEVERITY_FEATURES } from '../lib/continuousSeverityColor';
import { useLayoutContext, scoreMatch } from '../components/Layout';
import { statusConfig } from './MainMenu';

/**
 * NeurIPS demo: compare two policies' recommended P-level rollouts for one patient.
 * Simulator only, no sidebars: patient search header, two P-level graphs (one model each),
 * Run forecast, severity legend, then every feature graph with one forecast line per model.
 */

// Must match POLICY_MODELS in backend/policy_evaluation_api.py.
const MODELS = ['CORMPO', 'GORMPO-KDE', 'GORMPO-VAE', 'GORMPO-RealNVP', 'GORMPO-DDPM', 'GORMPO-NeuralODE'];
// The left-hand model is drawn dashed everywhere (right solid), so the two runs differ by more than color.
const DASH = [6, 4];
// The clinician's real trajectory is dash-dot everywhere, so it reads apart from both models even when it takes the
// same severity colors on MAP, HR and pulsatility.
const DASH_DOT = [12, 5, 2, 5];
// What really happened (clinician's P-levels, observed features): a dim grayish-white baseline (half the brightness of
// #E2E8F0) so the model lines pop; on the light theme, half the contrast of #8B95A7 against white.
const clinicianColor = isDark => (isDark ? '#717478' : '#C5CAD3');
const API = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:8000');

const patientIndex = p => Number(p.id.slice(1));
const isHourLabel = l => typeof l === 'string' && (l.startsWith('T') || l.startsWith('Hour '));

function PatientSearch({ patients, loading, selectedId, onSelect, s, scheme }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Patients are searched and shown as "Index N" rather than "Patient N".
  const byIndex = useMemo(() => patients.map(p => ({ ...p, name: `Index ${patientIndex(p)}` })), [patients]);
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return byIndex
      .map(p => [p, scoreMatch(p, query)])
      .filter(([, score]) => score >= 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50) // ~12k patients: never render the whole list
      .map(([p]) => p);
  }, [byIndex, query]);

  useEffect(() => {
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = p => {
    onSelect(p.id);
    setQuery('');
    setOpen(false);
  };

  // Same look as the Overview page's search bar (MainMenu.jsx).
  const active = open && query;
  return (
    <div ref={ref} className="relative flex-1">
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-colors"
        style={{ background: s.card, borderColor: active ? scheme.primary + '55' : s.border }}>
        <Search size={14} style={{ color: active ? scheme.primary : s.subtext }} aria-hidden />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Enter' && matches[0]) pick(matches[0]); }}
          placeholder={loading ? 'Loading patients…' : 'Search patients by index…'}
          aria-label="Search patients by index"
          className="flex-1 text-base outline-none"
          style={{ background: 'transparent', color: s.text }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { setQuery(''); setOpen(false); }}
            style={{ color: s.subtext }}
            className="hover:opacity-70 transition-opacity p-0.5">
            <X size={13} />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && query.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1.5 max-h-96 overflow-y-auto rounded-xl border shadow-2xl z-50"
            style={{ background: s.card, borderColor: s.border }}>
            {matches.length === 0 ? (
              <div className="text-[13px] px-4 py-3" style={{ color: s.subtext }}>No results found</div>
            ) : (
              matches.map((p, idx) => {
                const sc = getStatusColor(p.status, scheme);
                const status = statusConfig[p.status];
                const isSelected = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left hover:opacity-80"
                    style={{
                      background: isSelected ? scheme.primary + '14' : idx % 2 ? s.muted + '66' : 'transparent',
                      borderBottom: idx < matches.length - 1 ? `1px solid ${s.border}` : 'none',
                    }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc }} />
                    <span className="text-base font-medium flex-1" style={{ color: isSelected ? scheme.primary : s.text }}>
                      {p.name}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
                      style={{ color: sc, background: sc + '18' }}>
                      {status?.icon}
                      <span>{status?.label}</span>
                    </span>
                    <span className="text-[13px] font-mono font-semibold flex-shrink-0" style={{ color: sc }}>
                      P{p.deviceLevel}
                    </span>
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Each level holds from its own time until the next one (left piecewise constant), so the last one is drawn on to
 *  the end of its step with no dot there.
 *  `levels`: the model's picks for hours T0…T5 (made from the T-1h…T-10m input hour).
 *  `clinician`: the real P-level every 10 min from T-1h; the first 6 points are the input hour, so index 6 is T0. */
const holdLast = (pts, step) => [...pts, { x: pts.at(-1).x + step, y: pts.at(-1).y }];

function PLevelChart({ levels, clinician, dashed, s, scheme, isDark }) {
  const data = useMemo(() => ({
    datasets: [
      ...(clinician
        ? [{
            data: holdLast(clinician.map((y, i) => ({ x: (i - 6) / 6, y })), 1 / 6),
            borderColor: clinicianColor(isDark),
            borderDash: DASH_DOT,
            borderWidth: 2,
            stepped: 'before', // Chart.js 'before' = hold the previous value until the next point (left piecewise)
            clip: false,
            pointRadius: 0,
          }]
        : []),
      ...(levels
      ? [{
          data: holdLast(levels.map((y, x) => ({ x, y })), 1),
          borderColor: scheme.primary,
          borderWidth: 2,
          borderDash: dashed ? DASH : [],
          stepped: 'before', // Chart.js 'before' = hold the previous value until the next point (left piecewise)
          clip: false,
          pointRadius: [...levels.map(() => 4), 0],
          pointBackgroundColor: scheme.primary,
          pointBorderColor: scheme.primary,
        }]
      : []),
    ],
  }), [levels, clinician, dashed, scheme, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    events: [], // no hover, tooltip or evaluate popup
    layout: { padding: { top: 4, bottom: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      // T0 marker, same as the feature charts: the input hour is left of it, the rollouts right.
      annotation: {
        common: { drawTime: 'beforeDatasetsDraw' },
        annotations: {
          t0: { type: 'line', xMin: 0, xMax: 0, borderColor: s.subtext, borderWidth: 1.25, borderDash: [4, 4] },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: -1,
        max: 6,
        grid: { color: s.gridColor },
        border: { display: false },
        title: { display: true, text: 'Hour', color: s.subtext, font: { size: 14, weight: '600' } },
        ticks: { color: s.subtext, font: { size: 14, weight: '500' }, stepSize: 1, callback: v => ({ [-1]: 'T-1h', 0: 'T0h' })[v] ?? v },
      },
      y: {
        min: 2,
        max: 9,
        grid: { color: s.gridColor, borderDash: [3, 3] },
        border: { display: false },
        title: { display: true, text: 'P-level', color: s.subtext, font: { size: 14, weight: '600' } },
        ticks: { color: s.subtext, font: { size: 13, weight: '500' }, stepSize: 1, autoSkip: false }, // 13: eight labels in a short axis
      },
    },
  }), [s]);

  return <Line data={data} options={options} />;
}

/** Historical line plus one forecast line (with its ±σ band) per model run; the run-row legend says which line is which. */
function FeatureChart({ feature, hist, runs, clinician, s, scheme, isDark }) {
  const { data, options } = useMemo(() => {
    const sev = SEVERITY_FEATURES.includes(feature);
    const plain = isDark ? '#6B7280' : '#2A3340';
    const forecasts = runs && hist.length ? runs : [];
    const real = hist.length && clinician ? clinician : [];
    // 10-min steps: the input hour is T-1h … -10m, the forecast/clinician rows T0h … +5h50m (the forecast always has
    // all 36). A trailing empty "Hour 6" slot makes the lines stop one step short of T6, like the P-level charts.
    const nFuture = (forecasts[0]?.forecast ?? real).length;
    const labels = [
      ...hist.map((_, i) => (i ? `-${(hist.length - i) * 10}m` : 'T-1h')),
      ...Array.from({ length: nFuture }, (_, k) => (!k ? 'T0h' : k % 6 ? `+${(k % 6) * 10}m` : `Hour ${k / 6}`)),
      ...(nFuture ? ['Hour 6'] : []),
    ];
    const color = v => (typeof v !== 'number' ? 'transparent' : sev ? continuousSeverityColor(v, feature) : plain);
    const big = c => isHourLabel(labels[c.dataIndex]);
    const line = (label, values, width, dash, fixed) => ({
      label,
      data: values,
      borderColor: fixed ?? plain,
      borderWidth: width,
      borderDash: dash,
      // Severity features: each segment takes the severity color of its midpoint.
      ...(sev && !fixed && { segment: { borderColor: c => continuousSeverityColor((c.p0.parsed.y + c.p1.parsed.y) / 2, feature) } }),
      tension: 0,
      spanGaps: true,
      pointRadius: c => (big(c) ? 4.5 : 2.5),
      pointHoverRadius: c => (big(c) ? 5.5 : 3.5),
      pointHitRadius: 8,
      pointBackgroundColor: c => fixed ?? color(c.raw),
      pointBorderColor: c => (big(c) ? fixed ?? plain : 'transparent'),
      pointBorderWidth: c => (big(c) ? 2 : 0),
    });
    // Forecast lines and their bands start at T0h so they grow out of the historical line.
    const lead = hist.length ? [...Array(hist.length - 1).fill(null), hist.at(-1)[feature]] : [];
    const series = (run, key) => [...lead, ...run.forecast.map(r => r[key])];
    // ±σ confidence band, drawn behind the lines (order 5): the upper edge fills down to the lower edge just before it.
    const band = (label, values, fill) => ({
      label,
      data: values,
      isBand: true,
      order: 5,
      fill,
      backgroundColor: `${scheme.forecast}4D`,
      borderWidth: 0,
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: 0,
      tension: 0,
      spanGaps: true,
    });
    const datasets = [
      ...forecasts.flatMap(run => [
        band(`${run.model} -σ`, series(run, `${feature}_lo`), false),
        band(`${run.model} +σ`, series(run, `${feature}_hi`), '-1'),
      ]),
      line('Historical', hist.map(r => r[feature]), 1.5, []),
      ...(real.length ? [line('Clinician (actual)', [...lead, ...real.map(r => r[feature])], 2.5, DASH_DOT, sev ? undefined : clinicianColor(isDark))] : []),
      ...forecasts.map((run, i) => line(run.model, series(run, feature), 3, i ? [] : DASH)),
    ];

    return {
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { right: 8 } }, // just enough that the last hour's point isn't clipped
        plugins: {
          legend: { display: false },
          annotation: {
            common: { drawTime: 'beforeDatasetsDraw' },
            annotations: forecasts.length || real.length
              ? {
                  forecastStart: {
                    type: 'line',
                    xMin: hist.length, // T0h, the first forecast step
                    xMax: hist.length,
                    borderColor: s.subtext,
                    borderWidth: 1.25,
                    borderDash: [4, 4],
                  },
                }
              : {},
          },
          tooltip: {
            filter: item => item.raw != null && !item.dataset.isBand,
            backgroundColor: s.card,
            titleColor: s.subtext,
            bodyColor: s.subtext,
            borderColor: s.border,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: c => `${c.dataset.label}: ${c.parsed.y.toFixed(2)}`,
              labelColor: c => {
                const col = c.dataset.borderColor === plain ? color(c.parsed.y) : c.dataset.borderColor;
                return { borderColor: col, backgroundColor: col };
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: s.subtext,
              font: { size: 14, weight: '500' },
              maxRotation: 0,
              autoSkip: false,
              callback: (_v, i) => (isHourLabel(labels[i]) ? labels[i] : labels[i] === '+30m' ? '+30 min' : undefined),
            },
          },
          y: {
            grid: { color: s.gridColor, borderDash: [3, 3] },
            border: { display: false },
            ticks: { color: s.subtext, font: { size: 14, weight: '500' } },
          },
        },
      },
    };
  }, [feature, hist, runs, clinician, s, scheme, isDark]);

  return <Line data={data} options={options} />;
}

export default function NeuripsDemo() {
  const { scheme, isDark } = useTheme();
  const { patients, patientsLoading, patientsError, selectedPatient: patient, setSelectedPatientId } = useLayoutContext();
  const s = useMemo(() => getSurfaces(isDark), [isDark]);

  const [models, setModels] = useState(['', '']);
  const [running, setRunning] = useState(false);
  // A result belongs to one patient + model pair. Keying it means changing either clears the
  // graphs, and a late reply for a patient the user already left is never shown.
  const [result, setResult] = useState(null);
  const key = `${patient?.id}|${models.join('|')}`;
  const runs = result?.key === key ? result.runs : null;
  const error = result?.key === key ? result.error : null;
  const ready = Boolean(patient && models[0] && models[1] && models[0] !== models[1]);

  async function runForecast() {
    const runKey = key;
    setRunning(true);
    try {
      // Left then right, one at a time, so the backend logs the rollouts in graph order (it serializes them anyway).
      const data = [];
      for (const model of models) {
        const res = await fetch(`${API}/api/policy_forecast?${new URLSearchParams({ patient_id: patient.id, model })}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof body.detail === 'string' ? body.detail : `${model}: HTTP ${res.status}`);
        data.push(body);
      }
      setResult({ key: runKey, runs: data });
    } catch (e) {
      setResult({ key: runKey, error: e instanceof Error ? e.message : 'Forecast failed' });
    } finally {
      setRunning(false);
    }
  }

  // Real trajectory after T0h, keyed by patient so a late reply for a patient the user left is never shown.
  const [clinicianData, setClinicianData] = useState(null);
  useEffect(() => {
    if (!patient?.id) return;
    const id = patient.id;
    fetch(`${API}/api/patients/${id}/clinician`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(rows => setClinicianData({ id, rows }))
      .catch(e => console.error('[clinician fetch]', e));
  }, [patient?.id]);
  const clinician = clinicianData && clinicianData.id === patient?.id ? clinicianData.rows : null;

  const hist = patient?.timeline ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: s.bg }}>
      <header className="flex items-center gap-4 px-5 py-2 border-b flex-shrink-0" style={{ borderColor: s.border }}>
        <PatientSearch
          patients={patients}
          loading={patientsLoading}
          selectedId={patient?.id}
          onSelect={setSelectedPatientId}
          s={s}
          scheme={scheme}
        />
        {patientsError && (
          <span role="alert" className="text-[13px]" style={{ color: scheme.critical }}>{patientsError}</span>
        )}
        {/* Same pill as the Overview header's "N patients" count. */}
        <div style={{ background: s.muted, color: s.subtext }} className="px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap">
          Index {patient ? patientIndex(patient) : '—'}
        </div>
      </header>

      {/* Keeps a usable minimum width and scrolls sideways instead of squashing the graphs. */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="h-full min-w-[900px] flex flex-col">
          <section
            className="flex-shrink-0 border-b px-5 pt-3 pb-3"
            style={{ background: s.sidebar, borderColor: s.border }}>
            {/* Grows with the screen (234px on a 14" MacBook Pro, 266px on a 16"); the feature cards below take what's left. */}
            <div className="flex gap-3" style={{ height: 'clamp(213px, 23.8vh, 272px)' }}>
              {[0, 1].map(i => (
                <div
                  key={i}
                  className="flex-1 min-w-0 rounded-2xl border-2 flex flex-col px-3 py-2"
                  style={{ background: s.sidebar, borderColor: s.border }}>
                  {/* Model picker top-left, the rollout's total reward top-right on the same row. */}
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <select
                      value={models[i]}
                      onChange={e => {
                        const m = e.target.value;
                        setModels(prev => (i ? [prev[0], m] : [m, prev[1]]));
                      }}
                      aria-label={`Model for the ${i ? 'right' : 'left'} graph`}
                      className="px-2.5 py-1 rounded-lg border text-[15px] font-semibold cursor-pointer"
                      style={{ background: s.inputBg, color: s.text, borderColor: s.border, colorScheme: isDark ? 'dark' : 'light' }}>
                      <option value="" disabled>Select model…</option>
                      {MODELS.map(m => (
                        <option key={m} value={m} disabled={m === models[1 - i]}>{m}</option>
                      ))}
                    </select>
                    {runs?.[i]?.reward != null && (
                      <span
                        className="px-3 py-1 rounded-full border text-base font-semibold whitespace-nowrap tabular-nums"
                        style={{ background: s.muted, borderColor: s.border, color: s.text }}>
                        Reward: {runs[i].reward.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 relative">
                    <PLevelChart
                      levels={runs ? runs[i].p_levels : null}
                      clinician={hist.length ? [...hist.map(r => r.tauLV), ...(clinician ?? []).map(r => r.tauLV)] : null}
                      dashed={i === 0}
                      s={s}
                      scheme={scheme}
                      isDark={isDark}
                    />
                  </div>
                </div>
              ))}
            </div>

          </section>

          {/* Between the graph box and the feature cards, on the page background: line legend left, Run button
              centered, severity scale right. */}
          <div className="flex-shrink-0 px-5 pt-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-6 pb-2">
              <button
                type="button"
                onClick={runForecast}
                disabled={!ready || running}
                className="col-start-2 row-start-1 px-4 py-2 rounded-lg border font-semibold text-[15px] flex items-center gap-2 transition-all disabled:cursor-not-allowed"
                style={{
                  background: ready ? scheme.primary : s.muted,
                  color: ready ? 'white' : s.subtext,
                  borderColor: s.border,
                  opacity: running ? 0.85 : 1,
                }}>
                <motion.div
                  animate={{ rotate: running ? 360 : 0 }}
                  transition={{ repeat: running ? Infinity : 0, duration: 0.8, ease: 'linear' }}>
                  <Play size={13} />
                </motion.div>
                {running ? 'Simulating…' : 'Run forecast'}
              </button>
              {(clinician || models.some(Boolean)) && (
                <div className="col-start-1 row-start-1 justify-self-start flex flex-wrap items-center gap-x-5 gap-y-1">
                  {clinician && (
                    <span className="flex items-center gap-2 text-[15px] font-semibold whitespace-nowrap" style={{ color: s.text }}>
                      <svg width="34" height="5" aria-hidden>
                        <line x1="0" y1="2.5" x2="34" y2="2.5" stroke={s.text} strokeWidth="4" strokeDasharray={DASH_DOT.join(' ')} />
                      </svg>
                      Clinician (actual)
                    </span>
                  )}
                  {models.map((m, i) => m && (
                    <span key={i} className="flex items-center gap-2 text-[15px] font-semibold whitespace-nowrap" style={{ color: s.text }}>
                      <svg width="34" height="5" aria-hidden>
                        <line x1="0" y1="2.5" x2="34" y2="2.5" stroke={s.text} strokeWidth="4" strokeDasharray={i ? undefined : DASH.join(' ')} />
                      </svg>
                      {m}
                    </span>
                  ))}
                </div>
              )}
              <div className="col-start-3 row-start-1 justify-self-end relative w-56">
                <div
                  className="h-2.5 rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${CHART_STATUS.normal}, ${CHART_STATUS.warning}, ${CHART_STATUS.critical})`,
                  }}
                />
                <div
                  className="absolute left-0 right-0 top-full mt-1 flex justify-between text-[13px] font-medium"
                  style={{ color: s.subtext }}>
                  <span>Normal</span>
                  <span>Warning</span>
                  <span>Critical</span>
                </div>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-[13px] text-center mt-1.5" style={{ color: scheme.critical }}>{error}</p>
            )}
          </div>

          {/* Each card takes a third of the scroll area (minus the two 12px gaps), so the header, P-level graphs and
              MAP, HR and pulsatility fill exactly one screen; minHeight keeps short windows scrolling instead of squashing. */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {featureDisplayOrder.map(feature => {
              const cfg = featureConfigs[feature];
              return (
                <div
                  key={feature}
                  className="rounded-xl border flex flex-col"
                  style={{ background: s.sidebar, borderColor: s.border, height: 'calc((100% - 24px) / 3)', minHeight: 170 }}>
                  <div className="flex items-center gap-2 px-4 py-1.5 border-b" style={{ borderColor: s.border }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                    <span className="text-lg font-semibold" style={{ color: s.text }}>{cfg.label}</span>
                    <span className="text-base" style={{ color: s.subtext }}>({cfg.unit})</span>
                  </div>
                  <div className="flex-1 min-h-0 px-2 pt-2 pb-1">
                    <div className="relative w-full h-full">
                      <FeatureChart
                        feature={feature}
                        hist={hist}
                        runs={runs}
                        clinician={clinician}
                        s={s}
                        scheme={scheme}
                        isDark={isDark}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
