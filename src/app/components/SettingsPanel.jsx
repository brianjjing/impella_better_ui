import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Moon, Sun, Heart, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme, colorSchemes } from '../context/ThemeContext';
import { featureConfigs, featureKeys } from '../data/mockData';

export function SettingsPanel({ open, onClose }) {
  const { isDark, setIsDark, colorScheme, setColorScheme, heartVariant, setHeartVariant,
          thresholds, setThreshold, scheme } = useTheme();
  const [expandedThreshold, setExpandedThreshold] = useState(null);

  const panelBg      = isDark ? '#0F172A' : '#FFFFFF';
  const borderColor  = isDark ? '#1E293B' : '#E2E8F0';
  const textColor    = isDark ? '#E2E8F0' : '#1E293B';
  const subtextColor = isDark ? '#9CA3AF' : '#4B5563';
  const sectionBg    = isDark ? '#1E293B' : '#F8FAFC';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ background: panelBg, borderColor }}
            className="fixed top-0 right-0 h-full w-80 z-50 border-l shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b"
              style={{ background: panelBg, borderColor }}>
              <div className="flex items-center gap-2">
                <Settings2 size={16} style={{ color: scheme.primary }} />
                <span style={{ color: textColor }} className="font-semibold">Settings</span>
              </div>
              <button onClick={onClose} style={{ color: subtextColor }}
                className="hover:opacity-80 transition-opacity p-1 rounded">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Appearance */}
              <Section title="Appearance" bg={sectionBg} border={borderColor} text={textColor}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isDark
                      ? <Moon size={14} style={{ color: subtextColor }} />
                      : <Sun  size={14} style={{ color: subtextColor }} />}
                    <span style={{ color: subtextColor }} className="text-sm">
                      {isDark ? 'Dark Mode' : 'Light Mode'}
                    </span>
                  </div>
                  <Toggle value={isDark} onChange={setIsDark} color={scheme.primary} />
                </div>
              </Section>

              {/* Color Scheme */}
              <Section title="Color Scheme" bg={sectionBg} border={borderColor} text={textColor}>
                <div className="grid grid-cols-1 gap-2">
                  {colorSchemes.map(s => (
                    <button key={s.id}
                      onClick={() => setColorScheme(s.id)}
                      style={{
                        borderColor: colorScheme === s.id ? s.primary : borderColor,
                        background:  colorScheme === s.id ? s.primary + '18' : 'transparent',
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left">
                      <div className="flex gap-1">
                        {s.swatchColors.map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                        ))}
                      </div>
                      <div>
                        <div style={{ color: colorScheme === s.id ? s.primary : textColor }}
                          className="text-sm font-medium">{s.name}</div>
                        <div style={{ color: subtextColor }} className="text-xs">{s.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>

              {/* Heart Visualization */}
              <Section title="Heart Visualization" bg={sectionBg} border={borderColor} text={textColor}>
                <div className="space-y-2">
                  {[
                    { v: 1, label: 'Functional', desc: 'Clean pulsing icon — max clarity' },
                    { v: 2, label: 'Standard',   desc: 'Anatomical heart with metrics' },
                    { v: 3, label: 'Immersive',  desc: 'Live canvas — ECG & animation' },
                  ].map(({ v, label, desc }) => (
                    <button key={v}
                      onClick={() => setHeartVariant(v)}
                      style={{
                        borderColor: heartVariant === v ? scheme.primary : borderColor,
                        background:  heartVariant === v ? scheme.primary + '18' : 'transparent',
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left">
                      <Heart size={16} style={{ color: heartVariant === v ? scheme.primary : subtextColor }} />
                      <div>
                        <div style={{ color: heartVariant === v ? scheme.primary : textColor }}
                          className="text-sm font-medium">Mode {v}: {label}</div>
                        <div style={{ color: subtextColor }} className="text-xs">{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>

              {/* Alert Thresholds */}
              <Section title="Alert Thresholds" bg={sectionBg} border={borderColor} text={textColor}>
                <p style={{ color: subtextColor }} className="text-xs mb-3">
                  Configure normal and warning ranges for each physiological feature.
                </p>
                <div className="space-y-2">
                  {featureKeys.map(key => {
                    const cfg = featureConfigs[key];
                    const thr = thresholds[key];
                    const isExpanded = expandedThreshold === key;
                    return (
                      <div key={key} style={{ borderColor }} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedThreshold(isExpanded ? null : key)}
                          className="w-full flex items-center justify-between p-2.5"
                          style={{ background: sectionBg }}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                            <span style={{ color: textColor }} className="text-xs font-medium">{cfg.label}</span>
                          </div>
                          {isExpanded
                            ? <ChevronUp   size={12} style={{ color: subtextColor }} />
                            : <ChevronDown size={12} style={{ color: subtextColor }} />}
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                              className="overflow-hidden">
                              <div className="p-3 space-y-2">
                                {[
                                  { label: 'Normal Min',  k: 'normalMin'  },
                                  { label: 'Normal Max',  k: 'normalMax'  },
                                  { label: 'Warning Min', k: 'warningMin' },
                                  { label: 'Warning Max', k: 'warningMax' },
                                ].map(({ label, k }) => (
                                  <div key={k} className="flex items-center justify-between gap-2">
                                    <label style={{ color: subtextColor }} className="text-xs w-24">{label}</label>
                                    <input
                                      type="number"
                                      value={thr[k]}
                                      onChange={e => setThreshold(key, { ...thr, [k]: parseFloat(e.target.value) || 0 })}
                                      style={{ background: panelBg, borderColor, color: textColor }}
                                      className="w-20 text-xs px-2 py-1 rounded border text-right font-mono"
                                    />
                                    <span style={{ color: subtextColor }} className="text-xs w-14">{cfg.unit}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children, bg, border, text }) {
  return (
    <div>
      <h3 style={{ color: text }} className="text-xs font-semibold uppercase tracking-widest mb-3 opacity-60">{title}</h3>
      <div style={{ background: bg, borderColor: border }} className="rounded-xl border p-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

function Toggle({ value, onChange, color }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{ background: value ? color : '#64748B' }}
      className="relative w-10 h-5 rounded-full transition-colors duration-200">
      <motion.div
        animate={{ x: value ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
      />
    </button>
  );
}
