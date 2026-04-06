export const featureConfigs = {
  MAP:          { label: 'Mean Arterial Pressure',       unit: 'mmHg',     normalMin: 70,    normalMax: 100,   warningMin: 60,    warningMax: 110,   color: '#3B82F6', description: 'Average arterial pressure throughout the cardiac cycle' },
  pumpSpeed:    { label: 'Mean Pump Speed',            unit: 'RPM',      normalMin: 22000, normalMax: 46000, warningMin: 20000, warningMax: 50000, color: '#8B5CF6', description: 'Rotational speed of the Impella pump motor', deviceMetric: true },
  motorCurrent: { label: 'Motor Current',             unit: 'A',        normalMin: 3.5,   normalMax: 7.0,   warningMin: 3.0,   warningMax: 8.0,   color: '#EC4899', description: 'Electrical current powering the pump motor', deviceMetric: true },
  pumpFlow:     { label: 'Pump Flow',                 unit: 'L/min',    normalMin: 2.5,   normalMax: 5.0,   warningMin: 2.0,   warningMax: 6.0,   color: '#06B6D4', description: 'Volume of blood displaced by the pump per minute', deviceMetric: true },
  LVP:          { label: 'LV Pressure',               unit: 'mmHg',     normalMin: 60,    normalMax: 120,   warningMin: 50,    warningMax: 140,   color: '#F59E0B', description: 'Pressure inside the left ventricle' },
  LVEDP:        { label: 'LV End-Diastolic Pressure', unit: 'mmHg',     normalMin: 4,     normalMax: 12,    warningMin: 2,     warningMax: 18,    color: '#EF4444', description: 'LV pressure at end of diastole — lower is better for weaning' },
  HR:           { label: 'Heart Rate',                unit: 'bpm',      normalMin: 60,    normalMax: 100,   warningMin: 50,    warningMax: 110,   color: '#10B981', description: 'Number of heartbeats per minute' },
  SBP:          { label: 'Systolic BP',               unit: 'mmHg',     normalMin: 90,    normalMax: 130,   warningMin: 80,    warningMax: 145,   color: '#6366F1', description: 'Peak arterial pressure during systole' },
  DBP:          { label: 'Diastolic BP',              unit: 'mmHg',     normalMin: 60,    normalMax: 85,    warningMin: 50,    warningMax: 95,    color: '#14B8A6', description: 'Minimum arterial pressure during diastole' },
  pulsatility:  { label: 'Pulsatility Index',         unit: 'PI',       normalMin: 1.0,   normalMax: 2.5,   warningMin: 0.5,   warningMax: 3.0,   color: '#F97316', description: 'Indicator of native cardiac output — higher means heart is recovering' },
  tauLV:        { label: 'Relaxation Constant τ_LV',  unit: 'ms',       normalMin: 30,    normalMax: 55,    warningMin: 25,    warningMax: 65,    color: '#A78BFA', description: 'Time constant of isovolumetric LV pressure decay' },
  eseLV:        { label: 'LV Elastance E_se,LV',      unit: 'mmHg/mL',  normalMin: 0.8,   normalMax: 2.2,   warningMin: 0.5,   warningMax: 2.8,   color: '#FB7185', description: 'End-systolic elastance — index of myocardial contractility' },
};

export const featureKeys = Object.keys(featureConfigs);

const ts = (h) => {
  const d = new Date('2026-02-19T00:00:00');
  d.setHours(d.getHours() - 5 + h);
  return d.toISOString();
};
const lbl = (h) => ['T-5h', 'T-4h', 'T-3h', 'T-2h', 'T-1h', 'T0h'][h];

