// frontend/src/components/TimeOptimizer.js

import React from 'react';
import './TimeOptimizer.css'; // <-- ADD THIS LINE

const APPLIANCE_PRESETS = [
  { name: 'Washing Machine', duration: 120, power_kw: 0.5 },
  { name: 'Dishwasher', duration: 90, power_kw: 0.7 },
  { name: 'Tumble Dryer', duration: 60, power_kw: 2.5 },
  { name: 'EV Charge (4h)', duration: 240, power_kw: 7.0 },
];

const TimeOptimizer = ({ onPresetClick, bestTime, selectedAppliance, isLoading, isLoadingRegionData }) => {
  return (
    <div className="section-box">
      <h3>Find the Greenest Time for...</h3>
      <div className="optimizer-presets">
        {APPLIANCE_PRESETS.map((appliance) => (
          <button
            key={appliance.name}
            className={`preset-button ${selectedAppliance?.name === appliance.name ? 'active' : ''}`}
            onClick={() => onPresetClick(appliance)}
            disabled={isLoading || isLoadingRegionData}
          >
            {isLoading && selectedAppliance?.name === appliance.name ? 'Calculating...' : appliance.name}
          </button>
        ))}
      </div>

      {bestTime && (
        <div className="optimizer-result">
          {bestTime.error ? (
            <p className="error-text">Error: {bestTime.error}</p>
          ) : (
            <>
              <p>The best time for your <strong>{selectedAppliance.name}</strong> starts at:</p>
              <div className="result-time">
                {new Date(bestTime.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
              </div>
              <p className="result-savings">
                Estimated saving: <strong>{bestTime.saved_grams_co2.toLocaleString()}g of CO₂</strong>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeOptimizer;