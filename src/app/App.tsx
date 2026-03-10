import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}


// Reasons to fix:
// 1. The dependency tree is ginormous.
// 