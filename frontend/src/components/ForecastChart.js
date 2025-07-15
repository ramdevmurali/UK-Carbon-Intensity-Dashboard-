// frontend/src/components/ForecastChart.js

import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';

// Note: ChartJS is already registered in App.js, so we don't need to do it again here.
// We only need the specific chart elements we're using.

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

  if (!forecastData || forecastData.length === 0) {
    return (
      <div className="chart-loading">
        <p>Loading forecast chart...</p>
      </div>
    );
  }

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

export default ForecastChart;