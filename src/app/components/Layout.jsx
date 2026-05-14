import { useState, useMemo, useRef, useEffect } from 'react';
import { NavLink, Outlet, useOutletContext, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, Sliders, Brain, Settings, ChevronLeft, ChevronRight,
  Search, Sun, Moon, X, TrendingUp, AlertCircle, CheckCircle, Clock
} from 'lucide-react';
import { useTheme, getSurfaces, getStatusColor } from '../context/ThemeContext';
import { HeartLevel1 } from './heart/HeartLevel1';
import { HeartLevel2 } from './heart/HeartLevel2';
import { HeartLevel3 } from './heart/HeartLevel3';
import { SettingsPanel } from './SettingsPanel';

export function useLayoutContext() {
  return useOutletContext();
}

const navItems = [
  { to: '/',          label: 'Overview',    icon: Home },
  { to: '/policy',    label: 'Policy Eval', icon: Brain },
  { to: '/simulator', label: 'Simulator',   icon: Sliders },
];

const severityOrder = { critical: 0, warning: 1, stable: 2, improving: 3, weaned: 4 };

const statusConfig = {
  critical:  { icon: <AlertCircle size={10} />, label: 'Critical' },
  warning:   { icon: <AlertCircle size={10} />, label: 'Warning' },
  stable:    { icon: <Clock       size={10} />, label: 'Stable' },
  improving: { icon: <TrendingUp  size={10} />, label: 'Improving' },
  weaned:    { icon: <CheckCircle size={10} />, label: 'Weaned' },
};

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

