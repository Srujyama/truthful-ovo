import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/public-sans';
import './styles.css';
import App from './App.jsx';
import './product-ui.css';

createRoot(document.getElementById('root')).render(<App />);
