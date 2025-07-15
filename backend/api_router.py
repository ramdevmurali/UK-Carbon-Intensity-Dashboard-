# backend/api_router.py

from fastapi import APIRouter, HTTPException, Query
# The '.' is a relative import, meaning "from the same directory, import the services module"
from . import services

# APIRouter is a "mini" FastAPI app. The prefix makes all paths in this file
# start with /api/v1, so we don't have to repeat it.
router = APIRouter(prefix="/api/v1")

@router.get("/regions")
def get_available_regions():
    """Endpoint to get the list of available regions."""
    return {"regions": services.CANONICAL_REGION_SHORTNAMES}

@router.get("/generation/current")
def get_current_generation_mix():
    """Endpoint for the current national generation mix."""
    return services.get_national_current_generation()

@router.get("/intensity/current")
def get_current_intensity():
    """Endpoint for the current national intensity."""
    return services.get_national_current_intensity()

@router.get("/intensity/forecast/48h")
def get_48h_forecast():
    """Endpoint for the 48-hour national forecast."""
    return services.get_national_forecast_48h()

@router.get("/intensity/regional/current/{region_shortname}")
def get_current_regional_intensity_by_name(region_shortname: str):
    """Endpoint for a region's current intensity and generation mix."""
    regional_forecast = services.get_regional_forecast_48h(region_shortname)
    intensity_periods = regional_forecast.get('data', [])
    if not intensity_periods:
        raise HTTPException(status_code=404, detail=f"No current data found for region '{region_shortname}'.")
    
    # Return the very first period as the "current" data
    first_period = intensity_periods[0]
    return {
        "region_name": regional_forecast.get('region_name'),
        "from": first_period.get('from'),
        "to": first_period.get('to'),
        "intensity": first_period.get('intensity'),
        "generationmix": first_period.get('generationmix'),
    }

@router.get("/intensity/regional/forecast/48h/{region_shortname}")
def get_regional_48h_forecast_endpoint_by_name(region_shortname: str):
    """Endpoint for a region's 48-hour forecast."""
    return services.get_regional_forecast_48h(region_shortname)

@router.get("/optimizer/best-time")
def find_best_time_endpoint(
    duration_minutes: int = Query(..., gt=0),
    power_kw: float = Query(..., gt=0),
    region_shortname: str | None = None 
):
    """Endpoint for the time optimization logic."""
    return services.find_best_time_logic(
        duration_minutes=duration_minutes,
        power_kw=power_kw,
        region_shortname=region_shortname
    )