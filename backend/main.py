# backend/main.py

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone # Import datetime and timezone

# Define the base URL for the National Grid API
API_BASE_URL = "https://api.carbonintensity.org.uk"


# Initialize the FastAPI application
app = FastAPI(
    title="UK Carbon Intensity API",
    description="A proxy API for the UK National Grid Carbon Intensity data.",
    version="1.0.0",
)

# Configure CORS
origins = [
    "http://localhost:3000",
    "localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "UK Carbon Intensity API is running!"}


@app.get("/api/v1/intensity/current")
def get_current_intensity():
    """ Fetches the current carbon intensity data from the National Grid API. """
    url = f"{API_BASE_URL}/intensity"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return data['data'][0]
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Error communicating with API: {e}")
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse data: {e}")


# --- THIS IS THE FULLY CORRECTED ENDPOINT ---
@app.get("/api/v1/intensity/forecast/48h")
def get_48h_forecast():
    """
    Fetches the 48-hour carbon intensity forecast from the National Grid API,
    starting from the current UTC time.
    """
    # 1. Get the current time in UTC.
    now_utc = datetime.now(timezone.utc)

    # 2. Format the time into the ISO 8601 format required by the API.
    # The format looks like: 2023-01-01T12:00Z
    from_iso = now_utc.isoformat().replace('+00:00', 'Z')

    # 3. Construct the correct URL with the dynamic 'from' timestamp.
    # The endpoint signature is /intensity/{from}/fw48h
    url = f"{API_BASE_URL}/intensity/{from_iso}/fw48h"

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        # 4. This endpoint, like the /intensity one, wraps the result in a 'data' key.
        return data['data']
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Error communicating with API: {e}")
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse data: {e}")