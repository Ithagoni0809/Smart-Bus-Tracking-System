// src/main.jsx
// The very first file React loads.
// It mounts the <App /> component into the <div id="root"> in index.html
// and imports the global CSS (Tailwind + custom styles).

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