export default function Layout() {
  const { isDark, setIsDark, scheme, heartVariant } = useTheme();
  const location = useLocation();
  const isHome = location.pathname === '/';

  const [collapsed, setCollapsed]         = useState(false);
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [patients, setPatients]          = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  // Single source of truth: fetch patients from API (same TimeSeriesDataset as backend)
  useEffect(() => {
    let cancelled = false;
    async function fetchPatients() {
      try {
        setPatientsLoading(true);
        setPatientsError(null);
        const base = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '' : 'http://localhost:8000');
        const res = await fetch(`${base}/api/patients`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setPatients(data);
          setSelectedPatientId(prev => {
            if (data.length === 0) return null;
            const inList = prev && data.some(p => p.id === prev);
            return inList ? prev : data[0].id;
          });
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setPatientsError('Failed to load patients');
        }
      } finally {
        if (!cancelled) setPatientsLoading(false);
      }
    }
    fetchPatients();
    return () => { cancelled = true; };
  }, []);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const s       = getSurfaces(isDark);
  const bg      = s.bg;
  const sidebar = s.sidebar;
  const border  = s.border;
  const text    = s.text;
  const subtext = s.subtext;
  const inputBg = s.inputBg;
  const muted   = s.muted;

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return patients
      .map(p => ({ ...p, _score: scoreMatch(p, searchQuery) }))
      .filter(p => p._score >= 0)
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return (severityOrder[a.status] ?? 5) - (severityOrder[b.status] ?? 5);
      });
  }, [patients, searchQuery]);

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

  const handleSelectSuggestion = (patientId) => {
    setSelectedPatientId(patientId);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const selectedSc        = selectedPatient ? getStatusColor(selectedPatient.status, scheme) : subtext;
  const selectedStatusCfg = selectedPatient ? statusConfig[selectedPatient.status] : null;

  return (
    <div style={{ background: bg }} className="flex h-screen w-full overflow-hidden">
      {/* Main Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        style={{ background: sidebar, borderColor: border }}
        className="flex flex-col border-r z-20 flex-shrink-0 overflow-hidden"
      >
        {/* Logo — fixed */}
        <div style={{ borderColor: border }} className="flex items-center gap-2.5 px-4 py-4 border-b flex-shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: s.logoTile }}
          >
            <img src="/logo.svg" alt="" className="w-7 h-7 object-contain" width={28} height={28} />
          </div>
          <AnimatedText collapsed={collapsed}>
            <div className="font-heading leading-tight">
              <div style={{ color: text }} className="text-base font-semibold">SmartWean</div>
              <div style={{ color: subtext }} className="text-[11px]">Weaning Monitor</div>
            </div>
          </AnimatedText>
        </div>

        {/* Navigation — fixed */}
        <nav className="p-2 space-y-0.5 mt-2 flex-shrink-0">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {({ isActive }) => (
                <div
                  style={{
                    background: isActive ? scheme.primary + '22' : 'transparent',
                    borderColor: isActive ? scheme.primary + '55' : 'transparent',
                    color: isActive ? scheme.primary : subtext,
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all hover:opacity-90 cursor-pointer">
                  <Icon size={17} className="flex-shrink-0" />
                  <AnimatedText collapsed={collapsed}>
                    <span
                      className="text-sm font-medium whitespace-nowrap"
                      style={{ color: isActive ? scheme.primary : text }}
                    >
                      {label}
                    </span>
                  </AnimatedText>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/*
          Patient Search + Heart — shown on non-home, non-collapsed screens.
          Search bar at top with floating suggestions overlapping heart viz.
        */}
        {!collapsed && !isHome && (
          <div style={{ borderColor: border }} className="border-t flex-1 min-h-0 overflow-y-auto">

            {/* Sticky search bar + floating suggestions */}
            <div ref={searchRef} className="sticky top-0 z-20 px-3 pt-3 pb-2" style={{ background: sidebar }}>
              <div
                style={{
                  background: inputBg,
                  borderColor: showSuggestions && searchQuery ? scheme.primary + '77' : border,
                }}
                className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg border transition-colors"
              >
                <Search size={11} style={{ color: showSuggestions && searchQuery ? scheme.primary : subtext, flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search patients…"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  style={{ background: 'transparent', color: text }}
                  className="flex-1 text-xs outline-none min-w-0"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
                    style={{ color: subtext }}
                    className="hover:opacity-70 transition-opacity flex-shrink-0 p-0.5">
                    <X size={10} />
                  </button>
                )}
              </div>

              {/* Floating suggestions dropdown — overlaps heart viz below */}
              <AnimatePresence>
                {showSuggestions && searchQuery.trim() && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    style={{ background: sidebar, borderColor: border, zIndex: 50 }}
                    className="absolute left-3 right-3 top-full mt-0.5 rounded-xl border shadow-2xl overflow-hidden"
                  >
                    {suggestions.length === 0 ? (
                      <div style={{ color: subtext }} className="text-xs px-3 py-2.5">
                        No results found
                      </div>
                    ) : (
                      suggestions.map((p, idx) => {
                        const sc = getStatusColor(p.status, scheme);
                        const isSelected = p.id === selectedPatientId;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleSelectSuggestion(p.id)}
                            style={{
                              background: isSelected ? scheme.primary + '14' : 'transparent',
                              borderBottom: idx < suggestions.length - 1 ? `1px solid ${border}` : 'none',
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80 transition-opacity"
                          >
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc }} />
                            <span style={{ color: isSelected ? scheme.primary : text }} className="text-xs font-medium flex-1 truncate">
                              {p.name}
                            </span>
                            <span style={{ color: sc }} className="text-xs font-mono font-semibold flex-shrink-0">
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

            {/* Selected patient name box */}
            {selectedPatient && (
              <div className="px-3 pb-2">
                <div style={{ background: muted, borderColor: border }} className="rounded-lg px-3 py-2 border">
                  <div style={{ color: text }} className="text-xs font-semibold truncate">{selectedPatient.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span style={{ color: selectedSc, background: selectedSc + '18' }}
                      className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      {selectedStatusCfg?.icon}
                      <span>{selectedStatusCfg?.label}</span>
                    </span>
                    <span style={{ color: selectedSc }} className="text-xs font-mono font-semibold">P{selectedPatient.deviceLevel}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Separator */}
            <div style={{ borderColor: border }} className="border-t mx-3 mb-3" />

            {/* Heart visualization — heart graphic is 1/2–2/3 width in sidebar (compact), box stays full width */}
            <div className="px-3 pb-4">
              {heartVariant === 1 && selectedPatient && (
                <HeartLevel1
                  status={selectedPatient.status}
                  heartRate={selectedPatient.timeline?.[5]?.HR}
                  pulsatility={selectedPatient.timeline?.[5]?.pulsatility}
                  compact
                />
              )}
              {heartVariant === 2 && selectedPatient && (
                <HeartLevel2
                  features={selectedPatient.timeline?.[5] ?? {}}
                  status={selectedPatient.status}
                  compact
                />
              )}
              {heartVariant === 3 && selectedPatient && (
                <HeartLevel3
                  features={selectedPatient.timeline?.[5] ?? {}}
                  status={selectedPatient.status}
                  compact
                />
              )}
            </div>
          </div>
        )}

        {/* Spacer for home/collapsed states */}
        {(isHome || collapsed) && <div className="flex-1" />}

        {/* Bottom actions — fixed */}
        <div style={{ borderColor: border }} className="border-t p-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSettingsOpen(true)}
              style={{ color: text }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:opacity-80 transition-opacity">
              <Settings size={16} />
              <AnimatedText collapsed={collapsed}>
                <span className="text-sm">Settings</span>
              </AnimatedText>
            </button>
            <div className="flex items-center gap-1">
              {/* Dark/Light mode toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                style={{
                  color: isDark ? scheme.accent : scheme.warning,
                  background: isDark ? scheme.accent + '18' : scheme.warning + '18',
                }}
                className="p-2 rounded-lg hover:opacity-80 transition-all flex-shrink-0">
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button onClick={() => setCollapsed(!collapsed)} style={{ color: subtext }}
                className="p-2 rounded-lg hover:opacity-80 transition-opacity flex-shrink-0">
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <Outlet context={{
          selectedPatientId,
          setSelectedPatientId,
          patients,
          patientsLoading,
          patientsError,
          selectedPatient,
        }} />
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function AnimatedText({ collapsed, children }) {
  return (
    <motion.div
      animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden whitespace-nowrap">
      {children}
    </motion.div>
  );
}