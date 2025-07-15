// frontend/src/App.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

// --- NEW COMPONENT IMPORT ---
import GenerationMixChart from './GenerationMixChart';

// --- REGISTER ArcElement for Doughnut Chart ---
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

const API_BASE_URL = 'http://localhost:8001';

const APPLIANCE_PRESETS = [
  { name: 'Washing Machine', duration: 120, power_kw: 0.5 },
  { name: 'Dishwasher', duration: 90, power_kw: 0.7 },
  { name: 'Tumble Dryer', duration: 60, power_kw: 2.5 },
  { name: 'EV Charge (4h)', duration: 240, power_kw: 7.0 },
];


const ForecastChart = ({ forecastData, bestTime, selectedAppliance, currentRegionName }) => {
  // (This component has no changes)
  const COLOR_DEFAULT = '#607d8b';
  const COLOR_CURRENT = '#ff9800';
  const COLOR_BEST = '#4caf50';

  const { bestTimeStartIndex, bestTimeEndIndex } = useMemo(() => {
    if (!bestTime || bestTime.error || !selectedAppliance || !forecastData.length) {
      return { bestTimeStartIndex: null, bestTimeEndIndex: null };
    }
    const startIndex = forecastData.findIndex(
      d => new Date(d.from).getTime() === new Date(bestTime.start_time).getTime()
    );
    if (startIndex === -1) {
      return { bestTimeStartIndex: null, bestTimeEndIndex: null };
    }
    const numberOfSlots = selectedAppliance.duration / 30;
    const endIndex = startIndex + numberOfSlots;
    return { bestTimeStartIndex: startIndex, bestTimeEndIndex: endIndex };
  }, [bestTime, selectedAppliance, forecastData]);

  if (!forecastData || forecastData.length === 0) return <p>Loading forecast chart...</p>;

  const getSegmentColor = (context, isPoint) => {
    if (!isPoint && !context.p0) return COLOR_DEFAULT;
    const index = isPoint ? context.dataIndex : context.p0.dataIndex;
    if (bestTimeStartIndex !== null && index >= bestTimeStartIndex && index < bestTimeEndIndex) {
      return COLOR_BEST;
    }
    if (index === 0) return COLOR_CURRENT;
    return COLOR_DEFAULT;
  };

  const getPointColor = (context) => {
    const index = context.dataIndex;
    if (bestTimeStartIndex !== null && index >= bestTimeStartIndex && index <= bestTimeEndIndex) {
      return COLOR_BEST;
    }
    if (index === 0) return COLOR_CURRENT;
    return COLOR_DEFAULT;
  }

  const chartData = {
    labels: forecastData.map(d => new Date(d.from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })),
    datasets: [{
      label: 'Carbon Intensity Forecast (gCO₂/kWh)',
      data: forecastData.map(d => d.intensity.forecast),
      tension: 0.2,
      borderColor: (context) => getSegmentColor(context, false),
      pointBackgroundColor: (context) => getPointColor(context),
      pointRadius: (context) => {
        const index = context.dataIndex;
        if (index === 0 || (bestTimeStartIndex !== null && index >= bestTimeStartIndex && index <= bestTimeEndIndex)) {
            return 3;
        }
        return 1;
      },
      pointHoverRadius: 5,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#f0f0f0' } },
      title: { display: true, text: `${currentRegionName} 48-Hour Carbon Intensity Forecast`, color: '#f0f0f0' }, 
    },
    scales: {
      y: { beginAtZero: false, ticks: { color: '#a9a9a9' }, grid: { color: 'rgba(240, 240, 240, 0.1)' } },
      x: { ticks: { color: '#a9a9a9' }, grid: { color: 'rgba(240, 240, 240, 0.1)' } }
    },
  };

  return <div style={{ height: '400px' }}><Line options={options} data={chartData} /></div>;
};


