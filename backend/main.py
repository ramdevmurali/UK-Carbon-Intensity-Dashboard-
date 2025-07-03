# backend/main.py

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

# --- Configuration ---
API_BASE_URL = "https://api.carbonintensity.org.uk"
app = FastAPI(
    title="UK Carbon Intensity API",
    description="A proxy API for the UK National Grid Carbon Intensity data.",
    version="1.0.0",
)
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- Helper Function for API Calls ---
def fetch_from_api(url: str):
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Error communicating with external API: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

# --- Existing API Endpoints ---
@app.get("/")
def read_root():
    return {"status": "ok", "message": "API is running"}

@app.get("/api/v1/intensity/current")
def get_current_intensity():
    data = fetch_from_api(f"{API_BASE_URL}/intensity")
    return data.get('data', [{}])[0]

@app.get("/api/v1/intensity/forecast/48h")
def get_48h_forecast():
    now_utc = datetime.now(timezone.utc)
    from_iso = now_utc.isoformat().replace('+00:00', 'Z')
    data = fetch_from_api(f"{API_BASE_URL}/intensity/{from_iso}/fw48h")
    return data.get('data', [])


# ===============================================================
# === UPGRADED FEATURE: OPTIMIZER WITH SAVINGS CALCULATION ===
# ===============================================================
@app.get("/api/v1/optimizer/best-time")
def find_best_time_with_savings(
    duration_minutes: int = Query(..., gt=0),
    power_kw: float = Query(..., gt=0)
):
    """
    Finds the optimal time window and calculates the potential carbon savings
    by comparing the best window to the worst window in the forecast.
    """
    forecast_data = get_48h_forecast()
    if not forecast_data:
        raise HTTPException(status_code=503, detail="Could not retrieve forecast data to analyze.")

    num_blocks = (duration_minutes + 29) // 30
    if num_blocks >= len(forecast_data):
        raise HTTPException(
            status_code=400,
            detail=f"Duration ({duration_minutes} mins) is too long for the forecast window."
        )

    # We now need to track the best AND worst windows
    min_intensity_sum = float('inf')
    max_intensity_sum = float('-inf')
    best_start_index = -1

    # Sliding window algorithm
    for i in range(len(forecast_data) - num_blocks + 1):
        current_window = forecast_data[i : i + num_blocks]
        current_intensity_sum = sum(period['intensity']['forecast'] for period in current_window)
        
        # Check for best window
        if current_intensity_sum < min_intensity_sum:
            min_intensity_sum = current_intensity_sum
            best_start_index = i
            
        # Check for worst window
        if current_intensity_sum > max_intensity_sum:
            max_intensity_sum = current_intensity_sum

    if best_start_index != -1:
        # The carbon intensity is in gCO2/kWh. Each block is 0.5 hours.
        # Energy (kWh) = Power (kW) * Time (h)
        # Carbon (g) = Energy (kWh) * Intensity (g/kWh)
        # So, for each 30-min block: g = kW * 0.5h * (g/kWh)
        
        # Calculate grams of CO2 for the best and worst case scenarios
        grams_in_best_case = (min_intensity_sum / num_blocks) * (power_kw * (duration_minutes / 60.0))
        grams_in_worst_case = (max_intensity_sum / num_blocks) * (power_kw * (duration_minutes / 60.0))
        
        # The savings are the difference
        saved_grams = grams_in_worst_case - grams_in_best_case

        best_period_start = forecast_data[best_start_index]
        best_period_end = forecast_data[best_start_index + num_blocks - 1]
        
        return {
            "start_time": best_period_start["from"],
            "end_time": best_period_end["to"],
            "saved_grams_co2": round(saved_grams) # Return a clean, rounded number
        }
    else:
        raise HTTPException(status_code=500, detail="Could not determine the best time.")