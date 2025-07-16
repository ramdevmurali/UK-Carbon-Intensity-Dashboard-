// frontend/src/components/GenerationMixChart.js

import React from 'react';
import { Doughnut } from 'react-chartjs-2'; // Assuming Doughnut chart is used

// Note: ChartJS elements are registered in App.js

const GenerationMixChart = ({ generationMixData, regionName }) => {
  if (!generationMixData || generationMixData.length === 0) {
    return (
      <div className="chart-loading">
        <p>Loading generation mix...</p>
      </div>
    );
  }

  // Define consistent colors for fuel types
  const fuelColors = {
    'gas': '#ff9800',       // Orange
    'solar': '#ffeb3b',     // Yellow
    'imports': '#9e9e9e',   // Grey
    'nuclear': '#673ab7',   // Deep Purple
    'wind': '#00bcd4',      // Teal
    'biomass': '#8bc34a',   // Light Green
    'coal': '#424242',      // Dark Grey
    'other': '#b0bec5',     // Light Blue-Grey
    'hydro': '#2196f3',     // Blue
  };

  const labels = generationMixData.map(d => `${d.fuel.charAt(0).toUpperCase() + d.fuel.slice(1)} (${d.perc}%)`);
  const dataValues = generationMixData.map(d => d.perc);
  const backgroundColors = generationMixData.map(d => fuelColors[d.fuel] || '#ccc'); // Fallback color

  const chartData = {
    labels: labels,
    datasets: [{
      data: dataValues,
      backgroundColor: backgroundColors,
      borderColor: '#2d3748', // Border color to match card background for separation
      borderWidth: 2,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        // --- THE FIX IS HERE ---
        position: 'bottom', // Changed from 'right' to 'bottom'
        // --- END FIX ---
        labels: {
          color: '#f0f0f0', // Text color for legend labels
          usePointStyle: true, // Use colored circles instead of squares
          font: {
            size: 12
          }
        },
      },
      title: {
        display: true,
        text: `Current ${regionName} Generation Mix`,
        color: '#f0f0f0', // Text color for chart title
        font: {
          size: 16
        },
      },
    },
    cutout: '70%', // Makes it a doughnut chart
  };

  return (
    <div style={{ height: '300px' }}> {/* Adjust height as needed */}
      <Doughnut data={chartData} options={options} />
    </div>
  );
};

export default GenerationMixChart;