function App() {
  const [intensityData, setIntensityData] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [nationalGenerationMix, setNationalGenerationMix] = useState(null); // --- NEW STATE ---
  const [error, setError] = useState('');

  const [bestTime, setBestTime] = useState(null);
  const [isLoadingBestTime, setIsLoadingBestTime] = useState(false);
  const [selectedAppliance, setSelectedAppliance] = useState(null);

  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('National');
  const [regionalIntensityData, setRegionalIntensityData] = useState(null);
  const [regionalForecastData, setRegionalForecastData] = useState([]);
  const [regionalGenerationMix, setRegionalGenerationMix] = useState(null); // --- NEW STATE ---
  const [isLoadingRegionData, setIsLoadingRegionData] = useState(false);
  const [regionError, setRegionError] = useState('');


  // --- MODIFIED: Unified Data Fetching Function ---
  const fetchData = useCallback(async (regionToFetch = 'National') => {
    let currentData, forecastArr, generationMix = null, currentError = '';

    try {
      if (regionToFetch === 'National') {
        const [currentRes, forecastRes, genMixRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/intensity/current`),
          fetch(`${API_BASE_URL}/api/v1/intensity/forecast/48h`),
          fetch(`${API_BASE_URL}/api/v1/generation/current`) // --- NEW FETCH ---
        ]);

        if (!currentRes.ok || !forecastRes.ok || !genMixRes.ok) {
          throw new Error('Network response for national data was not ok');
        }
        currentData = await currentRes.json();
        forecastArr = await forecastRes.json();
        const genMixData = await genMixRes.json(); // --- NEW ---
        generationMix = genMixData.generationmix; // --- NEW ---

      } else {
        setIsLoadingRegionData(true);
        const [currentRegionalResponse, forecastRegionalResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/intensity/regional/current/${encodeURIComponent(regionToFetch)}`),
          fetch(`${API_BASE_URL}/api/v1/intensity/regional/forecast/48h/${encodeURIComponent(regionToFetch)}`)
        ]);

        if (!currentRegionalResponse.ok || !forecastRegionalResponse.ok) {
          throw new Error(`Could not fetch data for ${regionToFetch}.`);
        }
        currentData = await currentRegionalResponse.json();
        forecastArr = await forecastRegionalResponse.json();
        // --- Regional generation mix is already included in the 'current' response! ---
        generationMix = currentData.generationmix; 
        setIsLoadingRegionData(false);
      }
      return { currentData, forecastArr, generationMix, error: null };
    } catch (err) {
      currentError = err.message || 'An unexpected error occurred during data fetch.';
      console.error(`Failed to fetch data for ${regionToFetch}:`, err);
      return { currentData: null, forecastArr: [], generationMix: null, error: currentError };
    }
  }, []);


  // --- MODIFIED: Initial Fetch and Interval Logic ---
  useEffect(() => {
    const initialLoad = async () => {
      try {
        const regionsResponse = await fetch(`${API_BASE_URL}/api/v1/regions`);
        if (!regionsResponse.ok) throw new Error('Could not fetch regions');
        const regionsData = await regionsResponse.json();
        setRegions(['National', ...regionsData.regions]);
      } catch (err) {
        setError('Could not fetch available regions.');
      }

      const { currentData, forecastArr, generationMix, error: initialError } = await fetchData('National');
      setIntensityData(currentData);
      setForecastData(forecastArr);
      setNationalGenerationMix(generationMix); // --- NEW ---
      setError(initialError || '');
    };

    initialLoad();

    const intervalId = setInterval(async () => {
        const { currentData, forecastArr, generationMix, error: periodicError } = await fetchData(selectedRegion);
        if (selectedRegion === 'National') {
            setIntensityData(currentData);
            setForecastData(forecastArr);
            setNationalGenerationMix(generationMix); // --- NEW ---
            setError(periodicError || '');
        } else {
            setRegionalIntensityData(currentData);
            setRegionalForecastData(forecastArr.data || []);
            setRegionalGenerationMix(generationMix); // --- NEW ---
            setRegionError(periodicError || '');
        }
    }, 180000); // 3 minutes

    return () => clearInterval(intervalId);
  }, [fetchData, selectedRegion]); // selectedRegion dependency is key for interval refresh


  // --- MODIFIED: Update Data on Region Change ---
  useEffect(() => {
    const updateDisplay = async () => {
        setBestTime(null);
        if (selectedRegion === 'National') {
            setRegionalIntensityData(null); 
            setRegionalForecastData([]);
            setRegionalGenerationMix(null); // --- NEW ---
            setRegionError('');
        } else {
            // Fetch new regional data immediately on change
            const { currentData, forecastArr, generationMix, error: regionalFetchError } = await fetchData(selectedRegion);
            setRegionalIntensityData(currentData);
            setRegionalForecastData(forecastArr.data || []);
            setRegionalGenerationMix(generationMix); // --- NEW ---
            setRegionError(regionalFetchError || '');
        }
    };
    updateDisplay();
  }, [selectedRegion, fetchData]);


  // handlePresetClick (no changes needed)
  const handlePresetClick = async (appliance) => {
    setSelectedAppliance(appliance);
    setIsLoadingBestTime(true);
    setBestTime(null);
    try {
      const params = new URLSearchParams();
      params.append('duration_minutes', appliance.duration.toString());
      params.append('power_kw', appliance.power_kw.toString());
      if (selectedRegion !== 'National') {
        params.append('region_shortname', selectedRegion);
      }
      const optimizerUrl = `${API_BASE_URL}/api/v1/optimizer/best-time?${params.toString()}`;
      const response = await fetch(optimizerUrl);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'An unexpected error occurred.');
      }
      const data = await response.json();
      setBestTime(data);
    } catch (err) {
      setBestTime({ error: err.message });
    }
    setIsLoadingBestTime(false);
  };

  const getIndexColor = (index) => {
    switch (index) {
      case 'very low': return '#4caf50'; case 'low': return '#8bc34a';
      case 'moderate': return '#ffc107'; case 'high': return '#ff9800';
      case 'very high': return '#f44336'; default: return '#9e9e9e';
    }
  };

  // --- MODIFIED: Determine which data to display ---
  const displayIntensityData = selectedRegion === 'National' ? intensityData : regionalIntensityData;
  const displayForecastData = selectedRegion === 'National' ? forecastData : regionalForecastData;
  const displayGenerationMix = selectedRegion === 'National' ? nationalGenerationMix : regionalGenerationMix;
  const displayRegionName = selectedRegion === 'National' ? 'UK' : selectedRegion;


  return (
    <div className="App">
      <div className="section-box location-selector">
        <h2>Carbon Intensity ({displayRegionName})</h2>
        <div className="region-selector-controls">
          <label htmlFor="region-select">Select Region:</label>
          <select id="region-select" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} disabled={isLoadingRegionData} className="region-dropdown">
            {regions.map(region => <option key={region} value={region}>{region}</option>)}
          </select>
          {isLoadingRegionData && <p>Loading region data...</p>}
          {regionError && <p className="error-text">{regionError}</p>}
        </div>
      </div>

      {/* --- NEW LAYOUT for top row --- */}
      <div className="top-row-container">
        <div className="section-box intensity-box">
          {displayIntensityData && displayIntensityData.intensity ? (
            <>
              <h2>Current Intensity</h2>
              <div className="hero-value">{displayIntensityData.intensity.actual || displayIntensityData.intensity.forecast || 'N/A'}</div> 
              <div className="hero-unit">gCO₂/kWh</div>
              <div className="intensity-badge" style={{ backgroundColor: getIndexColor(displayIntensityData.intensity.index) }}>
                {displayIntensityData.intensity.index}
              </div>
            </>
          ) : !error && !regionError ? <p>Loading current intensity...</p> : <p className="error-text">{error || regionError}</p>}
        </div>
        
        {/* --- NEW Generation Mix Chart Section --- */}
        <div className="section-box generation-mix-box">
           <GenerationMixChart 
              generationMixData={displayGenerationMix}
              regionName={displayRegionName}
            />
        </div>
      </div>


      <div className="section-box">
        <h3>Find the Greenest Time for...</h3>
        <div className="optimizer-presets">
          {APPLIANCE_PRESETS.map((appliance) => (
            <button key={appliance.name} className={`preset-button ${selectedAppliance?.name === appliance.name ? 'active' : ''}`} onClick={() => handlePresetClick(appliance)} disabled={isLoadingBestTime || isLoadingRegionData}>
              {isLoadingBestTime && selectedAppliance?.name === appliance.name ? 'Calculating...' : appliance.name}
            </button>
          ))}
        </div>

        {bestTime && (
          <div className="optimizer-result">
            {bestTime.error ? <p className="error-text">Error: {bestTime.error}</p> : (
              <>
                <p>The best time for your <strong>{selectedAppliance.name}</strong> starts at:</p>
                <div className="result-time">{new Date(bestTime.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}</div>
                <p className="result-savings">Estimated saving: <strong>{bestTime.saved_grams_co2.toLocaleString()}g of CO₂</strong></p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="chart-container">
        <ForecastChart forecastData={displayForecastData} bestTime={bestTime} selectedAppliance={selectedAppliance} currentRegionName={displayRegionName} />
      </div>
    </div>
  );
}

export default App;