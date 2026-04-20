# main.py
import os
import io
from datetime import datetime
import pandas as pd
import geopandas as gpd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
# Load environment variables
load_dotenv()

# Initialize Supabase client
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
if not url or not key:
    raise ValueError("Missing Supabase credentials in .env file")
supabase: Client = create_client(url, key)

# Initialize MongoDB Client
mongo_client = None
mongo_users_col = None
mongo_vehicles_col = None

mongo_uri = os.environ.get("MONGO_URI")
if mongo_uri:
    try:
        mongo_client = MongoClient(mongo_uri)
        mongo_db = mongo_client["tutemprod"] # Update with your DB name
        
        # Reference BOTH collections
        mongo_users_col = mongo_db["users"] 
        mongo_vehicles_col = mongo_db["drivervehicledetails"] 
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        mongo_client = None

# Initialize FastAPI App
app = FastAPI(title="Driver Attendance GPS Backend")

# Setup CORS for the React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000",
        "http://localhost:8080",
        "https://driver-watch.vercel.app"
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


@app.post("/api/sync-drivers")
async def sync_mongo_drivers_to_supabase():
    if mongo_client is None or mongo_users_col is None or mongo_vehicles_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not configured.")

    try:
        # STEP 1: Get IITB vehicles
        iitb_vehicles = list(
            mongo_vehicles_col.find({"organization": "IITB Campus Auto"})
        )
        print(f"🔍 Found {len(iitb_vehicles)} IITB vehicles")

        if not iitb_vehicles:
            return {
                "status": "success",
                "message": "No IITB drivers found in MongoDB.",
                "synced_count": 0
            }

        # STEP 2: Convert driverId → ObjectId
        target_user_ids = []
        vehicle_map = {}

        for vehicle in iitb_vehicles:
            driver_id = vehicle.get("driverId")

            if not driver_id:
                continue

            try:
                obj_id = ObjectId(driver_id)
                target_user_ids.append(obj_id)
                vehicle_map[str(obj_id)] = vehicle
            except:
                print(f"⚠️ Invalid ObjectId: {driver_id}")
                continue

        if not target_user_ids:
            return {
                "status": "success",
                "message": "No valid driver IDs found.",
                "synced_count": 0
            }

        # STEP 3: Fetch users
        users = list(
            mongo_users_col.find({"_id": {"$in": target_user_ids}})
        )
        print(f"🔍 Found {len(users)} matching users")
        def safe_date(val):
            if isinstance(val, datetime):
                return val.isoformat()
            if isinstance(val, str):
                return val
            return None
        # STEP 4: Merge + map all fields
        supabase_payload = []

        for user in users:
            uid_str = str(user.get("_id"))
            vehicle_info = vehicle_map.get(uid_str, {})

            supabase_payload.append({
                # 🔹 Core
                "driverId": uid_str,
                "name": user.get("name", "Unknown Driver"),
                "phone": user.get("phone", ""),

                # 🔹 NEW FIELDS (from users collection)
                "email": user.get("email", ""),
                "image": user.get("image"),  # can be null
                "address": user.get("address", ""),
                "rating": user.get("rating", 0),
                "gender": user.get("gender", ""),
                
                "dob": safe_date(user.get("dateOfBirth")),
                "created_at": safe_date(user.get("createdAt")),

                # 🔹 Vehicle data
                "organization": vehicle_info.get("organization", "IITB Campus Auto"),
                "vehicleClass": vehicle_info.get("vehicleClass", ""),
                "vehicleMake": vehicle_info.get("vehicleMake", ""),
                "vehicleModel": vehicle_info.get("vehicleModel", ""),
                "vehicleRegistrationNo": vehicle_info.get("vehicleRegistrationNo", "")
            })

        # STEP 5: Push to Supabase
        if supabase_payload:
            try:
                supabase.table("drivers").upsert(
                    supabase_payload,
                    on_conflict="driverId"
                ).execute()
            except Exception as upsert_error:
                error_text = str(upsert_error)
                if "column" in error_text.lower() and "drivers" in error_text.lower():
                    # Fallback for environments where optional Mongo fields are not yet in schema.
                    base_payload = [
                        {
                            "driverId": row["driverId"],
                            "name": row.get("name"),
                            "phone": row.get("phone"),
                            "organization": row.get("organization"),
                            "vehicleClass": row.get("vehicleClass"),
                            "vehicleMake": row.get("vehicleMake"),
                            "vehicleModel": row.get("vehicleModel"),
                            "vehicleRegistrationNo": row.get("vehicleRegistrationNo"),
                            "created_at": row.get("created_at"),
                        }
                        for row in supabase_payload
                    ]
                    supabase.table("drivers").upsert(
                        base_payload,
                        on_conflict="driverId"
                    ).execute()
                else:
                    raise

        return {
            "status": "success",
            "message": f"Successfully synced {len(supabase_payload)} IITB drivers.",
            "synced_count": len(supabase_payload)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")

@app.get("/api/external/drivers")
async def fetch_mongo_drivers():
    if mongo_client is None or mongo_users_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")
    
    try:
        # Fetch all drivers from the collection
        # We exclude the MongoDB internal '_id' field because it's not JSON serializable by default
        cursor = mongo_users_col.find({}, {"_id": 0}) 
        drivers_list = list(cursor)
        
        return {
            "status": "success",
            "total_drivers": len(drivers_list),
            "data": drivers_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching from MongoDB: {str(e)}")

# Add these collections below your existing mongo_users_col and mongo_vehicles_col
mongo_location_col = mongo_db["driverlocationstatuses"]
mongo_route_col = mongo_db["vehiclerouteiitbs"]

# IITB Campus Polygon for Ray-Casting
IITB_POLYGON = [
    (19.13566848849955, 72.90263407610097),
    (19.142781379387944, 72.91669570758766),
    (19.128969244302084, 72.91994041529868),
    (19.12529452563203, 72.91693911530889),
    (19.124018769919676, 72.90866132237274)
]

def is_inside_polygon(lat, lng, poly):
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(1, n + 1):
        p2x, p2y = poly[i % n]
        if lng > min(p1y, p2y):
            if lng <= max(p1y, p2y):
                if lat <= max(p1x, p2x):
                    if p1y != p2y:
                        xints = (lng - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or lat <= xints:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

@app.get("/api/ride-request/drivers/name/locations/iitb")
async def get_live_iitb_drivers():
    if not mongo_client:
        raise HTTPException(status_code=500, detail="MongoDB not connected")

    from datetime import datetime, timedelta
    from bson import ObjectId

    # --- TEMPORARY DEBUGGING ---
    # Fetch ALL locations instead of filtering by time
    active_locations = list(mongo_location_col.find({}))
    
    print(f"🔍 DEBUG: Fetched {len(active_locations)} TOTAL locations from the database.")

    # 1. TIME FILTER
    time_threshold = datetime.utcnow() - timedelta(minutes=7)
    
    # Let's fetch the locations. If this returns 0, the issue is how updatedAt is stored in Mongo.
    active_locations = list(mongo_location_col.find({
        "updatedAt": {"$gte": time_threshold}
    }))
    
    print(f"🔍 DEBUG: Found {len(active_locations)} locations updated in the last 7 minutes.")

    merged_drivers = []
    
    for loc in active_locations:
        driver_id = loc.get("driverId")
        if not driver_id: 
            continue
            
        # Safely convert coordinates to floats in case they are stored as strings
        lat, lng = 0.0, 0.0
        try:
            loc_obj = loc.get("location", {})
            
            # Check if it's your Array format: { type: "Point", coordinates: [Lat, Lng] }
            if isinstance(loc_obj, dict) and "coordinates" in loc_obj:
                coords = loc_obj.get("coordinates", [0.0, 0.0])
                lat = float(coords[0]) # 19.13...
                lng = float(coords[1]) # 72.91...
                
            # Check if it's an object format: { latitude: X, longitude: Y }
            elif isinstance(loc_obj, dict) and "latitude" in loc_obj:
                lat = float(loc_obj.get("latitude", 0))
                lng = float(loc_obj.get("longitude", 0))
                
        except (ValueError, TypeError, IndexError):
            print(f"⚠️ Invalid coordinates format for driver {driver_id}")
            continue

        # Convert IDs safely to handle both string and ObjectId formats
        str_id = str(driver_id)
        try:
            obj_id = ObjectId(str_id)
        except:
            print(f"⚠️ Invalid ObjectId format for {driver_id}")
            continue

        # 3. LOOKUPS (Bulletproof: Checks both String and ObjectId just in case)
        user_info = mongo_users_col.find_one({"_id": obj_id}) or {}
        
        vehicle_info = mongo_vehicles_col.find_one({"driverId": str_id}) or mongo_vehicles_col.find_one({"driverId": obj_id}) or {}
        
        route_info = mongo_route_col.find_one({"driverId": str_id}) or mongo_route_col.find_one({"driverId": obj_id}) or {}
        
        # 4. ORGANIZATION FILTER
        org = vehicle_info.get("organization")
        if org != "IITB Campus Auto":
            print(f"🚫 Dropped {driver_id}: Wrong organization ('{org}')")
            continue
            
        # print(f"✅ Added {user_info.get('name', 'Unknown')} to live dashboard!")
        
        merged_drivers.append({
            "driverId": str_id,
            "name": user_info.get("name", "Unknown Driver"),
            "shuttleService": user_info.get("shuttleService", False),
            "latitude": lat,
            "longitude": lng,
            "vehicleRegistrationNo": vehicle_info.get("vehicleRegistrationNo", "N/A"),
            "vehicleRoute": route_info.get("colorName", "Not Assigned").lower()
        })
        
    return sorted(merged_drivers, key=lambda x: x["name"])

@app.get("/api/ride-request/drivers/name/locations/iitb/getIITBDriverCount")
async def get_iitb_registered_count():
    if not mongo_client:
        raise HTTPException(status_code=500, detail="MongoDB not connected")
        
    count = mongo_vehicles_col.count_documents({"organization": "IITB Campus Auto"})
    return {"count": count}




@app.post("/api/attendance/verify-gps-bulk")
async def verify_gps_attendance_bulk(
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
            
        # 1. Parse timestamps and derive attendance date directly from CSV.
        df['timestamp'] = pd.to_datetime(df['timestamp'], format='mixed', errors='coerce', utc=True)
        df = df.dropna(subset=['timestamp'])
        df['attendance_date'] = df['timestamp'].dt.date

        if df.empty:
            return {"status": "success", "data": [], "message": "No valid timestamp records found in CSV."}

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
        
        # Group by driverId and inferred date so multi-day CSVs are handled correctly.
        for (driver_id, attendance_date), group in points_inside.groupby(['driverId', 'attendance_date']):
            driver_id_str = str(driver_id)
            attendance_date_str = attendance_date.isoformat()
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
                "date": attendance_date_str,
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
                    "date": attendance_date_str,
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
        processed_dates = sorted({record["date"] for record in attendance_results})
        return {
            "status": "success",
            "dates": processed_dates,
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