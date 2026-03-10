import { createContext, useContext, useState, useEffect } from 'react';
import { featureConfigs } from '../data/mockData';

export const colorSchemes = [
  {
    id: 'sapphire', name: 'Sapphire', description: 'Deep blue clinical theme',
    primary: '#1D4ED8', primaryLight: '#DBEAFE', accent: '#06B6D4',
    good: '#0D9488', warning: '#D97706', critical: '#DC2626',
    chart: ['#3B82F6', '#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#F97316'],
    swatchColors: ['#1D4ED8', '#06B6D4', '#DBEAFE'],
  },
  {
    id: 'ocean', name: 'Ocean', description: 'Teal & indigo medical',
    primary: '#0E7490', primaryLight: '#CFFAFE', accent: '#4F46E5',
    good: '#059669', warning: '#D97706', critical: '#DB2777',
    chart: ['#0EA5E9', '#4F46E5', '#14B8A6', '#F59E0B', '#A78BFA', '#FB7185'],
    swatchColors: ['#0E7490', '#4F46E5', '#CFFAFE'],
  },
  {
    id: 'ember', name: 'Ember', description: 'Warm amber & teal',
    primary: '#B45309', primaryLight: '#FEF3C7', accent: '#0D9488',
    good: '#059669', warning: '#D97706', critical: '#9333EA',
    chart: ['#F59E0B', '#0D9488', '#F97316', '#6366F1', '#10B981', '#EC4899'],
    swatchColors: ['#B45309', '#0D9488', '#FEF3C7'],
  },
  {
    id: 'slate', name: 'Slate', description: 'Cool neutral & indigo',
    primary: '#475569', primaryLight: '#F1F5F9', accent: '#6366F1',
    good: '#0891B2', warning: '#D97706', critical: '#DC2626',
    chart: ['#6366F1', '#0891B2', '#8B5CF6', '#F59E0B', '#14B8A6', '#FB923C'],
    swatchColors: ['#475569', '#6366F1', '#F1F5F9'],
  },
  {
    id: 'violet', name: 'Violet', description: 'Purple & teal fusion',
    primary: '#7C3AED', primaryLight: '#EDE9FE', accent: '#06B6D4',
    good: '#0D9488', warning: '#F59E0B', critical: '#F43F5E',
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
  const [isDark, setIsDark] = useState(true);
  const [colorScheme, setColorScheme] = useState('sapphire');
  const [heartVariant, setHeartVariant] = useState(2);
  const [thresholds, setThresholds] = useState(defaultThresholds);

  const scheme = colorSchemes.find(s => s.id === colorScheme);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

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

export function getHealthColor(score, scheme) {
  if (score >= 70) return scheme.good;
  if (score >= 45) return scheme.warning;
  return scheme.critical;
}
