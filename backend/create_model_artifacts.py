import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import pickle
from pathlib import Path

print("--- Starting ML Artifact Regeneration Script ---")

# --- 1. Define Paths ---
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / 'data' / 'historical_intensity_data.csv'
MODELS_PATH = BASE_DIR / 'models'

# Ensure the models directory exists
MODELS_PATH.mkdir(exist_ok=True)

print(f"Reading historical data from: {DATA_PATH}")
print(f"Artifacts will be saved to: {MODELS_PATH}")

# --- 2. Load and Prepare Data ---
try:
    df = pd.read_csv(DATA_PATH)
    df['from'] = pd.to_datetime(df['from'])
except FileNotFoundError:
    print(f"FATAL: Historical data file not found at {DATA_PATH}.")
    print("Please ensure you have run the 'backend/data_collector.py' script first.")
    exit()

# --- 3. Engineer Features (same logic as the notebook) ---
mean_intensity = df['intensity.actual'].mean()
df['is_low'] = df['intensity.actual'] < mean_intensity
df['window_id'] = (df['is_low'] != df['is_low'].shift()).cumsum()
low_carbon_windows = df[df['is_low']]

window_features_list = []
for _id, group in low_carbon_windows.groupby('window_id'):
    if group.empty or len(group) < 2:
        continue # Skip windows that are too short
        
    duration = len(group) * 30  # 30 minutes per period
    window_avg_intensity = group['intensity.actual'].mean()
    depth = (mean_intensity - window_avg_intensity) / mean_intensity
    stability = group['intensity.actual'].std(ddof=0)
    
    window_features_list.append({
        'duration': duration,
        'depth': depth,
        'stability': stability
    })

features_df = pd.DataFrame(window_features_list)
features_df.dropna(inplace=True)

print(f"Feature engineering complete. Found {len(features_df)} valid low-carbon windows.")

# --- 4. Train Scaler and Model ---
scaler = StandardScaler()
scaled_features = scaler.fit_transform(features_df)

kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
kmeans.fit(scaled_features)

print("K-Means model and StandardScaler have been trained.")
# --- 5. Define Cluster Mapping ---
# This map is based on manual analysis from the notebook
cluster_to_appliance_map = {
    0: {
        "name": "Heavy Load Shift",
        "reason": "This is a long, stable, and very low-carbon period. Ideal for high-consumption tasks.",
        "appliance": "EV Charger / Washing Machine",
        "color": "#4299E1", # Blue
        "icon": "FaBolt"
    },
    1: {
        "name": "Standard Green Window",
        "reason": "A moderately long and low-carbon window. Good for everyday appliances.",
        "appliance": "Dishwasher / Tumble Dryer",
        "color": "#48BB78", # Green
        "icon": "FaCogs"
    },
    2: {
        "name": "Quick Green Burst",
        "reason": "A short but significantly green window. Perfect for quick, opportunistic tasks.",
        "appliance": "Kettle / Toaster / Quick Charge",
        "color": "#4FD1C5", # Teal
        "icon": "FaLeaf"
    }
}
print("Defined cluster-to-appliance mapping.")

# --- 6. Save All Artifacts ---
with open(MODELS_PATH / 'window_cluster_model.pkl', 'wb') as f:
    pickle.dump(kmeans, f)
print("-> Saved window_cluster_model.pkl")

with open(MODELS_PATH / 'window_scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)
print("-> Saved window_scaler.pkl")

with open(MODELS_PATH / 'cluster_to_appliance_map.pkl', 'wb') as f:
    pickle.dump(cluster_to_appliance_map, f)
print("-> Saved cluster_to_appliance_map.pkl")

print("--- SUCCESS: All ML artifacts have been regenerated successfully. ---")