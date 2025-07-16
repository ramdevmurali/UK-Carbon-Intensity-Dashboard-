// frontend/src/components/SmartRecommendations.js

import React, { useState, useCallback, useEffect } from 'react';
import styles from './SmartRecommendations.module.css';
import { FaBolt, FaCogs, FaLeaf, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

// --- Helper Functions ---
// NEW: Comprehensive function to format the recommendation window times
const formatWindowTime = (startTimeIso, endTimeIso) => {
  const startDate = new Date(startTimeIso);
  const endDate = new Date(endTimeIso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const isSameDay = (d1, d2) => 
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  let startPrefix = '';
  if (isSameDay(startDate, today)) {
    startPrefix = 'Today ';
  } else if (isSameDay(startDate, tomorrow)) {
    startPrefix = 'Tomorrow ';
  } else {
    startPrefix = startDate.toLocaleDateString(navigator.language, { month: 'short', day: 'numeric' }) + ' ';
  }

  const startLocalTime = startDate.toLocaleTimeString(navigator.language, { hour: 'numeric', minute: '2-digit' });
  const endLocalTime = endDate.toLocaleTimeString(navigator.language, { hour: 'numeric', minute: '2-digit' });

  // If the window starts and ends on the same day
  if (isSameDay(startDate, endDate)) {
    return `${startPrefix}${startLocalTime} - ${endLocalTime}`;
  } else {
    // If the window crosses midnight
    let endPrefix = '';
    if (isSameDay(endDate, tomorrow)) {
      endPrefix = 'Tomorrow ';
    } else {
      endPrefix = endDate.toLocaleDateString(navigator.language, { month: 'short', day: 'numeric' }) + ' ';
    }
    return `${startPrefix}${startLocalTime} - ${endPrefix}${endLocalTime}`;
  }
};

const iconMap = {
  FaBolt: <FaBolt />,
  FaCogs: <FaCogs />,
  FaLeaf: <FaLeaf />,
  // Add fallback for any icons not explicitly mapped
  default: <FaLeaf />, 
};


// --- Sub-component for a single card ---
const RecommendationCard = ({ recommendation, onSelect, isActive }) => {
  const { appliance, window } = recommendation;
  
  const handleClick = () => {
    onSelect(window); 
  };

  const cardClassName = `${styles.recommendationCard} ${isActive ? styles.active : ''}`;
  
  const cardStyle = {
    borderLeft: `5px solid ${appliance.color || '#4a5568'}` // Use appliance color, with a fallback
  };

  return (
    <div className={cardClassName} onClick={handleClick} style={cardStyle}>
      <div className={styles.cardHeader}>
        <span className={styles.iconWrapper} style={{ color: appliance.color }}>
          {iconMap[appliance.icon] || iconMap.default} 
        </span>
        <h3>{appliance.name}</h3>
      </div>
      <div className={styles.cardBody}>
        <p>{appliance.reason}</p>
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Best Time:</span>
          {/* Use the new formatWindowTime helper */}
          <span className={styles.infoValue}>
            {formatWindowTime(window.startTime, window.endTime)}
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


// --- Main Component: Now a Carousel ---
const SmartRecommendations = ({ recommendations, isLoading, onWindowSelect, selectedWindow }) => {
  // New state to manage the currently displayed card index
  const [activeIndex, setActiveIndex] = useState(0);

  // Adjust activeIndex when recommendations change (e.g., region changes)
  useEffect(() => {
    if (recommendations.length > 0 && activeIndex >= recommendations.length) {
      setActiveIndex(0); // Reset if current index is out of bounds
    } else if (recommendations.length === 0) {
      setActiveIndex(0); // Reset if no recommendations
      onWindowSelect(null); // Clear highlight if no recs
    }
  }, [recommendations, activeIndex, onWindowSelect]);

  // Automatically highlight the chart when the active card changes
  useEffect(() => {
    if (recommendations.length > 0 && activeIndex < recommendations.length) {
      const currentRecommendation = recommendations[activeIndex];
      onWindowSelect(currentRecommendation.window);
    }
  }, [activeIndex, recommendations, onWindowSelect]);


  // Navigation Handlers
  const handlePrev = useCallback(() => {
    setActiveIndex((prevIndex) => 
      prevIndex === 0 ? recommendations.length - 1 : prevIndex - 1
    );
  }, [recommendations.length]);

  const handleNext = useCallback(() => {
    setActiveIndex((prevIndex) => 
      prevIndex === recommendations.length - 1 ? 0 : prevIndex + 1
    );
  }, [recommendations.length]);

  // Determine if navigation buttons should be shown
  const showNavigation = recommendations && recommendations.length > 1;

  // Render the content based on activeIndex
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

    const currentRec = recommendations[activeIndex];

    return (
      <div className={styles.carouselContainer}>
        {showNavigation && (
          <button className={styles.navButtonLeft} onClick={handlePrev}>
            <FaChevronLeft size={24} />
          </button>
        )}
        
        <div className={styles.carouselCardWrapper}> {/* Wrapper for individual card */}
            <RecommendationCard
            recommendation={currentRec}
            onSelect={onWindowSelect}
            isActive={selectedWindow && selectedWindow.startTime === currentRec.window.startTime}
            />
        </div>

        {showNavigation && (
          <button className={styles.navButtonRight} onClick={handleNext}>
            <FaChevronRight size={24} />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <header className={styles.recommenderHeader}>
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16"><path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z"/><path d="M12.99 7.404c.338.253.622.568.854.924a.5.5 0 0 0 .832-.546A5.022 5.022 0 0 0 13.045 6.3a.5.5 0 0 0-.588.79zM15 8a.5.5 0 0 0-.832-.361c-.23.356-.514.671-.854.924a.5.5 0 0 0 .588.79 4.022 4.022 0 0 1 1.098-1.353zM10.37 5.14c.48.243.91.564 1.28.945a.5.5 0 0 0 .71-.707 5.002 5.002 0 0 0-1.688-1.21.5.5 0 0 0-.404.872zM12.127 3.56a.5.5 0 0 0 .404-.872A6.002 6.002 0 0 0 9.29 1.628a.5.5 0 0 0 .51.864 5 5 0 0 1 2.326 1.068z"/><path fillRule="evenodd" d="M8 16a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM4.053 6.3a.5.5 0 0 0 .588-.79A5.022 5.022 0 0 1 6.007 4.58a.5.5 0 0 0 .404-.872 6.002 6.002 0 0 0-3.23 2.518.5.5 0 0 0 .872.404zm-1.01-1.422a.5.5 0 0 0-.832.546A5.022 5.022 0 0 1 3.045 9.7a.5.5 0 0 0 .588-.79 4.022 4.022 0 0 0-1.1-1.353A.5.5 0 0 0 1 8c0 .927.323 1.79.873 2.473a.5.5 0 0 0 .832-.546A4.022 4.022 0 0 1 1.607 8.58a.5.5 0 0 0-.404-.872 5 5 0 0 0 2.858-4.224.5.5 0 0 0-.51-.864 6 6 0 0 1-2.43 5.243z"/></svg>
        <h2>Smart Recommendations</h2>
      </header>
      {renderContent()}
    </>
  );
};

export default SmartRecommendations;