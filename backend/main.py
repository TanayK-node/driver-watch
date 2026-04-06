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
    allow_origins=["http://localhost:5173", "http://localhost:3000","http://localhost:8080"], # Update with your frontend URL
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

@app.post("/api/attendance/verify-gps")
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

        unique_driver_ids = [str(driver_id) for driver_id in points_inside['driverId'].dropna().unique().tolist()]
        driver_name_map = {}

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
                db_driver_name = (driver.get("name") or "").strip()
                if db_driver_name:
                    driver_name_map[db_driver_id] = db_driver_name

        # 3. Bulk Grouping: Calculate In/Out for EVERY driver instantly
        attendance_results = []
        
        # Group the data by driverId
        for driver_id, group in points_inside.groupby('driverId'):
            driver_id_str = str(driver_id)
            first_in = group['timestamp'].min()
            last_out = group['timestamp'].max()
            duration_hours = (last_out - first_in).total_seconds() / 3600
            
            attendance_results.append({
                "driver_name": driver_name_map.get(driver_id_str, "Unknown Driver"),
                "first_in": first_in.strftime("%I:%M %p"), # Formats to e.g., 08:30 AM
                "last_out": last_out.strftime("%I:%M %p"),
                "total_hours": round(duration_hours, 2),
                "status": "Present (GPS)"
            })

        # 4. Return the complete list to the frontend
        return {
            "status": "success",
            "date": date,
            "total_drivers_processed": len(attendance_results),
            "data": attendance_results
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")