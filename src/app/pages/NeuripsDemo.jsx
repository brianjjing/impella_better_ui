import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Line } from 'react-chartjs-2';
import { Play, Search, X } from 'lucide-react';
import { useTheme, getSurfaces, getStatusColor } from '../context/ThemeContext';
import { featureConfigs, featureDisplayOrder } from '../data/mockData';
import { CHART_STATUS } from '../constants/chartStatusColors';
import { continuousSeverityColor } from '../lib/continuousSeverityColor';
import { useLayoutContext, scoreMatch } from '../components/Layout';
import { statusConfig } from './MainMenu';

/**
 * NeurIPS demo: compare two policies' recommended P-level rollouts for one patient.
 * Simulator only, no sidebars: patient search header, two P-level graphs (one model each),
 * Run forecast, severity legend, then every feature graph with one forecast line per model.
 */

// Must match POLICY_MODELS in backend/policy_evaluation_api.py.
const MODELS = ['CORMPO', 'GORMPO-KDE', 'GORMPO-VAE', 'GORMPO-RealNVP', 'GORMPO-DDPM', 'GORMPO-NeuralODE'];
// The right-hand model is drawn dashed everywhere, so the two runs differ by more than color.
const DASH = [6, 4];
const HOURS = ['0', '1', '2', '3', '4', '5', '6'];
const SEVERITY_FEATURES = ['MAP', 'HR', 'pulsatility'];
const API = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:8000');

const patientIndex = p => Number(p.id.slice(1));
const isHourLabel = l => typeof l === 'string' && (l.startsWith('T') || l.startsWith('Hour '));

// Writes each model's name just past the end of its forecast line, nudging the pair apart if they'd overlap.
const endLabels = {
  id: 'endLabels',
  afterDatasetsDraw(chart, _args, opts) {
    const items = chart.data.datasets.flatMap((ds, i) => {
      const pt = ds.endLabel ? chart.getDatasetMeta(i).data.at(-1) : null;
      return pt && Number.isFinite(pt.y) ? [{ text: ds.endLabel, x: pt.x + 8, y: pt.y }] : [];
    });
    if (items.length === 2 && Math.abs(items[0].y - items[1].y) < 12) {
      const [upper, lower] = items[0].y <= items[1].y ? items : [items[1], items[0]];
      const mid = (upper.y + lower.y) / 2;
      upper.y = mid - 6;
      lower.y = mid + 6;
    }
    const { ctx } = chart;
    ctx.save();
    ctx.font = `10px ${chart.options.font?.family ?? 'sans-serif'}`;
    ctx.fillStyle = opts.color;
    ctx.textBaseline = 'middle';
    items.forEach(it => ctx.fillText(it.text, it.x, it.y));
    ctx.restore();
  },
};

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
              <div className="text-xs px-4 py-3" style={{ color: s.subtext }}>No results found</div>
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
                      className="text-[11px] px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
                      style={{ color: sc, background: sc + '18' }}>
                      {status?.icon}
                      <span>{status?.label}</span>
                    </span>
                    <span className="text-xs font-mono font-semibold flex-shrink-0" style={{ color: sc }}>
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

/** Display-only P-level rollout: hour 0 is the patient's starting level, hours 1–6 the model's picks. */
function PLevelChart({ levels, dashed, s, scheme }) {
  const data = useMemo(() => ({
    labels: HOURS,
    datasets: levels
      ? [{
          data: levels,
          borderColor: scheme.primary,
          borderWidth: 2,
          borderDash: dashed ? DASH : [],
          stepped: 'before',
          clip: false,
          pointRadius: 4,
          pointBackgroundColor: levels.map((_, i) => (i ? scheme.primary : scheme.accent)),
          pointBorderColor: levels.map((_, i) => (i ? scheme.primary : scheme.accent)),
        }]
      : [],
  }), [levels, dashed, scheme]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    events: [], // no hover, tooltip or evaluate popup
    layout: { padding: { top: 4, bottom: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      annotation: {
        common: { drawTime: 'beforeDatasetsDraw' },
        annotations: {
          forecastRegion: { type: 'box', xMin: 1, xMax: 6, backgroundColor: `${scheme.forecast}18`, borderWidth: 0 },
          forecastStart: { type: 'line', xMin: 1, xMax: 1, borderColor: s.subtext, borderWidth: 1.25, borderDash: [4, 4] },
        },
      },
    },
    scales: {
      x: {
        grid: { color: s.gridColor },
        border: { display: false },
        title: { display: true, text: 'Hour', color: s.subtext, font: { size: 11, weight: '600' } },
        ticks: { color: s.subtext, font: { size: 11, weight: '500' } },
      },
      y: {
        min: 2,
        max: 9,
        grid: { color: s.gridColor, borderDash: [3, 3] },
        border: { display: false },
        title: { display: true, text: 'P-level', color: s.subtext, font: { size: 11, weight: '600' } },
        ticks: { color: s.subtext, font: { size: 10 }, stepSize: 1, autoSkip: false, callback: v => `P${v}` },
      },
    },
  }), [s, scheme]);

  return <Line data={data} options={options} />;
}

