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
  
  // Optimizer state
  const [bestTime, setBestTime] = useState(null);
  const [selectedAppliance, setSelectedAppliance] = useState(null);

  // Loading and Error states
  const [isLoadingBestTime, setIsLoadingBestTime] = useState(false);
  const [isLoadingRegionData, setIsLoadingRegionData] = useState(false);
  const [error, setError] = useState('');
  const [regionError, setRegionError] = useState('');

  // --- DATA FETCHING ---
  const fetchData = useCallback(async (regionToFetch = 'National') => {
    // This function is now internal to the hook
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
      setIsLoadingRegionData(false); // Ensure loader is turned off on error
      return { currentData: null, forecastArr: [], generationMix: null, error: currentError };
    }
  }, []);

  // --- SIDE EFFECTS (useEffect) ---
  useEffect(() => {
    // Effect for initial load and periodic refresh
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
    }, 180000);

    return () => clearInterval(intervalId);
  }, [fetchData, selectedRegion]); // This dependency array is correct

  useEffect(() => {
    // Effect for handling region changes
    if (selectedRegion === 'National') {
      setRegionalIntensityData(null); 
      setRegionalForecastData([]);
      setRegionalGenerationMix(null);
      setRegionError('');
      setBestTime(null);
    } else {
      const updateOnRegionChange = async () => {
        setBestTime(null);
        const { currentData, forecastArr, generationMix, error: regionalFetchError } = await fetchData(selectedRegion);
        setRegionalIntensityData(currentData);
        setRegionalForecastData(forecastArr.data || []);
        setRegionalGenerationMix(generationMix);
        setRegionError(regionalFetchError || '');
      };
      updateOnRegionChange();
    }
  }, [selectedRegion, fetchData]);

  // --- ACTIONS (Functions to be called from the UI) ---
  const handlePresetClick = async (appliance) => {
    setSelectedAppliance(appliance);
    setIsLoadingBestTime(true);
    setBestTime(null);
    try {
      const params = new URLSearchParams();
      params.append('duration_minutes', appliance.duration.toString());
      params.append('power_kw', appliance.power_kw.toString());
      if (selectedRegion !== 'National') {
        params.append('region_shortname', selectedRegion);
      }
      const optimizerUrl = `${API_BASE_URL}/api/v1/optimizer/best-time?${params.toString()}`;
      const response = await fetch(optimizerUrl);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'An unexpected error occurred.');
      }
      const data = await response.json();
      setBestTime(data);
    } catch (err) {
      setBestTime({ error: err.message });
    }
    setIsLoadingBestTime(false);
  };
  
  // --- DERIVED DATA ---
  const displayIntensityData = selectedRegion === 'National' ? intensityData : regionalIntensityData;
  const displayForecastData = selectedRegion === 'National' ? forecastData : regionalForecastData;
  const displayGenerationMix = selectedRegion === 'National' ? nationalGenerationMix : regionalGenerationMix;
  const displayRegionName = selectedRegion === 'National' ? 'UK' : selectedRegion;

  // --- RETURNED VALUES ---
  // We return everything the UI needs in organized objects
  return {
    data: {
      regions,
      selectedRegion,
      displayIntensityData,
      displayForecastData,
      displayGenerationMix,
      displayRegionName,
      bestTime,
      selectedAppliance,
    },
    state: {
      isLoadingBestTime,
      isLoadingRegionData,
      error,
      regionError,
    },
    actions: {
      setSelectedRegion,
      handlePresetClick,
    }
  };
};