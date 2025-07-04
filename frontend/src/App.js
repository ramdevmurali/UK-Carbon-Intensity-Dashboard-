// frontend/src/App.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const API_BASE_URL = 'http://localhost:8001';

const APPLIANCE_PRESETS = [
  { name: 'Washing Machine', duration: 120, power_kw: 0.5 },
  { name: 'Dishwasher', duration: 90, power_kw: 0.7 },
  { name: 'Tumble Dryer', duration: 60, power_kw: 2.5 },
  { name: 'EV Charge (4h)', duration: 240, power_kw: 7.0 },
];

/**
 * A dedicated component to render the THEMED forecast chart.
 * It now highlights the current time and the calculated best time window.
 */
const ForecastChart = ({ forecastData, bestTime, selectedAppliance, currentRegionName }) => {
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


/**
 * The main application component.
 */
function App() {
  const [intensityData, setIntensityData] = useState(null); // Current (National)
  const [forecastData, setForecastData] = useState([]); // Forecast (National)
  const [error, setError] = useState(''); // General error for national data fetch
  const [bestTime, setBestTime] = useState(null);
  const [isLoadingBestTime, setIsLoadingBestTime] = useState(false);
  const [selectedAppliance, setSelectedAppliance] = useState(null);

  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('National'); // Default to 'National'
  const [regionalIntensityData, setRegionalIntensityData] = useState(null); // For selected region's current data
  const [regionalForecastData, setRegionalForecastData] = useState([]); // For selected region's forecast data
  const [isLoadingRegionData, setIsLoadingRegionData] = useState(false);
  const [regionError, setRegionError] = useState(''); // Specific error for regional data fetch


  // --- Unified Data Fetching Function ---
  const fetchData = useCallback(async (regionToFetch = 'National') => {
    let currentData = null;
    let forecastArr = [];
    let currentError = '';

    try {
      if (regionToFetch === 'National') {
        // Fetch National data
        const [currentNationalResponse, forecastNationalResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/intensity/current`),
          fetch(`${API_BASE_URL}/api/v1/intensity/forecast/48h`)
        ]);

        if (!currentNationalResponse.ok || !forecastNationalResponse.ok) {
          throw new Error('Network response for national data was not ok');
        }
        currentData = await currentNationalResponse.json();
        forecastArr = await forecastNationalResponse.json();
      } else {
        // Fetch Regional data
        setIsLoadingRegionData(true);
        const [currentRegionalResponse, forecastRegionalResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/intensity/regional/current/${encodeURIComponent(regionToFetch)}`),
          fetch(`${API_BASE_URL}/api/v1/intensity/regional/forecast/48h/${encodeURIComponent(regionToFetch)}`)
        ]);

        if (!currentRegionalResponse.ok || !forecastRegionalResponse.ok) {
          const currentErrorData = await currentRegionalResponse.json().catch(() => ({ detail: 'Unknown error.' }));
          const forecastErrorData = await forecastRegionalResponse.json().catch(() => ({ detail: 'Unknown error.' }));
          const errorMessage = currentErrorData.detail || forecastErrorData.detail || `Could not fetch data for ${regionToFetch}.`;
          throw new Error(errorMessage);
        }
        currentData = await currentRegionalResponse.json();
        forecastArr = await forecastRegionalResponse.json();
        setIsLoadingRegionData(false);
      }
      return { currentData, forecastArr, error: null };
    } catch (err) {
      currentError = err.message || 'An unexpected error occurred during data fetch.';
      console.error(`Failed to fetch data for ${regionToFetch}:`, err);
      return { currentData: null, forecastArr: [], error: currentError };
    }
  }, []);


  // --- EFFECT HOOK 1: Initial Fetch for Regions and National Data ---
  useEffect(() => {
    const initialLoad = async () => {
      // Fetch available regions only once
      try {
        const regionsResponse = await fetch(`${API_BASE_URL}/api/v1/regions`);
        if (!regionsResponse.ok) {
          throw new Error('Network response for regions was not ok');
        }
        const regionsData = await regionsResponse.json();
        setRegions(['National', ...regionsData.regions]);
      } catch (err) {
        console.error("Failed to fetch available regions:", err);
        setError('Could not fetch available regions from the backend.');
      }

      // Fetch initial National data
      const { currentData, forecastArr, error: initialError } = await fetchData('National');
      setIntensityData(currentData);
      setForecastData(forecastArr);
      setError(initialError || '');
    };

    initialLoad();

    // Set up interval for data refresh (based on currently selected region)
    const intervalId = setInterval(async () => {
        const { currentData, forecastArr, error: periodicError } = await fetchData(selectedRegion);
        if (selectedRegion === 'National') {
            setIntensityData(currentData);
            setForecastData(forecastArr);
            setError(periodicError || '');
        } else {
            setRegionalIntensityData(currentData);
            setRegionalForecastData(forecastArr.data || []);
            setRegionError(periodicError || '');
        }
    }, 180000);

    return () => clearInterval(intervalId);
  }, [fetchData, selectedRegion]);


  // --- EFFECT HOOK 2: Update Data Display based on selectedRegion ---
  useEffect(() => {
    const updateDisplay = async () => {
        setBestTime(null); // Clear optimizer result on region change

        if (selectedRegion === 'National') {
            setRegionalIntensityData(null); 
            setRegionalForecastData([]);
            setRegionError('');
        } else {
            const { currentData, forecastArr, error: regionalFetchError } = await fetchData(selectedRegion);
            setRegionalIntensityData(currentData);
            setRegionalForecastData(forecastArr.data || []);
            setRegionError(regionalFetchError || '');
        }
    };
    updateDisplay();
  }, [selectedRegion, fetchData]);


  // --- MODIFIED handlePresetClick with debug logging for 422 ---
  const handlePresetClick = async (appliance) => {
    setSelectedAppliance(appliance);
    setIsLoadingBestTime(true);
    setBestTime(null);

    try {
      // Use URLSearchParams for clean and correct query string construction
      const params = new URLSearchParams();
      params.append('duration_minutes', appliance.duration.toString()); // Convert to string for URL param
      params.append('power_kw', appliance.power_kw.toString()); // Convert to string for URL param

      if (selectedRegion !== 'National') {
        params.append('region_shortname', selectedRegion); // URLSearchParams handles encoding
      }

      const optimizerUrl = `${API_BASE_URL}/api/v1/optimizer/best-time?${params.toString()}`;

      console.log("Optimizer API Call URL (using URLSearchParams):", optimizerUrl); // This log will now show a clean URL

      const response = await fetch(optimizerUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'An unknown error occurred parsing error response.' }));
        console.error("Backend optimizer error response (likely 422 validation error):", errorData);
        
        let errorMessage = 'An unexpected error occurred.';
        if (errorData && Array.isArray(errorData.detail) && errorData.detail.length > 0) {
            errorMessage = errorData.detail.map(err => {
                // This enhanced message parsing will provide more detail from FastAPI validation errors
                const field = err.loc && err.loc.length > 1 ? err.loc[1] : 'unknown field';
                return `Field '${field}': ${err.msg}`;
            }).join('; ');
        } else if (errorData && errorData.detail) {
            errorMessage = errorData.detail;
        }

        throw new Error(errorMessage);
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

  // --- Determine which data to display based on selectedRegion ---
  const displayIntensityData = selectedRegion === 'National' ? intensityData : regionalIntensityData;
  const displayForecastData = selectedRegion === 'National' ? forecastData : regionalForecastData;
  const displayRegionName = selectedRegion === 'National' ? 'UK' : selectedRegion;


  return (
    <div className="App">
      <div className="section-box location-selector">
        <h2>Carbon Intensity ({displayRegionName})</h2>
        <div className="region-selector-controls">
          <label htmlFor="region-select">Select Region:</label>
          <select
            id="region-select"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            disabled={isLoadingRegionData}
            className="region-dropdown"
          >
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
          {isLoadingRegionData && <p>Loading region data...</p>}
          {regionError && <p className="error-text">{regionError}</p>}
        </div>
      </div>

      <div className="section-box">
        {displayIntensityData && displayIntensityData.intensity ? (
          <>
            <h2>Current {displayRegionName} Carbon Intensity</h2>
            {/* Display actual if available, otherwise fallback to forecast */}
            <div className="hero-value">{displayIntensityData.intensity.actual || displayIntensityData.intensity.forecast || 'N/A'}</div> 
            <div className="hero-unit">gCO₂/kWh</div>
            <div className="intensity-badge" style={{ backgroundColor: getIndexColor(displayIntensityData.intensity.index) }}>
              {displayIntensityData.intensity.index}
            </div>
          </>
        ) : !error && !regionError ? <p>Loading current intensity...</p> : <p className="error-text">{error || regionError}</p>}
      </div>

      <div className="section-box">
        <h3>Find the Greenest Time for...</h3>
        <div className="optimizer-presets">
          {APPLIANCE_PRESETS.map((appliance) => (
            <button
              key={appliance.name}
              className={`preset-button ${selectedAppliance?.name === appliance.name ? 'active' : ''}`}
              onClick={() => handlePresetClick(appliance)}
              disabled={isLoadingBestTime || isLoadingRegionData}
            >
              {isLoadingBestTime && selectedAppliance?.name === appliance.name ? 'Calculating...' : appliance.name}
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

      <div className="chart-container">
        <ForecastChart 
          forecastData={displayForecastData} 
          bestTime={bestTime} 
          selectedAppliance={selectedAppliance}
          currentRegionName={displayRegionName}
        />
      </div>
    </div>
  );
}

export default App;