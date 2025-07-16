// frontend/src/components/SmartRecommendations.js

import React from 'react';
import styles from './SmartRecommendations.module.css'; // 1. Import the CSS module

// --- Helper Functions ---
const formatTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString(navigator.language, {
    hour: 'numeric',
    minute: '2-digit',
  });
};

// --- Sub-component for a single card ---
const RecommendationCard = ({ recommendation }) => {
  const { appliance, window } = recommendation;
  // 2. Use the imported styles object
  return (
    <div className={styles.recommendationCard}>
      <div className={styles.cardHeader}>
        <h3>{appliance.name}</h3>
      </div>
      <div className={styles.cardBody}>
        <p>{appliance.reason}</p>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Best Time:</span>
          <span className={styles.infoValue}>
            {formatTime(window.startTime)} - {formatTime(window.endTime)}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Window Duration:</span>
          <span className={styles.infoValue}>{window.durationMinutes} mins</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Avg. Intensity:</span>
          <span className={`${styles.infoValue} ${styles.intensityValue}`}>
            {window.averageIntensity} gCO₂/kWh
          </span>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
const SmartRecommendations = ({ recommendations, isLoading }) => {
  const renderContent = () => {
    if (isLoading) {
      return <div className={styles.loadingMessage}>Finding best times for your appliances...</div>;
    }

    if (!recommendations || recommendations.length === 0) {
      return (
        <div className={styles.noResultsMessage}>
          No optimal energy windows found in the next 48 hours. Check back later!
        </div>
      );
    }

    return (
      <div className={styles.recommenderGrid}>
        {recommendations.map((rec, index) => (
          <RecommendationCard key={index} recommendation={rec} />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.recommenderContainer}>
      <header className={styles.recommenderHeader}>
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z"/>
          <path d="M12.99 7.404c.338.253.622.568.854.924a.5.5 0 0 0 .832-.546A5.022 5.022 0 0 0 13.045 6.3a.5.5 0 0 0-.588.79zM15 8a.5.5 0 0 0-.832-.361c-.23.356-.514.671-.854.924a.5.5 0 0 0 .588.79 4.022 4.022 0 0 1 1.098-1.353zM10.37 5.14c.48.243.91.564 1.28.945a.5.5 0 0 0 .71-.707 5.002 5.002 0 0 0-1.688-1.21.5.5 0 0 0-.404.872zM12.127 3.56a.5.5 0 0 0 .404-.872A6.002 6.002 0 0 0 9.29 1.628a.5.5 0 0 0 .51.864 5 5 0 0 1 2.326 1.068z"/>
          <path fillRule="evenodd" d="M8 16a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM4.053 6.3a.5.5 0 0 0 .588-.79A5.022 5.022 0 0 1 6.007 4.58a.5.5 0 0 0 .404-.872 6.002 6.002 0 0 0-3.23 2.518.5.5 0 0 0 .872.404zm-1.01-1.422a.5.5 0 0 0-.832.546A5.022 5.022 0 0 1 3.045 9.7a.5.5 0 0 0 .588-.79 4.022 4.022 0 0 0-1.1-1.353A.5.5 0 0 0 1 8c0 .927.323 1.79.873 2.473a.5.5 0 0 0 .832-.546A4.022 4.022 0 0 1 1.607 8.58a.5.5 0 0 0-.404-.872 5 5 0 0 0 2.858-4.224.5.5 0 0 0-.51-.864 6 6 0 0 1-2.43 5.243z"/>
        </svg>
        <h2>Smart Recommendations</h2>
      </header>
      {renderContent()}
    </div>
  );
};

export default SmartRecommendations;