import { createContext, useContext, useState, useMemo, useCallback } from 'react';

const SimulatorContext = createContext(null);

const emptyPumpSequence = () => [null, null, null, null, null, null];

/**
 * Holds simulator state at app level so it persists across page navigation.
 * Per-patient: switching patient clears that patient's run; coming back to a
 * patient with a previous run keeps it. Cleared on full reload.
 */
export function SimulatorProvider({ children }) {
  // Map patientId → simulator state for that patient
  const [statesByPatient, setStatesByPatient] = useState(/** @type {Record<string, any>} */ ({}));
  const [selectedGroup, setSelectedGroup] = useState(0);

  const getStateFor = useCallback((patientId) => {
    if (!patientId) return null;
    return statesByPatient[patientId] ?? null;
  }, [statesByPatient]);

  const setStateFor = useCallback((patientId, updater) => {
    if (!patientId) return;
    setStatesByPatient(prev => {
      const current = prev[patientId] ?? {
        pumpSequence: emptyPumpSequence(),
        horizonHours: 6,
        isRunning: false,
        hasResult: false,
        forecastRows: [],
        forecastError: null,
        lastRunPumpSequence: null,
      };
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return { ...prev, [patientId]: next };
    });
  }, []);

  const clearStateFor = useCallback((patientId) => {
    if (!patientId) return;
    setStatesByPatient(prev => {
      if (!(patientId in prev)) return prev;
      const next = { ...prev };
      delete next[patientId];
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    getStateFor,
    setStateFor,
    clearStateFor,
    selectedGroup,
    setSelectedGroup,
  }), [getStateFor, setStateFor, clearStateFor, selectedGroup]);

  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>;
}

export function useSimulatorContext() {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error('useSimulatorContext must be used within SimulatorProvider');
  return ctx;
}

export { emptyPumpSequence };
