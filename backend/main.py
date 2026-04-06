# main.py
import os
import io
import pandas as pd
import geopandas as gpd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
if not url or not key:
    raise ValueError("Missing Supabase credentials in .env file")
supabase: Client = create_client(url, key)

# Initialize FastAPI App
app = FastAPI(title="Driver Attendance GPS Backend")

# Setup CORS for the React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000",
        "http://localhost:8080"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the boundary file once when the server starts
BOUNDARY_FILE_PATH = "data/IITB_Boundary_Poly.gpkg"
try:
    campus_boundary = gpd.read_file(BOUNDARY_FILE_PATH)
except Exception as e:
    print(f"Warning: Could not load boundary file. Make sure {BOUNDARY_FILE_PATH} exists.")
    campus_boundary = None

@app.post("/api/attendance/verify-gps-bulk")
async def verify_gps_attendance_bulk(
    date: str = Form(...),
    file: UploadFile = File(...)
):
    if campus_boundary is None:
        raise HTTPException(status_code=500, detail="Campus boundary data not loaded.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        required_cols = ['latitude', 'longitude', 'timestamp', 'driverId']
        if not all(col in df.columns for col in required_cols):
            raise HTTPException(status_code=400, detail="Missing required CSV columns.")
            
        # 1. Filter the entire file by the target date
        df['timestamp'] = pd.to_datetime(df['timestamp'], format='mixed')
        target_date = pd.to_datetime(date).date()
        df = df[df['timestamp'].dt.date == target_date]
        
        if df.empty:
            return {"status": "success", "data": [], "message": f"No records found for {date}."}

        # 2. Geospatial Filter: Keep only points inside IIT
        gdf = gpd.GeoDataFrame(
            df, 
            geometry=gpd.points_from_xy(df.longitude, df.latitude),
            crs="EPSG:4326"
        )
        boundary_crs = campus_boundary.to_crs("EPSG:4326")
        points_inside = gpd.sjoin(gdf, boundary_crs, predicate='within')

        if points_inside.empty:
            return {"status": "success", "data": [], "message": "No points inside campus."}

        # 3. Fetch Driver Names from Supabase
        unique_driver_ids = [str(driver_id) for driver_id in points_inside['driverId'].dropna().unique().tolist()]
        driver_name_map = {}
        valid_driver_ids = set()

        if unique_driver_ids:
            drivers_result = (
                supabase
                .table("drivers")
                .select("driverId,name")
                .in_("driverId", unique_driver_ids)
                .execute()
            )

            for driver in drivers_result.data or []:
                db_driver_id = str(driver.get("driverId"))
                valid_driver_ids.add(db_driver_id)
                db_driver_name = (driver.get("name") or "").strip()
                if db_driver_name:
                    driver_name_map[db_driver_id] = db_driver_name

        # 4. Bulk Grouping: Calculate In/Out for EVERY driver instantly
        attendance_results = []
        supabase_payload = []
        skipped_driver_ids = []

        def resolve_group_time(group: pd.DataFrame, candidate_columns: list[str]) -> tuple[pd.Timestamp, pd.Timestamp]:
            for column_name in candidate_columns:
                if column_name in group.columns:
                    parsed = pd.to_datetime(group[column_name], format='mixed', errors='coerce').dropna()
                    if not parsed.empty:
                        return parsed.min(), parsed.max()
            return group['timestamp'].min(), group['timestamp'].max()
        
        # Group the data by driverId
        for driver_id, group in points_inside.groupby('driverId'):
            driver_id_str = str(driver_id)
            first_in, last_out = resolve_group_time(
                group,
                ["ist_time", "first_time", "in_time", "entry_time", "time"]
            )

            if pd.isna(first_in) or pd.isna(last_out):
                first_in = group['timestamp'].min()
                last_out = group['timestamp'].max()

            duration_hours = (last_out - first_in).total_seconds() / 3600
            
            # Format times for the frontend array
            first_in_formatted = first_in.strftime("%I:%M %p")
            last_out_formatted = last_out.strftime("%I:%M %p")
            
            attendance_results.append({
                "driver_id": driver_id_str, # Included so frontend still has the ID reference
                "driver_name": driver_name_map.get(driver_id_str, "Unknown Driver"),
                "first_in": first_in_formatted,
                "last_out": last_out_formatted,
                "total_hours": round(duration_hours, 2),
                "status": "Present (GPS)"
            })

            # Prepare the raw data for Supabase Upsert
            if driver_id_str in valid_driver_ids:
                gps_first_in_time, gps_last_out_time = resolve_group_time(
                    group,
                    ["ist_time", "first_time", "in_time", "entry_time", "time", "last_time", "out_time", "exit_time"]
                )

                if pd.isna(gps_first_in_time) or pd.isna(gps_last_out_time):
                    gps_first_in_time = first_in
                    gps_last_out_time = last_out

                supabase_payload.append({
                    "driver_id": driver_id_str,
                    "raw_name": driver_name_map.get(driver_id_str, "Unknown Driver"),
                    "date": date,
                    "gps_first_in": gps_first_in_time.strftime("%H:%M"),
                    "gps_last_out": gps_last_out_time.strftime("%H:%M"),
                    "gps_total_hours": round(duration_hours, 2)
                })
            else:
                skipped_driver_ids.append(driver_id_str)

        # 5. Push GPS Data to Supabase (Upsert)
        if supabase_payload:
            try:
                supabase.table('attendance').upsert(
                    supabase_payload, 
                    on_conflict='driver_id,date'
                ).execute()
            except Exception as e:
                print(f"Warning: Failed to save to Supabase: {str(e)}")

        # 6. Return the complete list to the frontend
        return {
            "status": "success",
            "date": date,
            "total_drivers_processed": len(attendance_results),
            "saved_to_attendance": len(supabase_payload),
            "skipped_missing_drivers": len(skipped_driver_ids),
            "skipped_driver_ids": skipped_driver_ids,
            "data": attendance_results
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")