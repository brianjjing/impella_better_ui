import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Sliders, Brain, Heart, ChevronRight, TrendingUp,
  AlertCircle, CheckCircle, Clock, Zap, Shield, BarChart2, Search, X
} from 'lucide-react';
import { useTheme, getSurfaces, getStatusColor } from '../context/ThemeContext';
import { featureKeys, featureConfigs } from '../data/mockData';
import { useLayoutContext } from '../components/Layout';
import { HeartLevel3 } from '../components/heart/HeartLevel3';
import { HeartLevel2 } from '../components/heart/HeartLevel2';
import { HeartLevel1 } from '../components/heart/HeartLevel1';

const statusConfig = {
  critical:  { icon: <AlertCircle size={12} />, label: 'Critical' },
  warning:   { icon: <AlertCircle size={12} />, label: 'Warning' },
  stable:    { icon: <Clock       size={12} />, label: 'Stable' },
  improving: { icon: <TrendingUp  size={12} />, label: 'Improving' },
  weaned:    { icon: <CheckCircle size={12} />, label: 'Weaned' },
};

const severityOrder = { critical: 0, warning: 1, stable: 2, improving: 3, weaned: 4 };

function formatMetricValue(val) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  return val > 100 ? String(Math.round(val)) : val.toFixed(val < 10 ? 2 : 0);
}

