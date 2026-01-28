/**
 * main.jsx -- Application Entry Point
 *
 * Purpose:
 *   Bootstraps the React application by mounting the root component tree into the
 *   DOM. Sets up the top-level providers that every downstream component relies on:
 *   - BrowserRouter (client-side routing via react-router-dom)
 *   - AuthProvider   (authentication state from context/AuthContext)
 *
 * Key exports: none (side-effect module -- renders to the DOM).
 *
 * Connections:
 *   - Wraps <App /> which defines all route definitions.
 *   - AuthProvider must sit inside BrowserRouter because it calls useNavigate.
 *   - Global stylesheet index.css is imported here so it applies site-wide.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';


ReactDOM.createRoot(document.getElementById('root')).render(
  // future flags opt-in to upcoming React Router v7 behaviours early
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);
