// frontend/src/hooks/useCarbonData.js

import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8001';

export const useCarbonData = () => {
  // --- STATE MANAGEMENT ---
  // National data
  const [intensityData, setIntensityData] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [nationalGenerationMix, setNationalGenerationMix] = useState(null);
  
  // Regional data
  const [regionalIntensityData, setRegionalIntensityData] = useState(null);
  const [regionalForecastData, setRegionalForecastData] = useState([]);
  const [regionalGenerationMix, setRegionalGenerationMix] = useState(null);
  
  // App state
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('National');
  
  // --- NEW: Smart Recommender state ---
  const [applianceRecommendations, setApplianceRecommendations] = useState([]);

  // Loading and Error states
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isLoadingRegionData, setIsLoadingRegionData] = useState(false);
  const [error, setError] = useState('');
  const [regionError, setRegionError] = useState('');

  // --- DATA FETCHING ---
  const fetchData = useCallback(async (regionToFetch = 'National') => {
    // This function fetches the main dashboard data (current, forecast, mix)
    let currentData, forecastArr, generationMix = null, currentError = '';

    try {
      if (regionToFetch === 'National') {
        const [currentRes, forecastRes, genMixRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/intensity/current`),
          fetch(`${API_BASE_URL}/api/v1/intensity/forecast/48h`),
          fetch(`${API_BASE_URL}/api/v1/generation/current`)
        ]);

        if (!currentRes.ok || !forecastRes.ok || !genMixRes.ok) {
          throw new Error('Network response for national data was not ok');
        }
        currentData = await currentRes.json();
        forecastArr = await forecastRes.json();
        const genMixData = await genMixRes.json();
        generationMix = genMixData.generationmix;
      } else {
        setIsLoadingRegionData(true);
        const [currentRegionalResponse, forecastRegionalResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/intensity/regional/current/${encodeURIComponent(regionToFetch)}`),
          fetch(`${API_BASE_URL}/api/v1/intensity/regional/forecast/48h/${encodeURIComponent(regionToFetch)}`)
        ]);

        if (!currentRegionalResponse.ok || !forecastRegionalResponse.ok) {
          throw new Error(`Could not fetch data for ${regionToFetch}.`);
        }
        currentData = await currentRegionalResponse.json();
        forecastArr = await forecastRegionalResponse.json();
        generationMix = currentData.generationmix; 
        setIsLoadingRegionData(false);
      }
      return { currentData, forecastArr, generationMix, error: null };
    } catch (err) {
      currentError = err.message || 'An unexpected error occurred during data fetch.';
      console.error(`Failed to fetch data for ${regionToFetch}:`, err);
      setIsLoadingRegionData(false);
      return { currentData: null, forecastArr: [], generationMix: null, error: currentError };
    }
  }, []);

  // --- NEW: Function to fetch recommendations ---
  const fetchRecommendations = useCallback(async (region) => {
    setIsLoadingRecommendations(true);
    setApplianceRecommendations([]); // Clear old recommendations on new fetch
    try {
      const params = new URLSearchParams();
      if (region && region !== 'National') {
        params.append('region_shortname', region);
      }
      const url = `${API_BASE_URL}/api/v1/optimizer/appliance-recommendations?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch smart recommendations.');
      }
      const data = await response.json();
      setApplianceRecommendations(data);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      // Can set a specific recommendation error state if needed in the future
      setApplianceRecommendations([]); 
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, []); // This useCallback has no dependencies as it's self-contained

  // --- SIDE EFFECTS (useEffect) ---
  useEffect(() => {
    // Effect for initial load and periodic refresh
    const initialLoad = async () => {
      // Fetch regions list first
      try {
        const regionsResponse = await fetch(`${API_BASE_URL}/api/v1/regions`);
        if (!regionsResponse.ok) throw new Error('Could not fetch regions');
        const regionsData = await regionsResponse.json();
        setRegions(['National', ...regionsData.regions]);
      } catch (err) {
        setError('Could not fetch available regions.');
      }

      // Fetch initial data for National view
      const { currentData, forecastArr, generationMix, error: initialError } = await fetchData('National');
      setIntensityData(currentData);
      setForecastData(forecastArr);
      setNationalGenerationMix(generationMix);
      setError(initialError || '');
      
      // Fetch initial recommendations for National view
      fetchRecommendations('National');
    };

    initialLoad();

    const intervalId = setInterval(async () => {
      // Periodic refresh of all data for the currently selected region
      const { currentData, forecastArr, generationMix, error: periodicError } = await fetchData(selectedRegion);
      if (selectedRegion === 'National') {
        setIntensityData(currentData);
        setForecastData(forecastArr);
        setNationalGenerationMix(generationMix);
        setError(periodicError || '');
      } else {
        setRegionalIntensityData(currentData);
        setRegionalForecastData(forecastArr.data || []);
        setRegionalGenerationMix(generationMix);
        setRegionError(periodicError || '');
      }
      // Also refresh recommendations periodically
      fetchRecommendations(selectedRegion);
    }, 1800000); // Refresh every 30 mins, as forecast data doesn't change more frequently

    return () => clearInterval(intervalId);
  }, []); // Only run once on mount

  useEffect(() => {
    // Effect for handling region changes by the user
    const updateOnRegionChange = async () => {
      // Fetch main data for the new region
      const { currentData, forecastArr, generationMix, error: regionalFetchError } = await fetchData(selectedRegion);
      if (selectedRegion === 'National') {
        setRegionalIntensityData(null);
        setRegionalForecastData([]);
        setRegionalGenerationMix(null);
        setRegionError('');
      } else {
        setRegionalIntensityData(currentData);
        setRegionalForecastData(forecastArr.data || []);
        setRegionalGenerationMix(generationMix);
        setRegionError(regionalFetchError || '');
      }
      // Always fetch new recommendations when the region changes
      fetchRecommendations(selectedRegion);
    };

    updateOnRegionChange();
  }, [selectedRegion, fetchData, fetchRecommendations]);

  // --- DERIVED DATA ---
  const displayIntensityData = selectedRegion === 'National' ? intensityData : regionalIntensityData;
  const displayForecastData = selectedRegion === 'National' ? forecastData : regionalForecastData;
  const displayGenerationMix = selectedRegion === 'National' ? nationalGenerationMix : regionalGenerationMix;
  const displayRegionName = selectedRegion === 'National' ? 'UK' : selectedRegion;

  // --- RETURNED VALUES ---
  return {
    data: {
      regions,
      selectedRegion,
      displayIntensityData,
      displayForecastData,
      displayGenerationMix,
      displayRegionName,
      applianceRecommendations, // NEW
    },
    state: {
      isLoadingRecommendations, // NEW
      isLoadingRegionData,
      error,
      regionError,
    },
    actions: {
      setSelectedRegion,
      // `handlePresetClick` is now removed
    }
  };
};