/** Historical line plus one forecast line (with its ±σ band) per model run, labeled with its model at the right end. */
function FeatureChart({ feature, thr, hist, runs, s, scheme, isDark }) {
  const { data, options } = useMemo(() => {
    const sev = SEVERITY_FEATURES.includes(feature);
    const plain = isDark ? '#6B7280' : '#2A3340';
    const forecasts = runs && hist.length ? runs : [];
    const labels = [...hist.map(r => r.label), ...(forecasts[0]?.forecast.map(r => r.label) ?? [])];
    const color = v => (typeof v !== 'number' ? 'transparent' : sev ? continuousSeverityColor(v, thr) : plain);
    const big = c => isHourLabel(labels[c.dataIndex]);
    const line = (label, values, width, dash) => ({
      label,
      data: values,
      borderColor: plain,
      borderWidth: width,
      borderDash: dash,
      // Severity features: each segment takes the severity color of its midpoint.
      ...(sev && { segment: { borderColor: c => continuousSeverityColor((c.p0.parsed.y + c.p1.parsed.y) / 2, thr) } }),
      tension: 0,
      spanGaps: true,
      pointRadius: c => (big(c) ? 4.5 : 2.5),
      pointHoverRadius: c => (big(c) ? 5.5 : 3.5),
      pointHitRadius: 8,
      pointBackgroundColor: c => color(c.raw),
      pointBorderColor: c => (big(c) ? plain : 'transparent'),
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
      ...forecasts.map((run, i) => ({
        ...line(run.model, series(run, feature), 3, i ? DASH : []),
        endLabel: run.model,
      })),
    ];

    return {
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { right: forecasts.length ? 110 : 8 } }, // room for the end labels
        plugins: {
          legend: { display: false },
          endLabels: { color: s.subtext },
          annotation: {
            common: { drawTime: 'beforeDatasetsDraw' },
            annotations: forecasts.length
              ? {
                  forecastStart: {
                    type: 'line',
                    xMin: hist.length - 1,
                    xMax: hist.length - 1,
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
              labelColor: c => ({ borderColor: color(c.parsed.y), backgroundColor: color(c.parsed.y) }),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: s.subtext,
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: false,
              callback: (_v, i) => (isHourLabel(labels[i]) ? labels[i] : labels[i] === '+30m' ? '+30 min' : undefined),
            },
          },
          y: {
            grid: { color: s.gridColor, borderDash: [3, 3] },
            border: { display: false },
            ticks: { color: s.subtext, font: { size: 10 } },
          },
        },
      },
    };
  }, [feature, thr, hist, runs, s, scheme, isDark]);

  return <Line data={data} options={options} plugins={[endLabels]} />;
}

