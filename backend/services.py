# backend/services.py (Final, Architecturally Correct Version)

import requests
from fastapi import HTTPException
from datetime import datetime, timezone, timedelta
import logging
import pandas as pd
import numpy as np
import pickle
from pathlib import Path

# --- Constants, Model Loading ---
API_BASE_URL = "https://api.carbonintensity.org.uk"
CANONICAL_REGION_SHORTNAMES = sorted([
    "East England", "East Midlands", "London", "North East England",
    "North Scotland", "North West England", "South East England",
    "South Scotland", "South Wales", "South West England", "West Midlands", "Yorkshire"
])
logger = logging.getLogger(__name__)

try:
    BASE_DIR = Path(__file__).resolve().parent
    MODELS_PATH = BASE_DIR / 'models'
    
    logger.info(f"Loading ML artifacts from: {MODELS_PATH}")
    model = pickle.load(open(MODELS_PATH / 'window_cluster_model.pkl', 'rb'))
    scaler = pickle.load(open(MODELS_PATH / 'window_scaler.pkl', 'rb'))
    cluster_map = pickle.load(open(MODELS_PATH / 'cluster_to_appliance_map.pkl', 'rb'))
    
    ML_ARTIFACTS_LOADED = True
    logger.info("Machine learning artifacts loaded successfully.")
except Exception as e:
    logger.error(f"FATAL: An unexpected error occurred loading ML artifacts: {e}", exc_info=True)
    ML_ARTIFACTS_LOADED = False

# --- Core Data Access (Shared & Robust) ---
def fetch_from_api(url: str):
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json() if response.text != 'null' else {}
    except requests.exceptions.RequestException as e:
        logger.error(f"External API request error for {url}: {e}")
        raise HTTPException(status_code=503, detail="Error communicating with the Carbon Intensity API.")

def get_national_forecast_48h():
    """Service to get the 48-hour national forecast. (RESTORED)"""
    now_utc = datetime.now(timezone.utc)
    from_iso = now_utc.isoformat().replace('+00:00', 'Z')
    data = fetch_from_api(f"{API_BASE_URL}/intensity/{from_iso}/fw48h")
    return data.get('data', [])

def get_regional_forecast_48h(region_shortname: str):
    """Service to get the 48-hour forecast for a specific region. (RESTORED and FIXED)"""
    now_utc = datetime.now(timezone.utc)
    minutes_past_half_hour = now_utc.minute % 30
    start_time = now_utc - timedelta(minutes=minutes_past_half_hour, seconds=now_utc.second, microseconds=now_utc.microsecond)
    end_time = start_time + timedelta(hours=48)
    
    from_iso = start_time.isoformat().replace('+00:00', 'Z')
    to_iso = end_time.isoformat().replace('+00:00', 'Z')
    
    url = f"{API_BASE_URL}/regional/intensity/{from_iso}/{to_iso}"
    api_response = fetch_from_api(url)

    if not api_response or 'data' not in api_response:
        raise HTTPException(status_code=404, detail="No forecast data received from the external API for any region.")

    forecast_periods_for_target_region = []
    for period_data in api_response['data']:
        if 'regions' in period_data:
            for region_entry in period_data['regions']:
                # *** THIS IS THE CRITICAL BUG FIX APPLIED TO THE SHARED FUNCTION ***
                current_shortname = region_entry.get('shortname')
                if current_shortname and current_shortname.lower() == region_shortname.lower():
                    forecast_periods_for_target_region.append({
                        "from": period_data['from'], "to": period_data['to'],
                        "intensity": region_entry['intensity'],
                        "generationmix": region_entry.get('generationmix', []),
                        "region_name": region_entry.get('shortname')
                    })
    
    if not forecast_periods_for_target_region:
        raise HTTPException(status_code=404, detail=f"No forecast data available for region '{region_shortname}'.")

    return {"region_name": region_shortname, "data": forecast_periods_for_target_region}


# --- Smart Recommender Service (Correctly using shared helpers) ---
def get_appliance_recommendations(region_shortname: str | None = None):
    if not ML_ARTIFACTS_LOADED:
        raise HTTPException(status_code=500, detail="Recommendation engine is offline: ML artifacts not loaded.")

    try:
        # Step 1: Fetch Data using the restored, robust helper functions
        if region_shortname:
            # The .get('data', []) handles cases where the region might not be found
            forecast_data = get_regional_forecast_48h(region_shortname).get('data', [])
        else:
            forecast_data = get_national_forecast_48h()

        # Step 2: Unified Processing Pipeline (from here on, the code is safe)
        if not forecast_data or len(forecast_data) < 2:
            return []

        df = pd.DataFrame(forecast_data)
        
        def safe_get_forecast(x):
            return x.get('forecast') if isinstance(x, dict) else None

        df['intensity'] = df['intensity'].apply(safe_get_forecast)
        df.dropna(subset=['intensity'], inplace=True)
        if df.empty: return []
        df['intensity'] = df['intensity'].astype(int)

        mean_intensity = df['intensity'].mean()
        df['is_low'] = df['intensity'] < mean_intensity
        df['window_id'] = (df['is_low'] != df['is_low'].shift()).cumsum()
        low_carbon_windows = df[df['is_low']]
        if low_carbon_windows.empty: return []

        window_features = []
        for _, group in low_carbon_windows.groupby('window_id'):
            window_features.append({
                'duration': len(group) * 30,
                'depth': (mean_intensity - group['intensity'].mean()) / mean_intensity if mean_intensity > 0 else 0,
                'stability': group['intensity'].std(ddof=0),
                'start_time': group['from'].iloc[0], 'end_time': group['to'].iloc[-1],
                'avg_intensity': round(group['intensity'].mean(), 2)
            })
        
        if not window_features: return []
        features_df = pd.DataFrame(window_features)
        
        features_df.replace([np.inf, -np.inf], np.nan, inplace=True)
        features_df.dropna(subset=['duration', 'depth', 'stability'], inplace=True)
        if features_df.empty: return []

        features_to_scale = features_df[['duration', 'depth', 'stability']]
        scaled_features = scaler.transform(features_to_scale)
        predictions = model.predict(scaled_features)
        features_df['cluster_id'] = predictions

        recommendations = []
        for _, row in features_df.iterrows():
            appliance_profile = cluster_map.get(row['cluster_id'])
            if appliance_profile:
                recommendations.append({
                    "appliance": appliance_profile,
                    "window": { "startTime": row['start_time'], "endTime": row['end_time'], "durationMinutes": int(row['duration']), "averageIntensity": row['avg_intensity'] },
                    "cluster_id": int(row['cluster_id'])
                })
        
        recommendations.sort(key=lambda x: x['window']['startTime'])
        return recommendations

    except Exception as e:
        logger.error(f"--- RECOMMENDATION ENGINE CRASH ---", exc_info=True)
        raise HTTPException(status_code=500, detail="A critical internal error occurred in the recommendation engine.")

# --- Other service functions that depend on the helpers being present ---
def get_national_current_intensity():
    data = fetch_from_api(f"{API_BASE_URL}/intensity")
    return data.get('data', [{}])[0]

def get_national_current_generation():
    data = fetch_from_api(f"{API_BASE_URL}/generation")
    return data.get('data', {})