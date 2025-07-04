# backend/main.py

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_BASE_URL = "https://api.carbonintensity.org.uk"
app = FastAPI(
    title="UK Carbon Intensity API",
    description="A proxy API for the UK National Grid Carbon Intensity data.",
    version="2.5.0", # The "Dropdown Ready Backend" version
)
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- Canonical List of Region Shortnames (for the dropdown) ---
# This list is based on common regions found in the Carbon Intensity API documentation.
# We'll use this to populate the frontend dropdown.
CANONICAL_REGION_SHORTNAMES = sorted([
    "East England",
    "East Midlands",
    "London",
    "North East England",
    "North Scotland",
    "North West England",
    "South East England",
    "South Scotland",
    "South Wales",
    "South Western England",
    "West Midlands",
    "Yorkshire"
    # Note: Some regions might appear differently or combine in the API responses,
    # but these are generally recognized 'shortnames'. We'll stick to ones
    # that appear in the API's 'shortname' field from successful queries.
])


# --- Helper Functions (Identical to previous working version) ---
def fetch_from_api(url: str):
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


# Removed sanitize_postcode as we are not using postcodes for direct lookup anymore.
# If we reintroduce a DB for postcode mapping later, this would be relevant again.


# --- MODIFIED get_regional_forecast function ---
# Now explicitly requires region_shortname, no more postcode resolution here.
def get_regional_forecast(region_shortname: str):
    
    # Calculate time boundaries (identical to previous working version)
    now_utc = datetime.now(timezone.utc)
    minutes_past_half_hour = now_utc.minute % 30
    start_time = now_utc - timedelta(minutes=minutes_past_half_hour,
                                     seconds=now_utc.second,
                                     microseconds=now_utc.microsecond)
    end_time = start_time + timedelta(hours=48)
    
    from_iso = start_time.isoformat().replace('+00:00', 'Z')
    to_iso = end_time.isoformat().replace('+00:00', 'Z')
    
    all_regions_forecast_url = f"{API_BASE_URL}/regional/intensity/{from_iso}/{to_iso}"
    api_response = fetch_from_api(all_regions_forecast_url)

    if not api_response or 'data' not in api_response:
        logger.warning(f"No 'data' key or empty response from {all_regions_forecast_url}")
        raise HTTPException(status_code=404, detail="No forecast data received from the external API for any region.")

    forecast_periods_for_target_region = []
    
    for period_data in api_response['data']:
        if 'regions' in period_data:
            for region_entry in period_data['regions']:
                if region_entry.get('shortname').lower() == region_shortname.lower():
                    if 'intensity' in region_entry and 'from' in period_data and 'to' in period_data:
                        forecast_periods_for_target_region.append({
                            "from": period_data['from'],
                            "to": period_data['to'],
                            "intensity": region_entry['intensity'],
                            "generationmix": region_entry.get('generationmix', []),
                            "region_name": region_entry.get('shortname')
                        })
    
    if not forecast_periods_for_target_region:
        logger.warning(f"No forecast periods found for target region '{region_shortname}' after filtering.")
        raise HTTPException(status_code=404, detail=f"No forecast data available for region '{region_shortname}' in the given timeframe. Check region name and API data availability.")

    return {
        "region_name": region_shortname,
        "data": forecast_periods_for_target_region
    }


# --- API Endpoints ---
@app.get("/")
def read_root(): return {"status": "ok", "message": "API is stable and correct."}

# --- NEW ENDPOINT: Provide list of regions for frontend dropdown ---
@app.get("/api/v1/regions")
def get_available_regions():
    """Returns a list of canonical region shortnames for the frontend dropdown."""
    return {"regions": CANONICAL_REGION_SHORTNAMES}

@app.get("/api/v1/intensity/current")
def get_current_intensity():
    # This endpoint remains national as default.
    data = fetch_from_api(f"{API_BASE_URL}/intensity")
    return data.get('data', [{}])[0]

@app.get("/api/v1/intensity/forecast/48h")
def get_48h_forecast():
    # This endpoint remains national as default.
    now_utc = datetime.now(timezone.utc)
    from_iso = now_utc.isoformat().replace('+00:00', 'Z')
    data = fetch_from_api(f"{API_BASE_URL}/intensity/{from_iso}/fw48h")
    return data.get('data', [])

# --- MODIFIED REGIONAL ENDPOINTS TO ACCEPT REGION_SHORTNAME DIRECTLY ---
@app.get("/api/v1/intensity/regional/current/{region_shortname}")
def get_current_regional_intensity_by_name(region_shortname: str):
    regional_forecast_container = get_regional_forecast(region_shortname=region_shortname) 
    
    intensity_periods = regional_forecast_container.get('data', [])
    
    if not intensity_periods:
        raise HTTPException(status_code=404, detail=f"No current intensity data found for region '{region_shortname}'. This might be due to API data latency for regional data.")
    
    first_period = intensity_periods[0]
    
    return {
        "region_name": regional_forecast_container.get('region_name'),
        "from": first_period.get('from'),
        "to": first_period.get('to'),
        "intensity": first_period.get('intensity'),
        "generationmix": first_period.get('generationmix'),
    }


@app.get("/api/v1/intensity/regional/forecast/48h/{region_shortname}")
def get_regional_48h_forecast_endpoint_by_name(region_shortname: str):
    return get_regional_forecast(region_shortname=region_shortname)


# --- MODIFIED OPTIMIZER ENDPOINT TO ACCEPT REGION_SHORTNAME ---
@app.get("/api/v1/optimizer/best-time")
def find_best_time_with_savings(
    duration_minutes: int = Query(..., gt=0),
    power_kw: float = Query(..., gt=0),
    region_shortname: str | None = None # Now accepts region_shortname directly
):
    forecast_periods = []
    if region_shortname:
        regional_forecast_container = get_regional_forecast(region_shortname=region_shortname)
        forecast_periods = regional_forecast_container.get('data', [])
    else:
        forecast_periods = get_48h_forecast() # Falls back to national
    
    if not forecast_periods:
        raise HTTPException(status_code=503, detail="Could not retrieve forecast data to analyze.")

    num_blocks = (duration_minutes + 29) // 30
    if num_blocks > len(forecast_periods):
        raise HTTPException(status_code=400, detail=f"Duration ({duration_minutes} mins) is too long for the {len(forecast_periods)*30} min forecast window.")

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
    else:
        raise HTTPException(status_code=500, detail="Could not determine the best time.")