import { createBrowserRouter } from 'react-router';
import Layout from './components/Layout';
import MainMenu from './pages/MainMenu';
import Simulator from './pages/Simulator';
import PolicyEvaluation from './pages/PolicyEvaluation';
import NeuripsDemo from './pages/NeuripsDemo';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true,       Component: MainMenu },
      { path: 'policy',    Component: PolicyEvaluation },
      { path: 'simulator', Component: Simulator },
      { path: 'neurips-demo', Component: NeuripsDemo },
    ],
  },
]);