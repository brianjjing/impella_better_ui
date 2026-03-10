# ImpellaAI Weaning Monitor

A physician-facing dashboard for the Impella Heart Weaning device, powered by an
AI-driven smart weaning RL policy.

## Quick Start

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Requirements

- Node.js 18+
- npm 9+ (or pnpm / yarn)

## Screens

1. **Main Menu** – Patient overview and search
2. **Patient Timeline** – Multi-line charts for 12 physiological features across 6 time-steps
3. **Simulator** – Forecast hemodynamics for pump power levels P2–P9 over 6 hours
4. **Policy Evaluation** – RL policy action probabilities, patient state trajectories, and outcome radar

## Features

- Light / Dark mode toggle
- 5 colorblind-safe color schemes (Sapphire, Ocean, Ember, Slate, Violet)
- Collapsible sidebar with patient search
- Three heart visualization modes (Functional, Standard, Immersive)
- Configurable alert thresholds per feature
