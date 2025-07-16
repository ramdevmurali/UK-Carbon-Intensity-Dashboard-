// frontend/src/components/ForecastChart.js

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';

// --- NEW: Chart.js Plugin for highlighting the selected window ---
// This plugin will draw a shaded rectangle on the chart background.
const selectionHighlighter = {
  id: 'selectionHighlighter',
  // We draw 'before' the datasets so the highlight is behind the line
  beforeDraw: (chart, args, options) => {
    const { highlightStartIndex, highlightEndIndex } = options;

    // If no window is selected, do nothing
    if (highlightStartIndex === null || highlightEndIndex === null) {
      return;
    }

    const { ctx, chartArea: { top, bottom }, scales: { x, y } } = chart;
    ctx.save();

    // Get the pixel coordinates for the start and end of the selection
    const startX = x.getPixelForValue(highlightStartIndex);
    const endX = x.getPixelForValue(highlightEndIndex);
    
    // Set the style for the highlight rectangle
    ctx.fillStyle = 'rgba(99, 179, 237, 0.2)'; // A semi-transparent blue
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.6)';
    ctx.lineWidth = 1;

    // Draw the rectangle
    ctx.fillRect(startX, top, endX - startX, bottom - top);
    ctx.strokeRect(startX, top, endX - startX, bottom - top);

    ctx.restore();
  }
};


const ForecastChart = ({ forecastData, currentRegionName, selectedWindow }) => {
  
  // 1. COMPLETELY REPLACED LOGIC
  // This memo now finds the start and end indices of the *selectedWindow*.
  const { highlightStartIndex, highlightEndIndex } = useMemo(() => {
    // If no window is selected or no data, return nulls
    if (!selectedWindow || !forecastData.length) {
      return { highlightStartIndex: null, highlightEndIndex: null };
    }

    // Find the array index that matches the start and end times of the selected window
    const startIndex = forecastData.findIndex(
      d => new Date(d.from).getTime() === new Date(selectedWindow.startTime).getTime()
    );
    const endIndex = forecastData.findIndex(
      d => new Date(d.to).getTime() === new Date(selectedWindow.endTime).getTime()
    );

    // If either isn't found, something is wrong, so don't highlight
    if (startIndex === -1 || endIndex === -1) {
      return { highlightStartIndex: null, highlightEndIndex: null };
    }

    return { highlightStartIndex: startIndex, highlightEndIndex: endIndex };
  }, [selectedWindow, forecastData]);


  if (!forecastData || forecastData.length === 0) {
    return (
      <div className="chart-loading">
        <p>Loading forecast chart...</p>
      </div>
    );
  }

  // 2. SIMPLIFIED DATA AND OPTIONS
  const chartData = {
    labels: forecastData.map(d => new Date(d.from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
    datasets: [{
      label: 'Carbon Intensity Forecast (gCO₂/kWh)',
      data: forecastData.map(d => d.intensity.forecast),
      tension: 0.4,
      borderColor: '#a0aec0', // A single neutral color for the line
      pointBackgroundColor: (context) => context.dataIndex === 0 ? '#ff9800' : '#a0aec0', // Highlight only the first point
      pointRadius: (context) => context.dataIndex === 0 ? 5 : 0, // Show only the first point
      pointHoverRadius: 5,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { position: 'top', labels: { color: '#f0f0f0' } },
      title: { display: true, text: `${currentRegionName} 48-Hour Carbon Intensity Forecast`, color: '#f0f0f0', font: {size: 16} },
      // 3. PASS THE HIGHLIGHT INDICES TO OUR CUSTOM PLUGIN
      selectionHighlighter: {
        highlightStartIndex,
        highlightEndIndex
      }
    },
    scales: {
      y: { beginAtZero: false, ticks: { color: '#a9a9a9' }, grid: { color: 'rgba(240, 240, 240, 0.1)' } },
      x: { ticks: { color: '#a9a9a9', maxRotation: 0, minRotation: 0, autoSkip: true, maxTicksLimit: 20 }, grid: { color: 'rgba(240, 240, 240, 0.05)' } }
    },
  };

  // 4. PASS THE PLUGIN TO THE CHART COMPONENT
  return (
    <div style={{ height: '400px' }}>
      <Line options={options} data={chartData} plugins={[selectionHighlighter]} />
    </div>
  );
};

export default ForecastChart;