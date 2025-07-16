# backend/services.py

import requests
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
import logging
import pandas as pd
import numpy as np
import pickle
from pathlib import Path

# --- Constants and Configuration ---
API_BASE_URL = "https://api.carbonintensity.org.uk"
CANONICAL_REGION_SHORTNAMES = sorted([
    "East England", "East Midlands", "London", "North East England",
    "North Scotland", "North West England", "South East England",
    "South Scotland", "South Wales", "South West England", "West Midlands", "Yorkshire"
])
logger = logging.getLogger(__name__)

# --- NEW: Load ML Models and Artifacts ---
# This code runs once when the service starts up.
try:
    BASE_DIR = Path(__file__).resolve().parent
    MODELS_PATH = BASE_DIR / 'models'
    
    logger.info(f"Loading ML artifacts from: {MODELS_PATH}")
    model = pickle.load(open(MODELS_PATH / 'window_cluster_model.pkl', 'rb'))
    scaler = pickle.load(open(MODELS_PATH / 'window_scaler.pkl', 'rb'))
    cluster_map = pickle.load(open(MODELS_PATH / 'cluster_to_appliance_map.pkl', 'rb'))
    
    ML_ARTIFACTS_LOADED = True
    logger.info("Machine learning artifacts loaded successfully.")
except FileNotFoundError as e:
    logger.error(f"FATAL: Could not find ML artifact file: {e}. The /appliance-recommendations endpoint will be disabled.")
    ML_ARTIFACTS_LOADED = False
except Exception as e:
    logger.error(f"FATAL: An unexpected error occurred loading ML artifacts: {e}. The /appliance-recommendations endpoint will be disabled.")
    ML_ARTIFACTS_LOADED = False


# --- Data Access Function ---
def fetch_from_api(url: str):
    """Handles the actual HTTP request to the external API."""
    try:
        logger.info(f"Fetching data from external URL: {url}")
        response = requests.get(url)
        response.raise_for_status()
        if response.text == 'null':
            logger.warning(f"API returned 'null' for URL: {url}. Returning empty dictionary.")
            return {}
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Network error or HTTP status error for {url}: {e}")
        if hasattr(e, 'response') and e.response is not None:
             raise HTTPException(status_code=e.response.status_code, detail=f"External API Error for {url}: {e.response.text}")
        raise HTTPException(status_code=503, detail=f"Error communicating with external API for {url}: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred in fetch_from_api for {url}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected internal error occurred.")

# --- Business Logic / Service Functions ---

def get_national_current_intensity():
    """Service to get the current national intensity."""
    data = fetch_from_api(f"{API_BASE_URL}/intensity")
    return data.get('data', [{}])[0]

def get_national_current_generation():
    """Service to get the current national generation mix."""
    data = fetch_from_api(f"{API_BASE_URL}/generation")
    return data.get('data', {})

def get_national_forecast_48h():
    """Service to get the 48-hour national forecast."""
    now_utc = datetime.now(timezone.utc)
    from_iso = now_utc.isoformat().replace('+00:00', 'Z')
    data = fetch_from_api(f"{API_BASE_URL}/intensity/{from_iso}/fw48h")
    return data.get('data', [])

def get_regional_forecast_48h(region_shortname: str):
    """Service to get the 48-hour forecast for a specific region."""
    now_utc = datetime.now(timezone.utc)
    minutes_past_half_hour = now_utc.minute % 30
    start_time = now_utc - timedelta(minutes=minutes_past_half_hour, seconds=now_utc.second, microseconds=now_utc.microsecond)
    end_time = start_time + timedelta(hours=48)
    
    from_iso = start_time.isoformat().replace('+00:00', 'Z')
    to_iso = end_time.isoformat().replace('+00:00', 'Z')
    
    all_regions_forecast_url = f"{API_BASE_URL}/regional/intensity/{from_iso}/{to_iso}"
    api_response = fetch_from_api(all_regions_forecast_url)

    if not api_response or 'data' not in api_response:
        raise HTTPException(status_code=404, detail="No forecast data received from the external API for any region.")

    forecast_periods_for_target_region = []
    for period_data in api_response['data']:
        if 'regions' in period_data:
            for region_entry in period_data['regions']:
                if region_entry.get('shortname').lower() == region_shortname.lower():
                    forecast_periods_for_target_region.append({
                        "from": period_data['from'], "to": period_data['to'],
                        "intensity": region_entry['intensity'],
                        "generationmix": region_entry.get('generationmix', []),
                        "region_name": region_entry.get('shortname')
                    })
    
    if not forecast_periods_for_target_region:
        raise HTTPException(status_code=404, detail=f"No forecast data available for region '{region_shortname}'.")

    return {"region_name": region_shortname, "data": forecast_periods_for_target_region}


