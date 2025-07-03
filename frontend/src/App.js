// frontend/src/App.js

import React, { useState, useEffect } from 'react';
import './App.css';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register the components we need from Chart.js
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend
);

const API_BASE_URL = 'http://localhost:8001';

/**
 * A dedicated component to render the forecast chart.
 * No changes are needed here.
 */
const ForecastChart = ({ forecastData }) => {
  if (!forecastData || forecastData.length === 0) {
    return <p>Loading forecast chart...</p>;
  }

  const chartData = {
    labels: forecastData.map(d => {
      const date = new Date(d.from);
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    }),
    datasets: [{
      label: 'Carbon Intensity Forecast (gCO₂/kWh)',
      data: forecastData.map(d => d.intensity.forecast),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.1,
    }],
  };

  const options = {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: '48-Hour Carbon Intensity Forecast' } },
    scales: { y: { beginAtZero: true } },
  };

  return <Line options={options} data={chartData} />;
};


/**
 * The main application component.
 */
function App() {
  // --- Existing State ---
  const [intensityData, setIntensityData] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [error, setError] = useState('');

  // ===============================================
  // === NEW STATE FOR THE OPTIMIZER FEATURE ===
  // ===============================================
  const [duration, setDuration] = useState(120); // Default to 120 minutes
  const [bestTime, setBestTime] = useState(null); // Stores the result from the API
  const [isLoadingBestTime, setIsLoadingBestTime] = useState(false); // Manages the button's loading state

  // --- Existing useEffect for data fetching and auto-reloading ---
  useEffect(() => {
    const fetchData = async () => {
      console.log("Fetching latest carbon intensity data...");
      try {
        const [currentResponse, forecastResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/intensity/current`),
          fetch(`${API_BASE_URL}/api/v1/intensity/forecast/48h`)
        ]);
        if (!currentResponse.ok || !forecastResponse.ok) throw new Error('A network response was not ok');
        const currentData = await currentResponse.json();
        const forecastArr = await forecastResponse.json();
        setIntensityData(currentData);
        setForecastData(forecastArr);
        setError('');
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setError('Could not fetch initial data from the backend.');
      }
    };
    fetchData();
    const intervalId = setInterval(fetchData, 180000);
    return () => clearInterval(intervalId);
  }, []);

  // =========================================================
  // === NEW HANDLER FUNCTION TO CALL THE OPTIMIZER API ===
  // =========================================================
  const handleFindBestTime = async () => {
    setIsLoadingBestTime(true);
    setBestTime(null); // Clear previous results

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/optimizer/best-time?duration_minutes=${duration}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'An unknown error occurred.' }));
        throw new Error(errorData.detail);
      }
      const data = await response.json();
      setBestTime(data);
    } catch (err) {
      console.error("Optimizer Error:", err);
      setBestTime({ error: err.message }); // Store the error message in the 'bestTime' state
    }
    setIsLoadingBestTime(false); // Ensure loading is set to false in all cases
  };

  // --- Helper function for colors (No changes here) ---
  const getIndexColor = (index) => {
    switch (index) {
      case 'very low': return '#2E7D32';
      case 'low': return '#4CAF50';
      case 'moderate': return '#FFC107';
      case 'high': return '#FF9800';
      case 'very high': return '#F44336';
      default: return '#757575';
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        {error && <p className="error-text">{error}</p>}

        {/* Current Intensity Section */}
        <div className="section-box">
          {intensityData ? (
            <>
              <h2>Current UK Carbon Intensity</h2>
              <h1>{intensityData.intensity.actual || 'N/A'}</h1>
              <p>gCO₂/kWh</p>
              <div className="intensity-badge" style={{ backgroundColor: getIndexColor(intensityData.intensity.index) }}>
                {intensityData.intensity.index}
              </div>
            </>
          ) : !error && <p>Loading current intensity...</p>}
        </div>

        {/* =============================== */}
        {/* === NEW OPTIMIZER UI SECTION === */}
        {/* =============================== */}
        <div className="section-box">
          <h3>Find Your Greenest Window</h3>
          <div className="optimizer-controls">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              placeholder="Duration in minutes"
              step="30"
              min="30"
            />
            <button onClick={handleFindBestTime} disabled={isLoadingBestTime || !duration}>
              {isLoadingBestTime ? 'Calculating...' : 'Find Best Time'}
            </button>
          </div>

          {bestTime && (
            <div className="optimizer-result">
              {bestTime.error ? (
                <p className="error-text">Error: {bestTime.error}</p>
              ) : (
                <p>
                  The best {duration}-minute window starts at: <br />
                  <strong>
                    {new Date(bestTime.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
                  </strong>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Forecast Chart Section */}
        <div className="chart-container">
          <ForecastChart forecastData={forecastData} />
        </div>

      </header>
    </div>
  );
}

export default App;