function MetricPopoverPortal({
  metricKey,
  features,
  metricPopoverPos,
  card,
  border,
  text,
  subtext,
  scheme,
  isDark,
  metricPopoverRef,
  onClose,
}) {
  const cfg = featureConfigs[metricKey];
  const val = features?.[metricKey];
  const isOutOfRange = typeof val === 'number' && Number.isFinite(val)
    && (val < cfg.normalMin || val > cfg.normalMax);
  const rangeLabel = `${cfg.normalMin}–${cfg.normalMax} ${cfg.unit}`;
  const rangeTitle = cfg.deviceMetric ? 'Typical operating range' : 'Healthy range';
  return createPortal(
    <div
      ref={metricPopoverRef}
      data-metric-popover
      className="fixed z-[200] w-[260px] rounded-xl border p-3 shadow-2xl"
      style={{
        top: metricPopoverPos.top,
        left: metricPopoverPos.left,
        background: card,
        borderColor: border,
        boxShadow: `0 12px 40px ${isDark ? '#000000aa' : '#64748b44'}`,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div style={{ color: text }} className="text-sm font-semibold leading-snug pr-1">
          {cfg.label}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{ color: subtext }}
          className="p-0.5 rounded-md hover:opacity-80 shrink-0"
        >
          <X size={16} />
        </button>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-3">
          <span style={{ color: subtext }}>Value</span>
          <span
            className="font-mono font-semibold"
            style={{ color: isOutOfRange ? scheme.critical : text }}
          >
            {formatMetricValue(val)} {cfg.unit}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: subtext }}>{rangeTitle}</span>
          <span style={{ color: text }} className="font-mono text-right">
            {rangeLabel}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function scoreMatch(patient, query) {
  const q = query.toLowerCase().trim();
  if (!q) return -1;
  const name = patient.name.toLowerCase();
  const mrn  = patient.mrn.toLowerCase();
  if (name.startsWith(q)) return 3;
  if (name.split(' ').some(w => w.startsWith(q))) return 2;
  if (name.includes(q)) return 1;
  if (mrn.includes(q)) return 0;
  return -1;
}


export default function MainMenu() {
  const navigate = useNavigate();
  const { scheme, isDark, heartVariant } = useTheme();
  const { patients, patientsLoading, patientsError, selectedPatientId, setSelectedPatientId, selectedPatient } = useLayoutContext();

  const [searchQuery, setSearchQuery]       = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  const [metricDetailKey, setMetricDetailKey] = useState(null);
  const [hoveredMetricKey, setHoveredMetricKey] = useState(null);
  const [metricPopoverPos, setMetricPopoverPos] = useState({ top: 0, left: 0 });
  const metricPopoverRef = useRef(null);

  const features = selectedPatient?.timeline?.[5] ?? {};

  const s       = getSurfaces(isDark);
  const bg      = s.bg;
  const card    = s.card;
  const border  = s.border;
  const text    = s.text;
  const subtext = s.subtext;
  const muted   = s.muted;
  const inputBg = s.inputBg;

  const patientStatusColor = selectedPatient
    ? getStatusColor(selectedPatient.status, scheme)
    : scheme.primary;

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return patients
      .map(p => ({ ...p, _score: scoreMatch(p, searchQuery) }))
      .filter(p => p._score >= 0)
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return (severityOrder[a.status] ?? 5) - (severityOrder[b.status] ?? 5);
      });
  }, [searchQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const closeMetricDetail = useCallback(() => {
    setMetricDetailKey(null);
  }, []);

  useEffect(() => {
    if (!metricDetailKey) return;
    const onDown = (e) => {
      if (metricPopoverRef.current?.contains(e.target)) return;
      if (e.target.closest?.('[data-metric-trigger]')) return;
      closeMetricDetail();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [metricDetailKey, closeMetricDetail]);

  const openMetricDetail = (key, el) => {
    const r = el.getBoundingClientRect();
    const pad = 8;
    const popoverWidth = 260;
    let left = r.left;
    if (left + popoverWidth > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - popoverWidth - pad);
    }
    setMetricPopoverPos({ top: r.bottom + 6, left });
    setMetricDetailKey(key);
  };

  const handleMetricTriggerClick = (key, e) => {
    e.stopPropagation();
    if (metricDetailKey === key) {
      closeMetricDetail();
      return;
    }
    openMetricDetail(key, e.currentTarget);
  };

  const handleSelectSuggestion = (patientId) => {
    setSelectedPatientId(patientId);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div style={{ borderColor: border, background: card }}
        className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 style={{ color: text }} className="font-heading text-xl font-semibold">SmartWean AI Weaning Monitor</h1>
          <p style={{ color: subtext }} className="text-xs">
            Physician dashboard · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ background: scheme.primary + '22', borderColor: scheme.primary + '55', color: scheme.primary }}
            className="px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5">
            <Zap size={11} /> AI Active
          </div>
          <div style={{ background: muted, color: subtext }} className="px-3 py-1.5 rounded-full text-xs">
            {patients.length} patients
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Feature cards */}
        {/* <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Shield,   label: 'AI-Guided Weaning',    desc: 'Offline RL policy continuously evaluates optimal pump power reduction, balancing cardiac recovery with hemodynamic stability.', color: scheme.primary },
            { icon: Activity, label: '12-Feature Monitoring', desc: 'Real-time tracking of MAP, LVP, LVEDP, HR, pulsatility, elastance, and more — all synchronized across 6 time-steps.',         color: scheme.accent },
            { icon: BarChart2, label: 'Predictive Simulation', desc: 'Forecast patient hemodynamics 6 hours ahead given any pump power level, using validated physiological models.',                  color: scheme.good },
          ].map(({ icon: Icon, label, desc, color }, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              style={{ background: card, borderColor: border }} className="rounded-xl border p-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: color + '22' }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div style={{ color: text }} className="text-sm font-semibold mb-1">{label}</div>
              <p style={{ color: subtext }} className="text-xs leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div> */}

        {/* Search + patient details section */}
        <div className="space-y-4">
          {/* Search bar with floating suggestions */}
          <div ref={searchRef} className="relative">
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              style={{ background: card, borderColor: showSuggestions && searchQuery ? scheme.primary + '55' : border }}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-colors"
            >
              <Search size={14} style={{ color: showSuggestions && searchQuery ? scheme.primary : subtext }} />
              <input
                type="text"
                placeholder="Search active patients by name or MRN…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                style={{ background: 'transparent', color: text }}
                className="flex-1 text-base outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
                  style={{ color: subtext }}
                  className="hover:opacity-70 transition-opacity p-0.5">
                  <X size={13} />
                </button>
              )}
            </motion.div>

            {/* Floating suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && searchQuery.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.99 }}
                  transition={{ duration: 0.15 }}
                  style={{ background: card, borderColor: border }}
                  className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border shadow-2xl z-50 overflow-hidden"
                >
                  {suggestions.length === 0 ? (
                    <div style={{ color: subtext }} className="text-xs px-4 py-3">
                      No results found
                    </div>
                  ) : (
                    <div>
                      {suggestions.map((p, idx) => {
                        const sc = getStatusColor(p.status, scheme);
                        const statusCfg = statusConfig[p.status];
                        const isSelected = p.id === selectedPatientId;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleSelectSuggestion(p.id)}
                            style={{
                              background: isSelected ? scheme.primary + '14' : idx % 2 === 0 ? 'transparent' : muted + '66',
                              borderBottom: idx < suggestions.length - 1 ? `1px solid ${border}` : 'none',
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left hover:opacity-80"
                          >
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc }} />
                            <span style={{ color: isSelected ? scheme.primary : text }} className="text-base font-medium flex-1">
                              {p.name}
                            </span>
                            <span style={{ color: sc, background: sc + '18' }}
                              className="text-[11px] px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                              {statusCfg.icon}
                              <span>{statusCfg.label}</span>
                            </span>
                            <span style={{ color: sc }} className="text-xs font-mono font-semibold flex-shrink-0">
                              P{p.deviceLevel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Patient details + heart + navigation */}
          <div className="grid grid-cols-5 gap-5">
            {/* Selected patient card */}
            <motion.div key={selectedPatientId}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: card, borderColor: border }}
              className="col-span-3 rounded-xl border p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 style={{ color: text }} className="text-xl font-semibold">{selectedPatient?.name}</h2>
                  <p style={{ color: subtext }} className="text-sm mt-0.5">{selectedPatient?.diagnosis}</p>
                  <p style={{ color: subtext }} className="text-sm">
                    Attending: {selectedPatient?.physician} · Admitted {selectedPatient?.admissionDate}
                  </p>
                </div>
                <div
                  style={{
                    background: patientStatusColor + '22',
                    color: patientStatusColor,
                  }}
                  className="text-sm font-semibold px-3 py-1 rounded-full capitalize">
                  {selectedPatient?.status}
                </div>
              </div>

              <div className="mb-4 w-full">
                {heartVariant === 3 && selectedPatient && (
                  <HeartLevel3 features={features} status={selectedPatient.status} />
                )}
                {heartVariant === 2 && selectedPatient && (
                  <HeartLevel2 features={features} status={selectedPatient.status} />
                )}
                {heartVariant === 1 && selectedPatient && (
                  <div className="py-4">
                    <HeartLevel1
                      status={selectedPatient.status}
                      heartRate={features?.HR}
                      pulsatility={features?.pulsatility}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {featureKeys.map(key => {
                  const cfg = featureConfigs[key];
                  const val = features?.[key];
                  const isOutOfRange = typeof val === 'number' && Number.isFinite(val)
                    && (val < cfg.normalMin || val > cfg.normalMax);
                  const numColor = isOutOfRange ? scheme.critical : text;
                  const isOpen = metricDetailKey === key;
                  const isHover = hoveredMetricKey === key;
                  const metricBoxShadow = isOpen
                    ? `0 0 0 1px ${scheme.primary}55, 0 8px 28px ${scheme.primary}45`
                    : isHover
                      ? `0 0 0 1px ${scheme.primary}44, 0 4px 20px ${scheme.good}55`
                      : 'none';
                  return (
                    <motion.button
                      key={key}
                      type="button"
                      data-metric-trigger
                      onClick={e => handleMetricTriggerClick(key, e)}
                      onMouseEnter={() => setHoveredMetricKey(key)}
                      onMouseLeave={() => setHoveredMetricKey(k => (k === key ? null : k))}
                      whileHover={{
                        scale: 1.03,
                        transition: { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] },
                      }}
                      whileTap={{ scale: 0.99 }}
                      style={{
                        background: muted,
                        boxShadow: metricBoxShadow,
                      }}
                      className="rounded-lg p-2 text-center w-full cursor-pointer border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <div style={{ color: subtext }} className="text-[11px] truncate pointer-events-none">
                        {cfg.label.split(' ').slice(0, 2).join(' ')}
                      </div>
                      <div className="text-base font-mono font-semibold pointer-events-none" style={{ color: numColor }}>
                        {formatMetricValue(val)}
                      </div>
                      <div style={{ color: subtext }} className="text-[11px] pointer-events-none">{cfg.unit}</div>
                    </motion.button>
                  );
                })}
              </div>

              {metricDetailKey && (
                <MetricPopoverPortal
                  metricKey={metricDetailKey}
                  features={features}
                  metricPopoverPos={metricPopoverPos}
                  card={card}
                  border={border}
                  text={text}
                  subtext={subtext}
                  scheme={scheme}
                  isDark={isDark}
                  metricPopoverRef={metricPopoverRef}
                  onClose={closeMetricDetail}
                />
              )}
            </motion.div>

            {/* Navigation cards */}
            <div className="col-span-2 flex flex-col gap-3">
              {[
                { to: '/timeline',  icon: Activity, label: 'Patient Timeline',  desc: 'Visualize 12 features over time with zoom & annotations', color: scheme.primary },
                { to: '/simulator', icon: Sliders,  label: 'Pump Simulator',    desc: 'Forecast hemodynamics for P2–P9 over 6 hours',           color: scheme.accent },
                { to: '/policy',    icon: Brain,    label: 'Policy Evaluation', desc: 'AI-guided weaning recommendations and patient trajectories', color: scheme.good },
              ].map(({ to, icon: Icon, label, desc, color }, i) => (
                <motion.button key={to}
                  onClick={() => navigate(to)}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + i * 0.08 }}
                  whileHover={{ y: -2, boxShadow: `0 8px 24px ${color}33` }}
                  style={{ background: color + '18', borderColor: color + '44' }}
                  className="flex-1 rounded-xl border p-4 text-left transition-all cursor-pointer">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: color + '33' }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div style={{ color: text }} className="text-m font-semibold mb-1">{label}</div>
                  <p style={{ color: subtext }} className="text-xs leading-relaxed mb-3">{desc}</p>
                  <div className="flex items-center gap-1" style={{ color }}>
                    <span className="text-sm font-medium">Open</span>
                    <ChevronRight size={12} />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
