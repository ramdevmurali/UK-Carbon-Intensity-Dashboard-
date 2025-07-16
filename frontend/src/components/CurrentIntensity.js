// frontend/src/components/CurrentIntensity.js

import React from 'react';
import './CurrentIntensity.css'; // Import its own styles

// A small, pure utility function for this component.
const getIndexColor = (index) => {
  switch (index) {
    case 'very low': return '#4caf50';
    case 'low': return '#8bc34a';
    case 'moderate': return '#ffc107';
    case 'high': return '#ff9800';
    case 'very high': return '#f44336';
    default: return '#9e9e9e';
  }
};

const CurrentIntensity = ({ intensityData, error, regionError }) => {
    // Note: The .loading-placeholder class will come from the global App.css
    if (!intensityData || !intensityData.intensity) {
        const errorMessage = error || regionError;
        return (
            <div className="section-box intensity-box loading-placeholder">
                {errorMessage ? <p className="error-text">{errorMessage}</p> : <p>Loading...</p>}
            </div>
        );
    }

    return (
        <div className="section-box intensity-box">
            <h2>Current Intensity</h2>
            <div className="hero-value">{intensityData.intensity.actual ?? intensityData.intensity.forecast ?? 'N/A'}</div>
            <div className="hero-unit">gCO₂/kWh</div>
            <div className="intensity-badge" style={{ backgroundColor: getIndexColor(intensityData.intensity.index) }}>
                {intensityData.intensity.index}
            </div>
        </div>
    );
};

export default CurrentIntensity;