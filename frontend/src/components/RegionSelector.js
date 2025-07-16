// frontend/src/components/RegionSelector.js

import React from 'react';
import './RegionSelector.css';

const RegionSelector = ({ regions, selectedRegion, onRegionChange, isLoading, regionError, displayName }) => {
  return (
    <div className="section-box location-selector">
      <h2>Carbon Intensity ({displayName})</h2>
      <div className="region-selector-controls">
        <label htmlFor="region-select">Select Region:</label>
        <select
          id="region-select"
          value={selectedRegion}
          onChange={(e) => onRegionChange(e.target.value)}
          disabled={isLoading}
          className="region-dropdown"
        >
          {regions.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
        {isLoading && <p>Loading region data...</p>}
        {regionError && <p className="error-text">{regionError}</p>}
      </div>
    </div>
  );
};

export default RegionSelector;