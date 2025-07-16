// frontend/src/App.js

import React from 'react';
import './App.css'; // This will now be our cleaned-up global stylesheet
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

// --- UPDATED IMPORTS ---
import { useCarbonData } from './hooks/useCarbonData';
import CurrentIntensity from './components/CurrentIntensity';
import GenerationMixChart from './components/GenerationMixChart';
import ForecastChart from './components/ForecastChart';
import RegionSelector from './components/RegionSelector';
import SmartRecommendations from './components/SmartRecommendations'; // 1. IMPORT the new component

// Register ChartJS elements. This is a good place for it as it's a global configuration.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

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
        
        <div className="section-box generation-mix-box">
          <GenerationMixChart 
              generationMixData={data.displayGenerationMix}
              regionName={data.displayRegionName}
          />
        </div>
      </div>

      {/* 2. REPLACE TimeOptimizer with SmartRecommendations */}
      <SmartRecommendations
        recommendations={data.applianceRecommendations}
        isLoading={state.isLoadingRecommendations}
      />

      <div className="chart-container">
        {/* 3. UPDATE ForecastChart props to remove old optimizer data */}
        <ForecastChart
          forecastData={data.displayForecastData}
          currentRegionName={data.displayRegionName}
        />
      </div>
    </div>
  );
}

export default App;