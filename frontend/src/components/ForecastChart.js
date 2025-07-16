// frontend/src/components/ForecastChart.js

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';

// --- Chart.js Plugin for highlighting the selected window ---
const selectionHighlighter = {
  id: 'selectionHighlighter',
  beforeDraw: (chart, args, options) => {
    const { highlightStartIndex, highlightEndIndex } = options;

    if (highlightStartIndex === null || highlightEndIndex === null) {
      return;
    }

    const { ctx, chartArea: { top, bottom }, scales: { x, y } } = chart;
    ctx.save();

    const startX = x.getPixelForValue(highlightStartIndex);
    const endX = x.getPixelForValue(highlightEndIndex);
    
    ctx.fillStyle = 'rgba(99, 179, 237, 0.2)'; // A semi-transparent blue
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.6)';
    ctx.lineWidth = 1;

    ctx.fillRect(startX, top, endX - startX, bottom - top);
    ctx.strokeRect(startX, top, endX - startX, bottom - top);

    ctx.restore();
  }
};


const ForecastChart = ({ forecastData, currentRegionName, selectedWindow }) => {
  
  // Helper to check if two dates are the same day
  const isSameDay = (d1, d2) => 
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const { highlightStartIndex, highlightEndIndex } = useMemo(() => {
    if (!selectedWindow || !forecastData.length) {
      return { highlightStartIndex: null, highlightEndIndex: null };
    }

    const startIndex = forecastData.findIndex(
      d => new Date(d.from).getTime() === new Date(selectedWindow.startTime).getTime()
    );
    const endIndex = forecastData.findIndex(
      d => new Date(d.to).getTime() === new Date(selectedWindow.endTime).getTime()
    );

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

  const chartData = {
    labels: forecastData.map(d => new Date(d.from)), // Store Date objects for dynamic formatting
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
      legend: { 
        position: 'bottom', // Changed from 'top' to 'bottom'
        labels: { color: '#f0f0f0' } 
      },
      title: { display: true, text: `${currentRegionName} 48-Hour Carbon Intensity Forecast`, color: '#f0f0f0', font: {size: 16} },
      selectionHighlighter: {
        highlightStartIndex,
        highlightEndIndex
      }
    },
    scales: {
      y: { beginAtZero: false, ticks: { color: '#a9a9a9' }, grid: { color: 'rgba(240, 240, 240, 0.1)' } },
      x: {
        ticks: {
          color: '#a9a9a9',
          maxRotation: 0,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 20,
          callback: function(val, index) {
            const currentTickDate = this.getLabelForValue(val); // This is a Date object
            const currentTime = currentTickDate.toLocaleTimeString(navigator.language, { hour: '2-digit', minute: '2-digit' });

            let dateLabel = '';
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            
            if (index === 0) {
              if (isSameDay(currentTickDate, today)) {
                dateLabel = 'Today';
              } else if (isSameDay(currentTickDate, tomorrow)) {
                dateLabel = 'Tomorrow';
              } else {
                dateLabel = currentTickDate.toLocaleDateString(navigator.language, { weekday: 'short', day: 'numeric' });
              }
            } else {
              const prevTickDate = this.getLabelForValue(val - 1); 
              if (prevTickDate && !isSameDay(currentTickDate, prevTickDate)) {
                if (isSameDay(currentTickDate, today)) {
                  dateLabel = 'Today';
                } else if (isSameDay(currentTickDate, tomorrow)) {
                  dateLabel = 'Tomorrow';
                } else {
                  dateLabel = currentTickDate.toLocaleDateString(navigator.language, { weekday: 'short', day: 'numeric' });
                }
              }
            }
            
            return dateLabel ? [currentTime, dateLabel] : currentTime;
          }
        },
        grid: { color: 'rgba(240, 240, 240, 0.05)' }
      }
    },
  };

  return (
    <div style={{ height: '400px' }}>
      <Line options={options} data={chartData} plugins={[selectionHighlighter]} />
    </div>
  );
};

export default ForecastChart;