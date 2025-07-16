// frontend/src/App.js

import React from 'react';
import './App.css'; // This will now be our cleaned-up global stylesheet
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

// --- NEW, FULLY COMPONENTIZED IMPORTS ---
import { useCarbonData } from './hooks/useCarbonData';
import CurrentIntensity from './components/CurrentIntensity'; // <-- IMPORT a
import GenerationMixChart from './components/GenerationMixChart';
import ForecastChart from './components/ForecastChart';
import RegionSelector from './components/RegionSelector';
import TimeOptimizer from './components/TimeOptimizer';

// Register ChartJS elements. This is a good place for it as it's a global configuration.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

// The CurrentIntensity component definition has been removed from here

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
        {/* Use the new, imported CurrentIntensity component */}
        <CurrentIntensity
            intensityData={data.displayIntensityData}
            error={state.error}
            regionError={state.regionError}
        />
        
        {/* The GenerationMixChart is wrapped in a div to give it the card styling */}
        <div className="section-box generation-mix-box">
          <GenerationMixChart 
              generationMixData={data.displayGenerationMix}
              regionName={data.displayRegionName}
          />
        </div>
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