export default function NeuripsDemo() {
  const { scheme, isDark, thresholds } = useTheme();
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
      const data = await Promise.all(models.map(async model => {
        const res = await fetch(`${API}/api/policy_forecast?${new URLSearchParams({ patient_id: patient.id, model })}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof body.detail === 'string' ? body.detail : `${model}: HTTP ${res.status}`);
        return body;
      }));
      setResult({ key: runKey, runs: data });
    } catch (e) {
      setResult({ key: runKey, error: e instanceof Error ? e.message : 'Forecast failed' });
    } finally {
      setRunning(false);
    }
  }

  const hist = patient?.timeline ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: s.bg }}>
      <header className="flex items-center gap-4 px-5 py-3 border-b flex-shrink-0" style={{ borderColor: s.border }}>
        <PatientSearch
          patients={patients}
          loading={patientsLoading}
          selectedId={patient?.id}
          onSelect={setSelectedPatientId}
          s={s}
          scheme={scheme}
        />
        {patientsError && (
          <span role="alert" className="text-xs" style={{ color: scheme.critical }}>{patientsError}</span>
        )}
        <div className="ml-auto flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-xs" style={{ color: s.subtext }}>Index</span>
          <span className="text-sm font-semibold font-mono" style={{ color: s.text }}>
            {patient ? patientIndex(patient) : '—'}
          </span>
        </div>
      </header>

      {/* Keeps a usable minimum width and scrolls sideways instead of squashing the graphs. */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="h-full min-w-[900px] flex flex-col">
          <section
            className="flex-shrink-0 border-b px-5 pt-4 pb-3"
            style={{ background: s.sidebar, borderColor: s.border }}>
            <div className="flex gap-3" style={{ height: 250 }}>
              {[0, 1].map(i => (
                <div
                  key={i}
                  className="flex-1 min-w-0 rounded-2xl border-2 flex flex-col px-3 py-2"
                  style={{ background: s.sidebar, borderColor: s.border }}>
                  <select
                    value={models[i]}
                    onChange={e => {
                      const m = e.target.value;
                      setModels(prev => (i ? [prev[0], m] : [m, prev[1]]));
                    }}
                    aria-label={`Model for the ${i ? 'right' : 'left'} graph`}
                    className="self-start mb-1.5 px-2.5 py-2 rounded-lg border text-sm font-semibold cursor-pointer"
                    style={{ background: s.inputBg, color: s.text, borderColor: s.border, colorScheme: isDark ? 'dark' : 'light' }}>
                    <option value="" disabled>Select model…</option>
                    {MODELS.map(m => (
                      <option key={m} value={m} disabled={m === models[1 - i]}>{m}</option>
                    ))}
                  </select>
                  <div className="flex-1 min-h-0 relative">
                    <PLevelChart
                      levels={runs && patient ? [patient.deviceLevel, ...runs[i].p_levels] : null}
                      dashed={i === 1}
                      s={s}
                      scheme={scheme}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Run button centered under the graphs; severity legend at the right of the same row. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-3">
              <button
                type="button"
                onClick={runForecast}
                disabled={!ready || running}
                className="col-start-2 px-4 py-2 rounded-lg border font-semibold text-sm flex items-center gap-2 transition-all disabled:cursor-not-allowed"
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
              <div className="justify-self-end flex items-center gap-3">
                <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: s.subtext }}>
                  Severity
                </span>
                <div className="w-56">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      background: `linear-gradient(to right, ${CHART_STATUS.normal}, ${CHART_STATUS.warning}, ${CHART_STATUS.critical})`,
                    }}
                  />
                  <div className="flex justify-between mt-1 text-xs font-medium" style={{ color: s.subtext }}>
                    <span>Normal</span>
                    <span>Warning</span>
                    <span>Critical</span>
                  </div>
                </div>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-xs text-center mt-1.5" style={{ color: scheme.critical }}>{error}</p>
            )}
          </section>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {featureDisplayOrder.map(feature => {
              const cfg = featureConfigs[feature];
              return (
                <div
                  key={feature}
                  className="rounded-xl border"
                  style={{ background: s.sidebar, borderColor: s.border }}>
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: s.border }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                    <span className="text-sm font-semibold" style={{ color: s.text }}>{cfg.label}</span>
                    <span className="text-xs" style={{ color: s.subtext }}>({cfg.unit})</span>
                  </div>
                  <div className="px-2 pt-3 pb-2">
                    <div className="relative w-full" style={{ height: 170 }}>
                      <FeatureChart
                        feature={feature}
                        thr={thresholds[feature]}
                        hist={hist}
                        runs={runs}
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
