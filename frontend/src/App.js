// frontend/src/App.js

import React, { useState, useEffect } from 'react';
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
 */
const ForecastChart = ({ forecastData }) => {
  if (!forecastData || forecastData.length === 0) return <p>Loading forecast chart...</p>;

  const chartData = {
    labels: forecastData.map(d => new Date(d.from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })),
    datasets: [{
      label: 'Carbon Intensity Forecast (gCO₂/kWh)',
      data: forecastData.map(d => d.intensity.forecast),
      borderColor: '#00bcd4', // Use our new accent color
      backgroundColor: 'rgba(0, 188, 212, 0.1)',
      tension: 0.2,
      pointBackgroundColor: '#00bcd4',
      pointRadius: 1,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#f0f0f0' } }, // Themed labels
      title: { display: true, text: '48-Hour Carbon Intensity Forecast', color: '#f0f0f0' }, // Themed title
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: { color: '#a9a9a9' }, // Themed Y-axis labels
        grid: { color: 'rgba(240, 240, 240, 0.1)' } // Themed grid lines
      },
      x: {
        ticks: { color: '#a9a9a9' }, // Themed X-axis labels
        grid: { color: 'rgba(240, 240, 240, 0.1)' } // Themed grid lines
      }
    },
  };

  return <div style={{ height: '400px' }}><Line options={options} data={chartData} /></div>;
};


/**
 * The main application component.
 */
function App() {
  const [intensityData, setIntensityData] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [error, setError] = useState('');
  const [bestTime, setBestTime] = useState(null);
  const [isLoadingBestTime, setIsLoadingBestTime] = useState(false);
  const [selectedAppliance, setSelectedAppliance] = useState(null);

  useEffect(() => {
    const fetchData = async () => { /* ... same fetching logic as before ... */ };
    const initialFetch = async () => {
        try {
            const [currentResponse, forecastResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/v1/intensity/current`),
                fetch(`${API_BASE_URL}/api/v1/intensity/forecast/48h`)
            ]);
            if (!currentResponse.ok || !forecastResponse.ok) throw new Error('Network response was not ok');
            const currentData = await currentResponse.json();
            const forecastArr = await forecastResponse.json();
            setIntensityData(currentData); setForecastData(forecastArr); setError('');
        } catch (error) {
            setError('Could not fetch initial data from the backend.');
        }
    };
    initialFetch();
    const intervalId = setInterval(initialFetch, 180000);
    return () => clearInterval(intervalId);
  }, []);

  const handlePresetClick = async (appliance) => {
    setSelectedAppliance(appliance);
    setIsLoadingBestTime(true);
    setBestTime(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/optimizer/best-time?duration_minutes=${appliance.duration}&power_kw=${appliance.power_kw}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'An unknown error occurred.' }));
        throw new Error(errorData.detail);
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

  return (
    <div className="App">
      <div className="section-box">
        {intensityData ? (
          <>
            <h2>Current UK Carbon Intensity</h2>
            <div className="hero-value">{intensityData.intensity.actual || 'N/A'}</div>
            <div className="hero-unit">gCO₂/kWh</div>
            <div className="intensity-badge" style={{ backgroundColor: getIndexColor(intensityData.intensity.index) }}>
              {intensityData.intensity.index}
            </div>
          </>
        ) : !error ? <p>Loading current intensity...</p> : <p className="error-text">{error}</p>}
      </div>

      <div className="section-box">
        <h3>Find the Greenest Time for...</h3>
        <div className="optimizer-presets">
          {APPLIANCE_PRESETS.map((appliance) => (
            <button
              key={appliance.name}
              className={`preset-button ${selectedAppliance?.name === appliance.name ? 'active' : ''}`}
              onClick={() => handlePresetClick(appliance)}
              disabled={isLoadingBestTime}
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
        <ForecastChart forecastData={forecastData} />
      </div>
    </div>
  );
}

export default App;