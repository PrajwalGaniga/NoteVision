import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // <-- IMPORT
import App from './App.jsx';
// We can remove the direct import to App.css, App.jsx handles it
// import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* --- WRAP APP IN ROUTER --- */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);