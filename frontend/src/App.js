// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
// Import the Line component and other necessary parts from the chart libraries
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
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);
// frontend/src/App.js - THE CORRECT URLS

const CURRENT_INTENSITY_URL = 'http://localhost:8001/api/v1/intensity/current';
const FORECAST_URL = 'http://localhost:8001/api/v1/intensity/forecast/48h';


// A new component specifically for our forecast chart
const ForecastChart = ({ forecastData }) => {
  if (!forecastData || forecastData.length === 0) {
    return <p>Loading forecast chart...</p>;
  }

  // We need to format the data for Chart.js
  const chartData = {
    labels: forecastData.map(d => {
      // Format the 'from' timestamp to be more readable (e.g., "14:30")
      const date = new Date(d.from);
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    }),
    datasets: [
      {
        label: 'Carbon Intensity Forecast (gCO₂/kWh)',
        data: forecastData.map(d => d.intensity.forecast),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
    ],
  };

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
            beginAtZero: true
        }
    }
  };

  return <Line options={options} data={chartData} />;
};


function App() {
  const [intensityData, setIntensityData] = useState(null);
  // New state for forecast data
  const [forecastData, setForecastData] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Function to fetch all data
    const fetchData = async () => {
      try {
        // Use Promise.all to fetch both endpoints at the same time
        const [currentResponse, forecastResponse] = await Promise.all([
          fetch(CURRENT_INTENSITY_URL),
          fetch(FORECAST_URL)
        ]);

        if (!currentResponse.ok || !forecastResponse.ok) {
          throw new Error('Network response was not ok');
        }

        const currentData = await currentResponse.json();
        const forecastArr = await forecastResponse.json();

        setIntensityData(currentData);
        setForecastData(forecastArr);

      } catch (error) {
        console.error("There was an error fetching the data!", error);
        setError('Could not fetch data from the backend. Is the server running?');
      }
    };

    fetchData();
  }, []); // Runs only once on component mount

  const renderIntensityInfo = () => {
    if (error) return <p style={{ color: 'red' }}>{error}</p>;
    if (!intensityData) return <p>Loading current intensity...</p>;
    
    return (
      <div style={{ marginBottom: '40px' }}>
        <h2>Current UK Carbon Intensity</h2>
        <h1>{intensityData.intensity.actual || 'N/A'}</h1>
        <p>gCO₂/kWh</p>
        <div style={{
            padding: '20px',
            borderRadius: '10px',
            backgroundColor: getIndexColor(intensityData.intensity.index),
            color: 'white', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '1.5em'
        }}>
            {intensityData.intensity.index}
        </div>
      </div>
    );
  };

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
        {renderIntensityInfo()}
        {/* Render the new chart component */}
        <div style={{ width: '80%', backgroundColor: 'white', padding: '20px', borderRadius: '10px' }}>
            <ForecastChart forecastData={forecastData} />
        </div>
      </header>
    </div>
  );
}

export default App;