// frontend/src/GenerationMixChart.js

import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import './GenerationMixChart.css';

ChartJS.register(ArcElement, Tooltip, Legend);

// Consistent colors for fuel types
const FUEL_COLORS = {
  gas: '#f9a825', // Yellow/Orange
  coal: '#424242', // Dark Grey
  biomass: '#689f38', // Green
  nuclear: '#673ab7', // Purple
  hydro: '#03a9f4', // Light Blue
  imports: '#9e9e9e', // Grey
  other: '#bdbdbd', // Light Grey
  wind: '#4db6ac', // Teal
  solar: '#ffeb3b', // Bright Yellow
};

const GenerationMixChart = ({ generationMixData, regionName }) => {
  if (!generationMixData || generationMixData.length === 0) {
    return (
      <div className="chart-loading">
        <p>Loading Generation Mix...</p>
      </div>
    );
  }

  // Sort the data so renewables are grouped and the chart is stable
  const sortedMix = [...generationMixData].sort((a, b) => b.perc - a.perc);

  const chartData = {
    labels: sortedMix.map(fuel => `${fuel.fuel.charAt(0).toUpperCase() + fuel.fuel.slice(1)} (${fuel.perc}%)`),
    datasets: [
      {
        label: 'Generation Mix',
        data: sortedMix.map(fuel => fuel.perc),
        backgroundColor: sortedMix.map(fuel => FUEL_COLORS[fuel.fuel] || '#e0e0e0'),
        borderColor: '#282c34', // Matches the app background
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#f0f0f0',
          boxWidth: 20,
          padding: 15,
        },
      },
      title: {
        display: true,
        text: `Current ${regionName} Generation Mix`,
        color: '#f0f0f0',
        font: {
            size: 18
        }
      },
      tooltip: {
        callbacks: {
            label: function(context) {
                // The default label is already good, just showing how to customize
                return context.label;
            }
        }
      }
    },
  };

  return (
    <div style={{ height: '350px', position: 'relative' }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
};

export default GenerationMixChart;