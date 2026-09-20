import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './style.css';
import { applyTheme } from './theme.js';

applyTheme(); // before first paint, avoids a flash of the wrong theme

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
