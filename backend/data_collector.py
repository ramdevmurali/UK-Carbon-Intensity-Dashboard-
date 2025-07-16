# backend/data_collector.py

import requests
import pandas as pd
from datetime import datetime, timedelta, timezone
import time
import logging
import os

# --- Configuration ---
# This script will be run from the root of the project, so paths are relative to the root.
OUTPUT_DIR = "backend"
OUTPUT_FILENAME = "historical_intensity_data.csv"
OUTPUT_FILE_PATH = os.path.join(OUTPUT_DIR, OUTPUT_FILENAME)

API_BASE_URL = "https://api.carbonintensity.org.uk/intensity"

# We will collect data for the last 2 years.
# Using a fixed start date makes the dataset reproducible.
START_DATE = datetime(2022, 1, 1, tzinfo=timezone.utc)
END_DATE = datetime.now(timezone.utc)

# The API is limited to a 14-day range per request. We'll use 14 days per chunk.
CHUNK_DAYS = 14
# Be a good API citizen: add a small delay between requests.
REQUEST_DELAY_SECONDS = 0.5

# Setup basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def format_iso_z(dt: datetime) -> str:
    """Formats a datetime object into the 'Z' format required by the API."""
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')

def collect_historical_data():
    """
    Loops through date ranges, fetches historical carbon intensity data from the API,
    and saves it to a CSV file.
    """
    logging.info(f"Starting data collection from {START_DATE.date()} to {END_DATE.date()}.")
    logging.info(f"Data will be saved to: {OUTPUT_FILE_PATH}")

    all_data_points = []
    current_start_date = START_DATE

    while current_start_date < END_DATE:
        current_end_date = current_start_date + timedelta(days=CHUNK_DAYS)
        # Ensure the final chunk does not go beyond the end date
        if current_end_date > END_DATE:
            current_end_date = END_DATE

        from_iso = format_iso_z(current_start_date)
        to_iso = format_iso_z(current_end_date)
        
        url = f"{API_BASE_URL}/{from_iso}/{to_iso}"

        try:
            logging.info(f"Fetching data for range: {from_iso} to {to_iso}")
            response = requests.get(url)
            response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
            
            data = response.json().get('data', [])
            if data:
                all_data_points.extend(data)
                logging.info(f"Successfully fetched {len(data)} data points for this range.")
            else:
                logging.warning(f"No data returned for range: {from_iso} to {to_iso}")

        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to fetch data for range {from_iso} to {to_iso}. Error: {e}")
            # We continue to the next chunk even if one fails
        except Exception as e:
            logging.error(f"An unexpected error occurred: {e}")

        # Move to the next time window
        current_start_date = current_end_date
        # Wait before the next request
        time.sleep(REQUEST_DELAY_SECONDS)
        
        # Stop if we've reached the end
        if current_start_date >= END_DATE:
            break

    if not all_data_points:
        logging.warning("No data was collected. Exiting.")
        return

    logging.info(f"Total data points collected: {len(all_data_points)}. Processing and saving...")

    # Convert the list of dictionaries to a Pandas DataFrame
    df = pd.DataFrame(all_data_points)

    # The 'intensity' column is a dictionary. We need to "flatten" it into separate columns.
    intensity_df = df['intensity'].apply(pd.Series)
    
    # Combine the flattened intensity data with the original 'from' and 'to' columns
    final_df = pd.concat([df[['from', 'to']], intensity_df], axis=1)

    # Select and rename columns for clarity
    final_df = final_df[['from', 'to', 'forecast', 'actual', 'index']]
    final_df.rename(columns={'index': 'intensity_index'}, inplace=True)

    # Save the processed data to a CSV file
    try:
        # Ensure the output directory exists
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        final_df.to_csv(OUTPUT_FILE_PATH, index=False)
        logging.info(f"Successfully saved data to {OUTPUT_FILE_PATH}")
    except IOError as e:
        logging.error(f"Could not write to file {OUTPUT_FILE_PATH}. Error: {e}")


if __name__ == "__main__":
    collect_historical_data()