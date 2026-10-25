import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initTouchDragDrop } from './utils/touchDragDrop';

// Initialize touch drag and drop polyfill for mobile and tablet devices
initTouchDragDrop();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

