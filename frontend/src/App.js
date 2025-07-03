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

// This is a crucial step for Chart.js v3+ to work.
// We register all the parts of the chart we intend to use.
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Define the API base URL in a constant for easy maintenance.
// This must be 'localhost' because the fetch request is made from the user's browser,
// which is outside the Docker network. Docker maps localhost:8001 to our backend container.
const API_BASE_URL = 'http://localhost:8001';

/**
 * A dedicated component to render the forecast chart.
 * It's kept separate for clarity.
 */
const ForecastChart = ({ forecastData }) => {
  // Don't render the chart if data is not yet available.
  if (!forecastData || forecastData.length === 0) {
    return <p>Loading forecast chart...</p>;
  }

  // Format the data from our API into the structure Chart.js expects.
  const chartData = {
    labels: forecastData.map(d => {
      // Format the 'from' timestamp into a user-friendly local time (e.g., "14:30").
      const date = new Date(d.from);
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    }),
    datasets: [
      {
        label: 'Carbon Intensity Forecast (gCO₂/kWh)',
        data: forecastData.map(d => d.intensity.forecast),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1, // This makes the line slightly curved and smoother.
      },
    ],
  };

  // Configure the chart's appearance and behavior.
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '48-Hour Carbon Intensity Forecast',
      },
    },
    scales: {
        y: {
            beginAtZero: true // Ensure the Y-axis starts at 0.
        }
    }
  };

  return <Line options={options} data={chartData} />;
};


/**
 * The main application component.
 */
function App() {
  const [intensityData, setIntensityData] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [error, setError] = useState('');

  // This useEffect hook handles all data fetching and auto-reloading.
  useEffect(() => {
    const fetchData = async () => {
      console.log("Fetching latest carbon intensity data..."); // Useful for debugging in the browser console.
      try {
        // Use Promise.all to fetch both endpoints concurrently for efficiency.
        const [currentResponse, forecastResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/intensity/current`),
          fetch(`${API_BASE_URL}/api/v1/intensity/forecast/48h`)
        ]);

        if (!currentResponse.ok || !forecastResponse.ok) {
          throw new Error('A network response was not ok');
        }

        const currentData = await currentResponse.json();
        const forecastArr = await forecastResponse.json();

        setIntensityData(currentData);
        setForecastData(forecastArr);
        setError(''); // Clear any previous errors on a successful fetch.
        
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setError('Could not fetch data from the backend. Is it running?');
      }
    };

    // 1. Fetch data immediately when the app loads.
    fetchData();

    // 2. Set up an interval to automatically re-fetch data every 3 minutes.
    // (3 minutes * 60 seconds/minute * 1000 milliseconds/second = 180000 ms)
    const intervalId = setInterval(fetchData, 180000);

    // 3. Return a cleanup function. React runs this when the component
    // unmounts, preventing memory leaks and runaway API calls.
    return () => {
      console.log("Cleaning up the data fetching interval.");
      clearInterval(intervalId);
    };
  }, []); // The empty dependency array `[]` is crucial. It tells React to run this setup effect only once.

  /**
   * Helper function to determine the display color based on the intensity index.
   */
  const getIndexColor = (index) => {
    switch (index) {
      case 'very low': return '#2E7D32';
      case 'low': return '#4CAF50';
      case 'moderate': return '#FFC107';
      case 'high': return '#FF9800';
      case 'very high': return '#F44336';
      default: return '#757575'; // A fallback grey.
    }
  };

  /**
   * Renders the main view of the application.
   */
  return (
    <div className="App">
      <header className="App-header">
        {/* Only show content if there is no error. */}
        {error ? <p style={{ color: 'red' }}>{error}</p> : (
          <>
            {/* Current Intensity Section */}
            <div style={{ marginBottom: '40px', minHeight: '150px' }}>
              {intensityData ? (
                <>
                  <h2>Current UK Carbon Intensity</h2>
                  <h1>{intensityData.intensity.actual || 'N/A'}</h1>
                  <p>gCO₂/kWh</p>
                  <div style={{
                      padding: '20px', borderRadius: '10px', backgroundColor: getIndexColor(intensityData.intensity.index),
                      color: 'white', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '1.5em'
                  }}>
                    {intensityData.intensity.index}
                  </div>
                </>
              ) : <p>Loading current intensity...</p>}
            </div>

            {/* Forecast Chart Section */}
            <div style={{ width: '80%', backgroundColor: 'white', padding: '20px', borderRadius: '10px' }}>
                <ForecastChart forecastData={forecastData} />
            </div>
          </>
        )}
      </header>
    </div>
  );
}

export default App;