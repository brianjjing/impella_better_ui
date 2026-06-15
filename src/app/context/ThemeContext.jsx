import { createContext, useContext, useState, useEffect } from 'react';
import { featureConfigs } from '../data/mockData';

/**
 * Surfaces for main app chrome. Dark mode uses deep blue-blacks; light mode uses
 * soft blue-gray pastels (not stark white) so brightness feels balanced with dark mode depth.
 */
export function getSurfaces(isDark) {
  if (isDark) {
    return {
      bg: '#080E1A',
      card: '#0C1526',
      sidebar: '#0C1526',
      border: '#1A2740',
      text: '#E2E8F0',
      subtext: '#9CA3AF',
      inputBg: '#0A1628',
      muted: '#1E293B',
      gridColor: '#1A2740',
      panelBg: '#0F172A',
      panelBorder: '#1E293B',
      sectionBg: '#1E293B',
      logoTile: '#0f172a',
    };
  }
  return {
    /* Three-step blue hierarchy: soft off-white page is lightest, sidebar/top bar
       sit a step down, and the primary content boxes/graphs are a deeper blue so
       the actual information reads as the focal surface. */
    bg: '#F4F7FC',
    card: '#D2DEF0',
    sidebar: '#E3EAF5',
    border: '#BFCCE0',
    text: '#0F172A',
    subtext: '#3E4A5C',
    inputBg: '#F4F7FC',
    muted: '#C7D3E7',
    gridColor: '#BBC9E0',
    panelBg: '#D2DEF0',
    panelBorder: '#BFCCE0',
    sectionBg: '#E3EAF5',
    logoTile: '#ECF1F8',
  };
}

export const colorSchemes = [
  {
    id: 'sapphire', name: 'Sapphire', description: 'Deep blue clinical theme',
    primary: '#1D4ED8', primaryLight: '#DBEAFE', accent: '#06B6D4',
    good: '#0D9488', warning: '#D97706', critical: '#DC2626',
    forecast: '#FACC15',
    chart: ['#3B82F6', '#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#F97316'],
    swatchColors: ['#1D4ED8', '#06B6D4', '#DBEAFE'],
  },
  {
    id: 'ocean', name: 'Ocean', description: 'Teal & indigo medical',
    primary: '#0E7490', primaryLight: '#CFFAFE', accent: '#4F46E5',
    good: '#059669', warning: '#D97706', critical: '#DB2777',
    forecast: '#FACC15',
    chart: ['#0EA5E9', '#4F46E5', '#14B8A6', '#F59E0B', '#A78BFA', '#FB7185'],
    swatchColors: ['#0E7490', '#4F46E5', '#CFFAFE'],
  },
  {
    id: 'ember', name: 'Ember', description: 'Warm amber & teal',
    primary: '#B45309', primaryLight: '#FEF3C7', accent: '#0D9488',
    good: '#059669', warning: '#D97706', critical: '#9333EA',
    forecast: '#FACC15',
    chart: ['#F59E0B', '#0D9488', '#F97316', '#6366F1', '#10B981', '#EC4899'],
    swatchColors: ['#B45309', '#0D9488', '#FEF3C7'],
  },
  {
    id: 'slate', name: 'Slate', description: 'Cool neutral & indigo',
    primary: '#475569', primaryLight: '#F1F5F9', accent: '#6366F1',
    good: '#0891B2', warning: '#D97706', critical: '#DC2626',
    forecast: '#FACC15',
    chart: ['#6366F1', '#0891B2', '#8B5CF6', '#F59E0B', '#14B8A6', '#FB923C'],
    swatchColors: ['#475569', '#6366F1', '#F1F5F9'],
  },
  {
    id: 'violet', name: 'Violet', description: 'Purple & teal fusion',
    primary: '#7C3AED', primaryLight: '#EDE9FE', accent: '#06B6D4',
    good: '#0D9488', warning: '#F59E0B', critical: '#F43F5E',
    forecast: '#FACC15',
    chart: ['#8B5CF6', '#06B6D4', '#A78BFA', '#F59E0B', '#10B981', '#FB7185'],
    swatchColors: ['#7C3AED', '#06B6D4', '#EDE9FE'],
  },
];

const ThemeContext = createContext(null);

const defaultThresholds = Object.fromEntries(
  Object.entries(featureConfigs).map(([k, v]) => [k, {
    normalMin: v.normalMin, normalMax: v.normalMax,
    warningMin: v.warningMin, warningMax: v.warningMax,
  }])
);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('isDark');
    return stored === null ? true : stored === 'true';
  });
  const [colorScheme, setColorScheme] = useState('sapphire');
  const [heartVariant, setHeartVariant] = useState(2);
  const [thresholds, setThresholds] = useState(defaultThresholds);

  const scheme = colorSchemes.find(s => s.id === colorScheme);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    window.localStorage.setItem('isDark', String(isDark));
  }, [isDark]);

  // Keep CSS custom properties in sync with the JS theme so shadcn/ui components
  // and Tailwind utility classes always match the custom inline-style components.
  // This is the single write point — theme.css holds the initial static values,
  // but this effect is authoritative at runtime.
  useEffect(() => {
    if (!scheme) return;
    const r = document.documentElement;
    const s = getSurfaces(isDark);

    // Surface tokens
    r.style.setProperty('--background',         s.bg);
    r.style.setProperty('--foreground',         s.text);
    r.style.setProperty('--card',               s.card);
    r.style.setProperty('--card-foreground',    s.text);
    r.style.setProperty('--popover',            s.card);
    r.style.setProperty('--popover-foreground', s.text);
    r.style.setProperty('--muted',              s.muted);
    r.style.setProperty('--muted-foreground',   s.subtext);
    r.style.setProperty('--border',             s.border);
    r.style.setProperty('--input-background',   s.inputBg);
    r.style.setProperty('--sidebar',            s.sidebar);
    r.style.setProperty('--sidebar-foreground', s.text);
    r.style.setProperty('--sidebar-border',     s.border);

    // Scheme tokens
    r.style.setProperty('--primary',              scheme.primary);
    r.style.setProperty('--primary-foreground',   '#ffffff');
    r.style.setProperty('--accent',               scheme.accent);
    r.style.setProperty('--accent-foreground',    '#ffffff');
    r.style.setProperty('--destructive',          scheme.critical);
    r.style.setProperty('--ring',                 scheme.primary);
    r.style.setProperty('--sidebar-primary',      scheme.primary);
    r.style.setProperty('--sidebar-primary-foreground', '#ffffff');
  }, [isDark, scheme]);

  const setThreshold = (feature, config) => {
    setThresholds(prev => ({ ...prev, [feature]: config }));
  };

  return (
    <ThemeContext.Provider value={{
      isDark, setIsDark,
      colorScheme, setColorScheme,
      heartVariant, setHeartVariant,
      thresholds, setThreshold,
      scheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function getStatusColor(status, scheme) {
  switch (status) {
    case 'critical':  return scheme.critical;
    case 'warning':   return scheme.warning;
    case 'stable':    return '#6366F1';
    case 'improving': return scheme.good;
    case 'weaned':    return scheme.accent;
    default:          return '#6B7280';
  }
}

export function getFeatureStatus(value, threshold) {
  if (value >= threshold.normalMin && value <= threshold.normalMax) return 'normal';
  if (value >= threshold.warningMin && value <= threshold.warningMax) return 'warning';
  return 'critical';
}

