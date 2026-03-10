import { createBrowserRouter } from 'react-router';
import Layout from './components/Layout';
import MainMenu from './pages/MainMenu';
import PatientTimeline from './pages/PatientTimeline';
import Simulator from './pages/Simulator';
import PolicyEvaluation from './pages/PolicyEvaluation';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true,       Component: MainMenu },
      { path: 'timeline',  Component: PatientTimeline },
      { path: 'simulator', Component: Simulator },
      { path: 'policy',    Component: PolicyEvaluation },
    ],
  },
]);