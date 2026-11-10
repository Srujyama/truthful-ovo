import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/public-sans';
import './styles.css';
import App from './App.jsx';
import './workspace.css';
import './correspondence-theme.css';
import './document-reader.css';
import './case-graphic.css';
import './review-workspace.css';
import './team-theme.css';

createRoot(document.getElementById('root')).render(<App />);
