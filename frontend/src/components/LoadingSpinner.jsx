import React, { useState, useEffect } from 'react';
import './LoadingSpinner.css';

function SmartBookLoader({ onLoaded, message = "Snap a photo, start learning." }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  // Total time the loader is visible: 4.5s (main animation) + 0.8s (fade-out)
  const MINIMUM_DISPLAY_TIME_MS = 4500; // 4.5 seconds for the main show
  const FADE_OUT_DURATION_MS = 800; // 0.8 seconds for a slow, visible fade-out

  useEffect(() => {
    // 1. Start the fade-out process after the minimum display time
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, MINIMUM_DISPLAY_TIME_MS);

    // 2. Unmount the component completely after the fade-out animation finishes
    const unmountTimer = setTimeout(() => {
      // In a real application, you would call onLoaded() here to hide the loader.
      // e.g., if (onLoaded) onLoaded();
    }, MINIMUM_DISPLAY_TIME_MS + FADE_OUT_DURATION_MS);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  const overlayClasses = `spinner-overlay ${isFadingOut ? 'fade-out' : ''}`;

  return (
    // Apply the fade-out class when the state is true
    <div className={overlayClasses} data-theme="dark">
      {/* Background Elements */}
      <div className="background-particles">
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
      </div>

      <div className="neural-network">
        <div className="neural-path" style={{top: '30%', left: '20%', width: '200px'}}></div>
        <div className="neural-path" style={{top: '60%', left: '60%', width: '150px'}}></div>
        <div className="neural-node" style={{top: '30%', left: '20%'}}></div>
        <div className="neural-node" style={{top: '60%', left: '60%'}}></div>
      </div>

      <div className="smartbook-loader">
        {/* Quantum Book Animation */}
        <div className="book-container">
          <div className="book">
            <div className="book-cover"></div>
            <div className="book-pages">
              <div className="page-content">
                <div className="code-line">class Knowledge extends Intelligence {'{'}</div>
                <div className="code-line">  processIdeas() {'{'}</div>
                <div className="code-line">    return new Innovation();</div>
                <div className="code-line">  </div>
                <div className="code-line"></div>
              </div>
            </div>
            
            {/* Quantum Particles */}
            <div className="quantum-particles">
              <div className="quantum-particle"></div>
              <div className="quantum-particle"></div>
              <div className="quantum-particle"></div>
            </div>
          </div>
        </div>

        {/* Logo with Word-by-Word Animation - NoteVision */}
        <div className="loader-logo-container">
          <div className="logo-glow"></div>
          <span className="logo-word">Note</span>
          <span className="logo-word">Vision</span>
        </div>

        {/* AI Processing Indicator */}
        <div className="ai-processing">
          <div className="process-dot"></div>
          <div className="process-dot"></div>
          <div className="process-dot"></div>
          <span>AI Processing</span>
          <div className="process-dot"></div>
          <div className="process-dot"></div>
          <div className="process-dot"></div>
        </div>

        {/* Tagline with Typewriter Animation - New Tagline */}
        <div className="loader-tagline">
          <div className="tagline-text">{message}</div> 
        </div>

        {/* Quantum Progress Bar */}
        <div className="progress-container">
          <div className="progress-bar"></div>
        </div>

        {/* DNA Helix Animation */}
        <div className="dna-helix">
          <div className="helix-strand">
            <div className="helix-node" style={{top: '10%'}}></div>
            <div className="helix-node" style={{top: '30%'}}></div>
            <div className="helix-node" style={{top: '50%'}}></div>
            <div className="helix-node" style={{top: '70%'}}></div>
            <div className="helix-node" style={{top: '90%'}}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SmartBookLoader;