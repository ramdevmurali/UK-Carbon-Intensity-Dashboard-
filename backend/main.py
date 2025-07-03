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

# --- CORS Middleware ---
# This allows our frontend (running on localhost:3000) to talk to this backend.
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Helper Function for API Calls ---
def fetch_from_api(url: str):
    """A helper function to handle API requests and common errors."""
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raises an exception for 4xx or 5xx status codes
        return response.json()
    except requests.exceptions.RequestException as e:
        # Handles network errors
        raise HTTPException(status_code=503, detail=f"Error communicating with external API: {e}")
    except Exception as e:
        # A general catch-all for other potential issues
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


# --- Existing API Endpoints ---
@app.get("/")
def read_root():
    """A simple health check endpoint for the root URL."""
    return {"status": "ok", "message": "API is running"}

@app.get("/api/v1/intensity/current")
def get_current_intensity():
    """Fetches the current carbon intensity data."""
    data = fetch_from_api(f"{API_BASE_URL}/intensity")
    return data.get('data', [{}])[0]

@app.get("/api/v1/intensity/forecast/48h")
def get_48h_forecast():
    """Fetches the 48-hour carbon intensity forecast."""
    now_utc = datetime.now(timezone.utc)
    from_iso = now_utc.isoformat().replace('+00:00', 'Z')
    data = fetch_from_api(f"{API_BASE_URL}/intensity/{from_iso}/fw48h")
    return data.get('data', [])


# ===============================================================
# === NEW FEATURE: BEST TIME OPTIMIZER ENDPOINT ===
# ===============================================================
@app.get("/api/v1/optimizer/best-time")
def find_best_time(duration_minutes: int = Query(..., gt=0, description="The duration of the task in minutes.")):
    """
    Analyzes the 48-hour forecast to find the optimal time window
    to run an appliance based on minimizing carbon intensity.
    """
    # 1. Fetch the latest forecast data. We can call our own function.
    forecast_data = get_48h_forecast()
    if not forecast_data:
        raise HTTPException(status_code=503, detail="Could not retrieve forecast data to analyze.")

    # 2. Calculate how many 30-minute blocks are required for the duration.
    # We use ceiling division: `(a + b - 1) // b`
    # This ensures that 31 minutes becomes 2 blocks, not 1.
    num_blocks = (duration_minutes + 29) // 30

    # 3. Check if the duration is possible within the forecast window.
    if num_blocks >= len(forecast_data):
        raise HTTPException(
            status_code=400,
            detail=f"Duration ({duration_minutes} mins) is too long. Must be less than the forecast window (48 hours)."
        )

    min_intensity_sum = float('inf')
    best_start_index = -1

    # 4. Implement the "sliding window" algorithm.
    # We slide a window of `num_blocks` across the forecast data.
    for i in range(len(forecast_data) - num_blocks + 1):
        
        # Get the current window of forecast periods
        current_window = forecast_data[i : i + num_blocks]
        
        # Sum the 'forecast' intensity for all periods in this window
        current_intensity_sum = sum(period['intensity']['forecast'] for period in current_window)

        # If this window is better than the best one we've found so far, store it.
        if current_intensity_sum < min_intensity_sum:
            min_intensity_sum = current_intensity_sum
            best_start_index = i

    # 5. If we found a valid window, prepare and return the result.
    if best_start_index != -1:
        best_period_start = forecast_data[best_start_index]
        # The end period is the last block in our optimal window
        best_period_end = forecast_data[best_start_index + num_blocks - 1]
        
        return {
            "start_time": best_period_start["from"],
            "end_time": best_period_end["to"],
            "total_intensity_grams": min_intensity_sum
        }
    else:
        # This case should theoretically not be reached with the current logic,
        # but it's good practice for robustness.
        raise HTTPException(status_code=500, detail="Could not determine the best time.")