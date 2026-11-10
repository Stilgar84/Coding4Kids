import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initTouchDragDrop } from './utils/touchDragDrop';
import { initPwaUpdateManager } from './services/pwaUpdateManager';

// Initialize touch drag and drop polyfill for mobile and tablet devices
initTouchDragDrop();

// Initialize PWA Service Worker registration & periodic update checks
void initPwaUpdateManager();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

