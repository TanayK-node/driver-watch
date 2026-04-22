import pymongo
import pandas as pd
import geopandas as gpd
import numpy as np
from shapely.geometry import Point
from datetime import datetime, timedelta
import pytz

# ==========================================
# 1. CONFIGURATION & PATHS
# ==========================================
# Database configs (Source)
MONGO_URI_PROD = "mongodb://admin:%401209mongadminuser@43.205.87.15:27017/tutemprod?authSource=admin"
SOURCE_DB = "tutemprod"
SOURCE_COLLECTION = "driverlocationstatuses"

# Database configs (Dashboard Destination)
MONGO_URI_DASHBOARD = "mongodb://admin:%401209mongadminuser@43.205.87.15:27017/TutemIq?authSource=admin" # Update if different
DEST_DB = "TutemIq"
DEST_COLLECTION = "processed_driver_locations"

# Static Files
BOUNDARY_FILE = "./data/IITB_Boundary_Poly.gpkg"
DRIVER_MASTER_FILE = "./data/Driver's_ID_name.csv"

# Tuning Parameters
SESSION_GAP_SECONDS = 180
DISTANCE_THRESHOLD = 50.0  # Updated to 50m radius
TIME_THRESHOLD = 120.0
MAX_STRIKES = 3

# ==========================================
# 2. HELPER FUNCTIONS (MATH & SPATIAL)
# ==========================================
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    delta_phi = np.radians(lat2 - lat1)
    delta_lambda = np.radians(lon2 - lon1)
    a = np.sin(delta_phi / 2.0)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda / 2.0)**2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return R * c

# ==========================================
# 3. CORE PROCESSING PIPELINE
# ==========================================
def fetch_last_two_months():
    print("Fetching last 2 months of data from Production DB...")
    client = pymongo.MongoClient(MONGO_URI_PROD)
    col = client[SOURCE_DB][SOURCE_COLLECTION]
    
    two_months_ago = datetime.utcnow() - timedelta(days=60)
    
    # Assuming 'updatedAt' is a proper BSON Date. Adjust field name if necessary.
    query = {"updatedAt": {"$gte": two_months_ago}}
    cursor = col.find(query)
    
    data = []
    for doc in cursor:
        coords = doc.get("location", {}).get("coordinates", [None, None])
        updated_at = doc.get("updatedAt") or doc.get("loginTime") or datetime.utcnow()
        
        data.append({
            "driverId": doc.get("driverId", ""),
            "latitude": coords[0] if len(coords) > 0 else None,
            "longitude": coords[1] if len(coords) > 1 else None,
            "accuracy": doc.get("accuracy", 0),
            "status": doc.get("status", ""),
            "organization": doc.get("organization", ""),
            "timestamp": updated_at
        })
    
    client.close()
    return pd.DataFrame(data).dropna(subset=['latitude', 'longitude'])

def clean_and_enrich(df):
    print("Cleaning, converting timezones, and mapping geospatial boundaries...")
    # Sort and remove duplicates
    df = df.sort_values(by=["driverId", "timestamp"]).drop_duplicates(subset=["driverId", "timestamp"]).reset_index(drop=True)
    
    # Convert UTC to IST
    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
    df['timestamp_IST'] = df['timestamp'].dt.tz_convert('Asia/Kolkata')
    df['date'] = df['timestamp_IST'].dt.strftime("%d-%m-%Y")
    
    # Add driver names
    driver_master = pd.read_csv(DRIVER_MASTER_FILE)
    df = df.merge(driver_master, how="left", left_on="driverId", right_on="driver_id")
    df["name"] = df["name"].fillna("Unknown")
    if "driver_id" in df.columns:
        df = df.drop(columns=["driver_id"])
        
    # Boundary Filter
    boundary = gpd.read_file(BOUNDARY_FILE).to_crs("EPSG:4326")
    geometry = [Point(xy) for xy in zip(df["longitude"], df["latitude"])]
    gps_gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
    df = gpd.sjoin(gps_gdf, boundary, predicate="within", how="inner").drop(columns=["geometry", "index_right"])
    
    return df.reset_index(drop=True)

