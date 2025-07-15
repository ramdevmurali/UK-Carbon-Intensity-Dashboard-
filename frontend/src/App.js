// frontend/src/App.js

import React from 'react';
import './App.css';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

// --- NEW, FULLY COMPONENTIZED IMPORTS ---
import { useCarbonData } from './hooks/useCarbonData';
import GenerationMixChart from './components/GenerationMixChart';
import ForecastChart from './components/ForecastChart';
import RegionSelector from './components/RegionSelector';
import TimeOptimizer from './components/TimeOptimizer';

// Register ChartJS elements. This is a good place for it as it's a global configuration.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);


// A small, pure utility function. It's fine for this to live here
// as it has no dependencies on the component itself.
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


// A new, small component for the "Current Intensity" box.
// This completes the refactor, removing all UI logic from App.js.
const CurrentIntensity = ({ intensityData, error, regionError }) => {
    if (!intensityData || !intensityData.intensity) {
        const errorMessage = error || regionError;
        return (
            <div className="section-box intensity-box">
                {errorMessage ? <p className="error-text">{errorMessage}</p> : <p>Loading current intensity...</p>}
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


function App() {
  const { data, state, actions } = useCarbonData();

  return (
    <div className="App">
      <RegionSelector
        regions={data.regions}
        selectedRegion={data.selectedRegion}
        onRegionChange={actions.setSelectedRegion}
        isLoading={state.isLoadingRegionData}
        regionError={state.regionError}
        displayName={data.displayRegionName}
      />

      <div className="top-row-container">
        <CurrentIntensity
            intensityData={data.displayIntensityData}
            error={state.error}
            regionError={state.regionError}
        />
        
        <GenerationMixChart 
            generationMixData={data.displayGenerationMix}
            regionName={data.displayRegionName}
        />
      </div>

      <TimeOptimizer
        onPresetClick={actions.handlePresetClick}
        bestTime={data.bestTime}
        selectedAppliance={data.selectedAppliance}
        isLoading={state.isLoadingBestTime}
        isLoadingRegionData={state.isLoadingRegionData}
      />

      <div className="chart-container">
        <ForecastChart
          forecastData={data.displayForecastData}
          bestTime={data.bestTime}
          selectedAppliance={data.selectedAppliance}
          currentRegionName={data.displayRegionName}
        />
      </div>
    </div>
  );
}

export default App;