export const patients = [
  {
    id: 'P001', name: 'James Harrison', age: 67, gender: 'M',
    condition: 'Cardiogenic Shock — Post MI',
    diagnosis: 'Anterior STEMI with acute cardiogenic shock',
    deviceLevel: 8, status: 'improving', admissionDate: '2026-02-15',
    physician: 'Dr. Chen', mrn: 'MRN-004821',
    timeline: [
      { t: 0, timestamp: ts(0), label: lbl(0), MAP: 64, pumpSpeed: 43500, motorCurrent: 6.8, pumpFlow: 3.1, LVP: 88,  LVEDP: 26, HR: 102, SBP: 88,  DBP: 58, pulsatility: 0.62, tauLV: 58, eseLV: 0.72 },
      { t: 1, timestamp: ts(1), label: lbl(1), MAP: 68, pumpSpeed: 43000, motorCurrent: 6.5, pumpFlow: 3.3, LVP: 84,  LVEDP: 23, HR: 97,  SBP: 93,  DBP: 61, pulsatility: 0.74, tauLV: 55, eseLV: 0.88 },
      { t: 2, timestamp: ts(2), label: lbl(2), MAP: 72, pumpSpeed: 42500, motorCurrent: 6.2, pumpFlow: 3.5, LVP: 80,  LVEDP: 20, HR: 92,  SBP: 98,  DBP: 64, pulsatility: 0.88, tauLV: 52, eseLV: 1.02 },
      { t: 3, timestamp: ts(3), label: lbl(3), MAP: 75, pumpSpeed: 41800, motorCurrent: 5.9, pumpFlow: 3.6, LVP: 76,  LVEDP: 18, HR: 88,  SBP: 103, DBP: 67, pulsatility: 1.02, tauLV: 49, eseLV: 1.18 },
      { t: 4, timestamp: ts(4), label: lbl(4), MAP: 78, pumpSpeed: 41000, motorCurrent: 5.6, pumpFlow: 3.7, LVP: 72,  LVEDP: 16, HR: 84,  SBP: 108, DBP: 70, pulsatility: 1.18, tauLV: 46, eseLV: 1.34 },
      { t: 5, timestamp: ts(5), label: lbl(5), MAP: 82, pumpSpeed: 40200, motorCurrent: 5.3, pumpFlow: 3.8, LVP: 68,  LVEDP: 14, HR: 79,  SBP: 114, DBP: 73, pulsatility: 1.38, tauLV: 43, eseLV: 1.52 },
    ],
  },
  {
    id: 'P002', name: 'Elena Vasquez', age: 54, gender: 'F',
    condition: 'Acute Decompensated Heart Failure',
    diagnosis: 'ADHF with reduced EF (20%), NYHA Class IV',
    deviceLevel: 6, status: 'stable', admissionDate: '2026-02-17',
    physician: 'Dr. Patel', mrn: 'MRN-007534',
    timeline: [
      { t: 0, timestamp: ts(0), label: lbl(0), MAP: 70, pumpSpeed: 38000, motorCurrent: 5.4, pumpFlow: 3.2, LVP: 74, LVEDP: 18, HR: 95, SBP: 96,  DBP: 62, pulsatility: 0.88, tauLV: 52, eseLV: 0.94 },
      { t: 1, timestamp: ts(1), label: lbl(1), MAP: 72, pumpSpeed: 37800, motorCurrent: 5.3, pumpFlow: 3.3, LVP: 76, LVEDP: 19, HR: 92, SBP: 98,  DBP: 64, pulsatility: 0.91, tauLV: 51, eseLV: 0.96 },
      { t: 2, timestamp: ts(2), label: lbl(2), MAP: 71, pumpSpeed: 38200, motorCurrent: 5.5, pumpFlow: 3.2, LVP: 78, LVEDP: 20, HR: 94, SBP: 97,  DBP: 63, pulsatility: 0.86, tauLV: 53, eseLV: 0.92 },
      { t: 3, timestamp: ts(3), label: lbl(3), MAP: 73, pumpSpeed: 37900, motorCurrent: 5.4, pumpFlow: 3.3, LVP: 75, LVEDP: 18, HR: 91, SBP: 99,  DBP: 65, pulsatility: 0.93, tauLV: 50, eseLV: 0.98 },
      { t: 4, timestamp: ts(4), label: lbl(4), MAP: 72, pumpSpeed: 38100, motorCurrent: 5.4, pumpFlow: 3.2, LVP: 77, LVEDP: 19, HR: 93, SBP: 97,  DBP: 64, pulsatility: 0.89, tauLV: 52, eseLV: 0.95 },
      { t: 5, timestamp: ts(5), label: lbl(5), MAP: 74, pumpSpeed: 37700, motorCurrent: 5.3, pumpFlow: 3.4, LVP: 74, LVEDP: 17, HR: 90, SBP: 100, DBP: 66, pulsatility: 0.96, tauLV: 49, eseLV: 1.01 },
    ],
  },
  {
    id: 'P003', name: 'Robert Chen', age: 72, gender: 'M',
    condition: 'Refractory Cardiogenic Shock',
    diagnosis: 'Multi-vessel CAD with biventricular failure, anuric AKI',
    deviceLevel: 9, status: 'critical', admissionDate: '2026-02-18',
    physician: 'Dr. Okonkwo', mrn: 'MRN-002198',
    timeline: [
      { t: 0, timestamp: ts(0), label: lbl(0), MAP: 58, pumpSpeed: 47000, motorCurrent: 7.6, pumpFlow: 2.6, LVP: 98,  LVEDP: 32, HR: 118, SBP: 78, DBP: 50, pulsatility: 0.38, tauLV: 72, eseLV: 0.48 },
      { t: 1, timestamp: ts(1), label: lbl(1), MAP: 55, pumpSpeed: 47500, motorCurrent: 7.8, pumpFlow: 2.5, LVP: 102, LVEDP: 34, HR: 122, SBP: 74, DBP: 48, pulsatility: 0.32, tauLV: 74, eseLV: 0.44 },
      { t: 2, timestamp: ts(2), label: lbl(2), MAP: 60, pumpSpeed: 47000, motorCurrent: 7.6, pumpFlow: 2.7, LVP: 96,  LVEDP: 30, HR: 115, SBP: 82, DBP: 52, pulsatility: 0.41, tauLV: 70, eseLV: 0.52 },
      { t: 3, timestamp: ts(3), label: lbl(3), MAP: 57, pumpSpeed: 47200, motorCurrent: 7.7, pumpFlow: 2.6, LVP: 100, LVEDP: 33, HR: 120, SBP: 78, DBP: 50, pulsatility: 0.35, tauLV: 73, eseLV: 0.47 },
      { t: 4, timestamp: ts(4), label: lbl(4), MAP: 62, pumpSpeed: 46800, motorCurrent: 7.5, pumpFlow: 2.8, LVP: 94,  LVEDP: 29, HR: 112, SBP: 86, DBP: 54, pulsatility: 0.44, tauLV: 68, eseLV: 0.55 },
      { t: 5, timestamp: ts(5), label: lbl(5), MAP: 60, pumpSpeed: 47000, motorCurrent: 7.6, pumpFlow: 2.7, LVP: 98,  LVEDP: 31, HR: 116, SBP: 80, DBP: 51, pulsatility: 0.40, tauLV: 71, eseLV: 0.50 },
    ],
  },
  {
    id: 'P004', name: 'Sarah Mitchell', age: 61, gender: 'F',
    condition: 'Myocarditis Recovery (Reference)',
    diagnosis: 'Giant cell myocarditis, post-acute phase',
    deviceLevel: 3, status: 'weaned', admissionDate: '2026-02-10',
    physician: 'Dr. Chen', mrn: 'MRN-009012',
    timeline: [
      { t: 0, timestamp: ts(0), label: lbl(0), MAP: 84, pumpSpeed: 26000, motorCurrent: 3.8, pumpFlow: 2.2, LVP: 68, LVEDP: 9, HR: 72, SBP: 118, DBP: 74, pulsatility: 1.82, tauLV: 34, eseLV: 1.92 },
      { t: 1, timestamp: ts(1), label: lbl(1), MAP: 86, pumpSpeed: 25500, motorCurrent: 3.6, pumpFlow: 2.1, LVP: 66, LVEDP: 8, HR: 70, SBP: 120, DBP: 76, pulsatility: 1.92, tauLV: 33, eseLV: 1.98 },
      { t: 2, timestamp: ts(2), label: lbl(2), MAP: 85, pumpSpeed: 25000, motorCurrent: 3.5, pumpFlow: 2.0, LVP: 65, LVEDP: 8, HR: 69, SBP: 119, DBP: 75, pulsatility: 1.98, tauLV: 32, eseLV: 2.04 },
      { t: 3, timestamp: ts(3), label: lbl(3), MAP: 87, pumpSpeed: 24500, motorCurrent: 3.4, pumpFlow: 1.9, LVP: 64, LVEDP: 7, HR: 68, SBP: 121, DBP: 77, pulsatility: 2.06, tauLV: 32, eseLV: 2.10 },
      { t: 4, timestamp: ts(4), label: lbl(4), MAP: 86, pumpSpeed: 24000, motorCurrent: 3.3, pumpFlow: 1.8, LVP: 63, LVEDP: 7, HR: 67, SBP: 120, DBP: 76, pulsatility: 2.14, tauLV: 31, eseLV: 2.16 },
      { t: 5, timestamp: ts(5), label: lbl(5), MAP: 88, pumpSpeed: 23500, motorCurrent: 3.2, pumpFlow: 1.7, LVP: 62, LVEDP: 7, HR: 66, SBP: 122, DBP: 77, pulsatility: 2.24, tauLV: 31, eseLV: 2.22 },
    ],
  },
];