def apply_sessions_and_jitter_removal(df):
    print("Applying session segmentation and jitter removal logic...")
    df = df.sort_values(by=['driverId', 'timestamp_IST']).reset_index(drop=True)
    
    # Calculate dt and Sessions
    df['dt'] = df.groupby('driverId')['timestamp_IST'].diff().dt.total_seconds().fillna(0)
    df['session_break'] = df['dt'] > SESSION_GAP_SECONDS
    df['session_id'] = 'S' + (df.groupby('driverId')['session_break'].cumsum() + 1).astype(str)
    
    # Distance and Velocity
    prev_lat = df.groupby('session_id')['latitude'].shift(1)
    prev_lon = df.groupby('session_id')['longitude'].shift(1)
    df['ds'] = haversine(prev_lat, prev_lon, df['latitude'], df['longitude']).fillna(0.0)
    df['dv'] = df['ds'] / df['dt'].replace(0, np.nan)
    
    # Point Classification
    df['activity_state'] = np.where(df['ds'] == 0, 'Stationary', 
                           np.where(df['ds'] > 0, 'Moving', 'Initial Point'))
                           
    # Stop Point Detection 
    results = []
    for driver_id, group in df.groupby('driverId'):
        group = group.sort_values('timestamp_IST')
        lats, lons = group['latitude'].values, group['longitude'].values
        times = group['timestamp_IST'].values
        states = group['activity_state'].values
        n = len(group)
        i = 0
        while i < n:
            j = i + 1
            strikes = 0
            last_good_j = i  
            while j < n:
                dist = haversine(lats[i], lons[i], lats[j], lons[j])
                if dist > DISTANCE_THRESHOLD:
                    strikes += 1
                    if strikes > MAX_STRIKES: break
                else:
                    strikes = 0
                    last_good_j = j 
                j += 1
            j_valid = last_good_j + 1
            if j_valid - 1 > i:
                time_diff = (times[j_valid-1] - times[i]) / np.timedelta64(1, 's')
                if time_diff >= TIME_THRESHOLD:
                    chunk = states[i:j_valid]
                    chunk[chunk != 'Stationary'] = 'Stop Point'
                    states[i:j_valid] = chunk
                    i = j_valid
                    continue
            i += 1
        group['activity_state'] = states
        results.append(group)
    df = pd.concat(results).sort_index()

    # Sandwich Filter & Centroid Smoothing
    is_stopped = df['activity_state'].isin(['Stop Point', 'Stationary'])
    df['raw_cluster_id'] = ((is_stopped != is_stopped.shift()) | 
                            (df['driverId'] != df['driverId'].shift()) |
                            (df['session_id'] != df['session_id'].shift())).cumsum()
    stop_centroids = df[is_stopped].groupby('raw_cluster_id')[['latitude', 'longitude']].transform('mean')
    df.loc[is_stopped, 'latitude'] = stop_centroids['latitude']
    df.loc[is_stopped, 'longitude'] = stop_centroids['longitude']
    
    # Final cleanup
    df = df.drop(columns=['raw_cluster_id', 'session_break'])
    return df

def upload_to_dashboard(df):
    print("Uploading finalized data to Dashboard Database...")
    # Convert datetime objects to strings/standard formats for MongoDB
    df['timestamp'] = df['timestamp'].astype(str)
    df['timestamp_IST'] = df['timestamp_IST'].astype(str)
    
    records = df.to_dict('records')
    
    client = pymongo.MongoClient(MONGO_URI_DASHBOARD)
    db = client[DEST_DB]
    col = db[DEST_COLLECTION]
    
    # Clear old data
    col.delete_many({}) 
    
    rows_added = 0
    if records:
        # Insert records and capture the result
        result = col.insert_many(records)
        rows_added = len(result.inserted_ids)
        
    print(f"✅ Successfully added {rows_added} rows to {DEST_DB}.{DEST_COLLECTION}.")
    client.close()
    
    return rows_added

# ==========================================
# 4. EXECUTION
# ==========================================
if __name__ == "__main__":
    start_time = datetime.now()
    
    raw_df = fetch_last_two_months()
    if not raw_df.empty:
        raw_count = len(raw_df)
        print(f"📥 Fetched {raw_count} raw rows from production.")
        
        clean_df = clean_and_enrich(raw_df)
        final_df = apply_sessions_and_jitter_removal(clean_df)
        
        # Capture and print the final added count
        added_count = upload_to_dashboard(final_df)
        
        print("\n=== PIPELINE SUMMARY ===")
        print(f"Raw rows fetched: {raw_count}")
        print(f"Final rows added: {added_count}")
        print(f"Rows filtered out (duplicates, outside bounds, etc): {raw_count - added_count}")
        
    else:
        print("No data found in the last 2 months.")
        
    print(f"\n⏱️ Pipeline completed in {datetime.now() - start_time}")