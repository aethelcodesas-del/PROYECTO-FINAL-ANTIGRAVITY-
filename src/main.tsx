import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { initColorMode } from './utils/themeColorMode';
import './index.css';

// Inicializar modo de color (Color Establecido vs Blanco) antes del primer render
initColorMode();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary moduleName="Aplicación Principal">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

