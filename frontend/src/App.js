// frontend/src/App.js

import React from 'react';
import './App.css';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

import { useCarbonData } from './hooks/useCarbonData';
import CurrentIntensity from './components/CurrentIntensity';
import GenerationMixChart from './components/GenerationMixChart';
import ForecastChart from './components/ForecastChart';
import RegionSelector from './components/RegionSelector';
import SmartRecommendations from './components/SmartRecommendations';

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

      {/* 1. WRAP the component in the global 'section-box' class */}
      <div className="section-box">
        <SmartRecommendations
          recommendations={data.applianceRecommendations}
          isLoading={state.isLoadingRecommendations}
          onWindowSelect={actions.setSelectedWindow}
          selectedWindow={data.selectedWindow}
        />
      </div>

      <div className="chart-container">
        <ForecastChart
          forecastData={data.displayForecastData}
          currentRegionName={data.displayRegionName}
          selectedWindow={data.selectedWindow}
        />
      </div>
    </div>
  );
}

export default App;