// components/SmartBookLoader.jsx
import React from 'react';
import './LoadingSpinner.css'

function SmartBookLoader({ message = "Organizing your knowledge..." }) {
  return (
    <div className="spinner-overlay">
      <div className="smartbook-loader">
        {/* Animated Book */}
        <div className="book-container">
          <div className="book">
            <div className="book-cover"></div>
            <div className="book-pages">
              <div className="page-line"></div>
              <div className="page-line"></div>
              <div className="page-line"></div>
              <div className="page-line"></div>
              <div className="page-line"></div>
            </div>
            <div className="sparkle sparkle-1"></div>
            <div className="sparkle sparkle-2"></div>
            <div className="sparkle sparkle-3"></div>
          </div>
        </div>

        {/* Logo and Tagline */}
        <div className="loader-logo">SmartBook</div>
        <div className="loader-tagline">Where Ideas Meet Intelligence</div>

        {/* Progress Bar */}
        <div className="progress-container">
          <div className="progress-bar"></div>
        </div>

        {/* Loading Message */}
        <div className="spinner-message">{message}</div>

        {/* Animated Dots */}
        <div className="loading-dots">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>
    </div>
  );
}

export default SmartBookLoader;