export const policyDistributions = {
  P001: [0.02, 0.06, 0.18, 0.28, 0.26, 0.14, 0.05, 0.01],
  P002: [0.01, 0.04, 0.14, 0.24, 0.30, 0.18, 0.07, 0.02],
  P003: [0.00, 0.01, 0.03, 0.06, 0.14, 0.26, 0.32, 0.18],
  P004: [0.25, 0.35, 0.22, 0.10, 0.05, 0.02, 0.01, 0.00],
};

function generateRollout(patientId, pumpLevel, quality, id, patientsList = patients) {
  const p = patientsList.find(x => x.id === patientId);
  if (!p?.timeline?.[5]) return null;
  const base = p.timeline[5];
  const steps = [];
  let cur = { ...base };
  const totalSteps = 6;

  for (let i = 0; i < totalSteps; i++) {
    const progress = i / totalSteps;
    const action = quality === 'optimal' ? Math.max(2, pumpLevel - Math.floor(i / 2)) :
                   quality === 'suboptimal' ? pumpLevel : Math.min(9, pumpLevel + Math.floor(i / 3));
    const mult = quality === 'optimal' ? 1.0 - progress * 0.15 :
                 quality === 'suboptimal' ? 1.0 : 1.0 + progress * 0.1;
    const noise = () => (Math.random() - 0.5) * 0.04;

    const next = {
      MAP:          cur.MAP          * (quality === 'optimal' ? 1.012 : quality === 'suboptimal' ? 1.002 : 0.992) + noise() * 3,
      pumpSpeed:    cur.pumpSpeed    * (quality === 'optimal' ? 0.992 : quality === 'suboptimal' ? 0.999 : 1.006) + noise() * 200,
      motorCurrent: cur.motorCurrent * mult + noise() * 0.1,
      pumpFlow:     cur.pumpFlow     * (quality === 'optimal' ? 0.994 : 1.001) + noise() * 0.05,
      LVP:          cur.LVP          * (quality === 'optimal' ? 0.985 : quality === 'suboptimal' ? 0.999 : 1.015) + noise() * 2,
      LVEDP:        cur.LVEDP        * (quality === 'optimal' ? 0.93  : quality === 'suboptimal' ? 0.998 : 1.04)  + noise() * 0.5,
      HR:           cur.HR           * (quality === 'optimal' ? 0.988 : quality === 'suboptimal' ? 0.999 : 1.012) + noise() * 1,
      SBP:          cur.SBP          * (quality === 'optimal' ? 1.012 : quality === 'suboptimal' ? 1.002 : 0.988) + noise() * 2,
      DBP:          cur.DBP          * (quality === 'optimal' ? 1.008 : quality === 'suboptimal' ? 1.001 : 0.992) + noise() * 1,
      pulsatility:  cur.pulsatility  * (quality === 'optimal' ? 1.08  : quality === 'suboptimal' ? 1.01  : 0.95)  + noise() * 0.02,
      tauLV:        cur.tauLV        * (quality === 'optimal' ? 0.96  : quality === 'suboptimal' ? 0.999 : 1.04)  + noise() * 0.5,
      eseLV:        cur.eseLV        * (quality === 'optimal' ? 1.06  : quality === 'suboptimal' ? 1.001 : 0.94)  + noise() * 0.03,
    };

    const reward = (quality === 'optimal' ? 0.8 : quality === 'suboptimal' ? 0.4 : -0.2) + (Math.random() - 0.5) * 0.1;
    steps.push({ state: { ...cur, label: `T+${i + 1}h` }, action, actionLabel: `P${action}`, reward });
    cur = next;
  }

  const finalScore = quality === 'optimal' ? 72 + Math.random() * 20 :
                     quality === 'suboptimal' ? 45 + Math.random() * 20 : 18 + Math.random() * 20;
  return {
    id,
    label: quality === 'optimal' ? 'Optimal Trajectory' : quality === 'suboptimal' ? 'Suboptimal Trajectory' : 'Adverse Trajectory',
    quality,
    totalReward: steps.reduce((s, r) => s + r.reward, 0),
    steps,
    finalScore,
    sampledProb: quality === 'optimal' ? 0.28 : quality === 'suboptimal' ? 0.45 : 0.27,
  };
}

