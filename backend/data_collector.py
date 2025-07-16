import requests
import pandas as pd
from datetime import datetime, timedelta, timezone
from pathlib import Path
import time

API_BASE_URL = "https://api.carbonintensity.org.uk"
DATA_DIR = Path(__file__).resolve().parent / 'data'
OUTPUT_FILE = DATA_DIR / 'historical_intensity_data.csv'

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

def fetch_data_for_day(date_str):
    """Fetches 24 hours of intensity data for a given date."""
    url = f"{API_BASE_URL}/intensity/date/{date_str}"
    print(f"Fetching data for {date_str} from {url}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json().get('data', [])
    except requests.exceptions.RequestException as e:
        print(f"  -> Error fetching data for {date_str}: {e}")
        return None

def main():
    print("--- Starting Historical Carbon Intensity Data Collector ---")
    
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=730) # Approx 2 years
    
    all_data = []
    current_date = start_date
    
    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        daily_data = fetch_data_for_day(date_str)
        
        if daily_data:
            all_data.extend(daily_data)
            print(f"  -> Successfully fetched {len(daily_data)} periods.")
        
        current_date += timedelta(days=1)
        time.sleep(0.5) # Be respectful to the API

    if not all_data:
        print("No data collected. Exiting.")
        return

    # Use json_normalize to correctly flatten the nested JSON.
    df = pd.json_normalize(all_data)
    
    print(f"\nTotal periods collected: {len(df)}")
    
    if 'intensity.actual' not in df.columns:
        print("\nFATAL: 'intensity.actual' column was not found after fetching.")
        return
        
    df.to_csv(OUTPUT_FILE, index=False)
    
    print(f"\nSUCCESS: Historical data has been saved to {OUTPUT_FILE}")
    print("--- Data Collection Complete ---")

if __name__ == "__main__":
    main()