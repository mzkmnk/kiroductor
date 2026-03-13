import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './styles/global.css';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