# --- NEW: Smart Recommender Service ---
def get_appliance_recommendations(region_shortname: str | None = None):
    """
    Analyzes the 48-hour forecast to find low-carbon windows and matches them to
    appliance profiles using a pre-trained K-Means clustering model.
    """
    # 1. Check if models were loaded correctly on startup
    if not ML_ARTIFACTS_LOADED:
        logger.error("Attempted to call get_appliance_recommendations, but ML artifacts are not loaded.")
        raise HTTPException(status_code=500, detail="The recommendation engine is currently unavailable due to a configuration error.")

    # 2. Fetch forecast data for the specified region or national
    logger.info(f"Generating recommendations for region: {'National' if not region_shortname else region_shortname}")
    if region_shortname:
        forecast_data = get_regional_forecast_48h(region_shortname).get('data', [])
    else:
        forecast_data = get_national_forecast_48h()

    if not forecast_data or len(forecast_data) < 2:
        logger.warning("Insufficient forecast data to generate recommendations.")
        return []

    # 3. Convert to DataFrame and identify low-carbon windows
    df = pd.DataFrame(forecast_data)
    df['intensity'] = df['intensity'].apply(lambda x: x['forecast'])
    mean_intensity = df['intensity'].mean()
    df['is_low'] = df['intensity'] < mean_intensity
    df['window_id'] = (df['is_low'] != df['is_low'].shift()).cumsum()
    low_carbon_windows = df[df['is_low']]

    if low_carbon_windows.empty:
        logger.info("No low-carbon windows found in the forecast.")
        return []

    # 4. Engineer features for each identified window
    window_features = []
    for _id, group in low_carbon_windows.groupby('window_id'):
        duration = len(group) * 30  # 30 minutes per period
        window_avg_intensity = group['intensity'].mean()
        # Depth is the % improvement over the 48h average
        depth = (mean_intensity - window_avg_intensity) / mean_intensity if mean_intensity > 0 else 0
        # Stability is the standard deviation of intensity during the window
        stability = group['intensity'].std() if len(group) > 1 else 0.0

        window_features.append({
            'duration': duration,
            'depth': depth,
            'stability': stability,
            'start_time': group['from'].iloc[0],
            'end_time': group['to'].iloc[-1],
            'avg_intensity': round(window_avg_intensity, 2)
        })
    
    if not window_features:
        return []

    features_df = pd.DataFrame(window_features)
    # Ensure column order matches what the model was trained on
    features_to_scale = features_df[['duration', 'depth', 'stability']]

    # 5. Scale features and predict cluster for each window
    scaled_features = scaler.transform(features_to_scale)
    predictions = model.predict(scaled_features)

    # 6. Map predictions to appliance profiles and format the output
    recommendations = []
    for i, window in enumerate(window_features):
        cluster_id = predictions[i]
        appliance_profile = cluster_map.get(cluster_id)
        if appliance_profile:
            recommendations.append({
                "appliance": appliance_profile,
                "window": {
                    "startTime": window['start_time'],
                    "endTime": window['end_time'],
                    "durationMinutes": int(window['duration']),
                    "averageIntensity": window['avg_intensity']
                },
                "cluster_id": int(cluster_id) # For debugging/dev
            })
    
    # Sort recommendations by their start time
    recommendations.sort(key=lambda x: x['window']['startTime'])
    logger.info(f"Generated {len(recommendations)} appliance recommendations.")
    return recommendations


# --- DEPRECATED (but kept for reference) ---
def find_best_time_logic(duration_minutes: int, power_kw: float, region_shortname: str | None = None):
    """Service that contains the optimization algorithm."""
    if region_shortname:
        forecast_container = get_regional_forecast_48h(region_shortname)
        forecast_periods = forecast_container.get('data', [])
    else:
        forecast_periods = get_national_forecast_48h()
    
    if not forecast_periods:
        raise HTTPException(status_code=503, detail="Could not retrieve forecast data to analyze.")

    num_blocks = (duration_minutes + 29) // 30
    if num_blocks > len(forecast_periods):
        raise HTTPException(status_code=400, detail=f"Duration is too long for the forecast window.")

    min_intensity_sum, max_intensity_sum, best_start_index = float('inf'), float('-inf'), -1
    for i in range(len(forecast_periods) - num_blocks + 1):
        current_window = forecast_periods[i : i + num_blocks]
        current_intensity_sum = sum(p['intensity']['forecast'] for p in current_window)
        if current_intensity_sum < min_intensity_sum:
            min_intensity_sum, best_start_index = current_intensity_sum, i
        if current_intensity_sum > max_intensity_sum:
            max_intensity_sum = current_intensity_sum

    if best_start_index != -1:
        avg_best_intensity = min_intensity_sum / num_blocks
        avg_worst_intensity = max_intensity_sum / num_blocks
        energy_kwh = power_kw * (duration_minutes / 60.0)
        saved_grams = (avg_worst_intensity * energy_kwh) - (avg_best_intensity * energy_kwh)
        best_period = forecast_periods[best_start_index]
        end_period = forecast_periods[best_start_index + num_blocks - 1]
        return { "start_time": best_period["from"], "end_time": end_period["to"], "saved_grams_co2": round(saved_grams) }
    
    raise HTTPException(status_code=500, detail="Could not determine the best time.")