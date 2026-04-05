import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController,
  RadarController,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { gradientSeverityLinePlugin } from './chartGradientSeverityLinePlugin';

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  RadarController,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
  gradientSeverityLinePlugin,
);
