import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { SimulatorProvider } from './context/SimulatorContext';

export default function App() {
  return (
    <ThemeProvider>
      <SimulatorProvider>
        <RouterProvider router={router} />
      </SimulatorProvider>
    </ThemeProvider>
  );
}


// Reasons to fix:
// 1. The dependency tree is ginormous.
// 