export function generateRollouts(patientId, patientsList = patients) {
  const patient = patientsList.find(p => p.id === patientId);
  if (!patient) return [];
  const level = patient.deviceLevel ?? 5;
  const rollouts = [
    generateRollout(patientId, level, 'optimal',    'R1', patientsList),
    generateRollout(patientId, level, 'optimal',    'R2', patientsList),
    generateRollout(patientId, level, 'suboptimal', 'R3', patientsList),
    generateRollout(patientId, level, 'suboptimal', 'R4', patientsList),
    generateRollout(patientId, level, 'suboptimal', 'R5', patientsList),
    generateRollout(patientId, level, 'adverse',    'R6', patientsList),
    generateRollout(patientId, level, 'adverse',    'R7', patientsList),
  ].filter(Boolean);
  return rollouts;
}

/**
 * @param {object} patient
 * @param {number[]} levelsSix — P-level (2–9) for each hour T+1 … T+6
 */
export function generateForecast(patient, levelsSix) {
  if (!Array.isArray(levelsSix) || levelsSix.length !== 6) return [];
  if (!levelsSix.every(lvl => typeof lvl === 'number' && lvl >= 2 && lvl <= 9 && Number.isFinite(lvl))) {
    return [];
  }
  const last = patient.timeline[5];
  const deviceLevel = patient.deviceLevel;
  const forecast = [];

  for (let i = 0; i < 6; i++) {
    const lvl = levelsSix[i];
    const h = i + 1;
    const progress = h / 6;
    const delta = lvl - deviceLevel;
    forecast.push({
      t: 6 + i,
      timestamp: new Date(new Date(last.timestamp).getTime() + h * 3600000).toISOString(),
      label: `T+${h}h`,
      MAP:          Math.round((last.MAP          * (delta > 0 ? 1.0 - progress * 0.04 : 1.0 + progress * 0.03)) * 10) / 10,
      pumpSpeed:    Math.round( last.pumpSpeed    * (1 + delta * 0.008 * progress)),
      motorCurrent: Math.round((last.motorCurrent * (1 + delta * 0.012 * progress)) * 10) / 10,
      pumpFlow:     Math.round((last.pumpFlow     * (1 + delta * 0.01  * progress)) * 10) / 10,
      LVP:          Math.round((last.LVP          * (delta > 0 ? 1.0 + progress * 0.05 : 1.0 - progress * 0.04)) * 10) / 10,
      LVEDP:        Math.round((last.LVEDP        * (delta > 0 ? 1.0 + progress * 0.04 : 1.0 - progress * 0.05)) * 10) / 10,
      HR:           Math.round( last.HR           * (delta > 0 ? 1.0 + progress * 0.03 : 1.0 - progress * 0.02)),
      SBP:          Math.round((last.SBP          * (delta > 0 ? 0.97 - progress * 0.01 : 1.02 + progress * 0.01)) * 10) / 10,
      DBP:          Math.round((last.DBP          * (delta > 0 ? 0.98 : 1.01)) * 10) / 10,
      pulsatility:  Math.round((last.pulsatility  * (delta > 0 ? 1.0 - progress * 0.06 : 1.0 + progress * 0.07)) * 100) / 100,
      tauLV:        Math.round((last.tauLV        * (delta > 0 ? 1.02 + progress * 0.02 : 0.98 - progress * 0.02)) * 10) / 10,
      eseLV:        Math.round((last.eseLV        * (delta > 0 ? 0.96 - progress * 0.02 : 1.04 + progress * 0.02)) * 100) / 100,
    });
  }
  return forecast;
}
