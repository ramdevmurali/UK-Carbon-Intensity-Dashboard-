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
  
  // Smart Recommender state
  const [applianceRecommendations, setApplianceRecommendations] = useState([]);
  
  // State for chart highlighting
  const [selectedWindow, setSelectedWindow] = useState(null);


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

  const fetchRecommendations = useCallback(async (region) => {
    setIsLoadingRecommendations(true);
    setApplianceRecommendations([]);
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
      setApplianceRecommendations([]); 
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, []);

  // --- SIDE EFFECTS (useEffect) ---
  useEffect(() => {
    const initialLoad = async () => {
      try {
        const regionsResponse = await fetch(`${API_BASE_URL}/api/v1/regions`);
        if (!regionsResponse.ok) throw new Error('Could not fetch regions');
        const regionsData = await regionsResponse.json();
        setRegions(['National', ...regionsData.regions]);
      } catch (err) {
        setError('Could not fetch available regions.');
      }

      const { currentData, forecastArr, generationMix, error: initialError } = await fetchData('National');
      setIntensityData(currentData);
      setForecastData(forecastArr);
      setNationalGenerationMix(generationMix);
      setError(initialError || '');
      
      fetchRecommendations('National');
    };

    initialLoad();

    const intervalId = setInterval(async () => {
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
      fetchRecommendations(selectedRegion);
    }, 1800000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally run only once on mount

  useEffect(() => {
    const updateOnRegionChange = async () => {
      // Clear any selected window when the region changes
      setSelectedWindow(null); 
      
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
      fetchRecommendations(selectedRegion);
    };

    updateOnRegionChange();
  }, [selectedRegion, fetchData, fetchRecommendations]);

  // --- DERIVED DATA ---
  const displayIntensityData = selectedRegion === 'National' ? intensityData : regionalIntensityData;
  const displayForecastData = selectedRegion === 'National' ? forecastData : regionalForecastData; // THE FIX IS HERE
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
      applianceRecommendations,
      selectedWindow,
    },
    state: {
      isLoadingRecommendations,
      isLoadingRegionData,
      error,
      regionError,
    },
    actions: {
      setSelectedRegion,
      setSelectedWindow,
    }
  };
};