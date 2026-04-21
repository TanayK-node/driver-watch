# main.py
import os
import io
import json
from datetime import datetime
import pandas as pd
import geopandas as gpd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from datetime import timedelta
from urllib import request as urllib_request
from urllib import error as urllib_error
# Load environment variables
load_dotenv()

# Initialize MongoDB Client
mongo_client = None
mongo_db = None
mongo_drivers_col = None
mongo_attendance_col = None
mongo_location_col = None
mongo_route_col = None
legacy_users_col = None
legacy_vehicles_col = None

mongo_uri = os.environ.get("MONGO_URI")
if mongo_uri:
    try:
        mongo_client = MongoClient(mongo_uri)
        mongo_db_name = os.environ.get("MONGO_DB_NAME", "TutemIq")
        mongo_db = mongo_client[mongo_db_name]

        mongo_drivers_col = mongo_db["drivers"]
        mongo_attendance_col = mongo_db["attendance"]
        mongo_location_col = mongo_db["driverlocationstatuses"]
        mongo_route_col = mongo_db["vehiclerouteiitbs"]

        # Keep legacy collections available for one-time migration from the old source database.
        legacy_db = mongo_client["tutemprod"]
        legacy_users_col = legacy_db["users"]
        legacy_vehicles_col = legacy_db["drivervehicledetails"]
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        mongo_client = None

# Initialize FastAPI App
app = FastAPI(title="Driver Attendance GPS Backend")

# Setup CORS for the React Frontend
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    "https://driver-watch.vercel.app",
    "https://driver-watch.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://([a-z0-9-]+\.)*vercel\.app$",
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


def is_mongo_ready(*collections):
    return mongo_client is not None and all(collection is not None for collection in collections)


def serialize_mongo_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {key: serialize_mongo_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [serialize_mongo_value(item) for item in value]
    return value


def serialize_mongo_doc(document):
    return serialize_mongo_value(document)


def get_driver_id_candidates(driver_id):
    candidates = []
    if driver_id is None:
        return candidates

    driver_id_str = str(driver_id)
    candidates.append(driver_id_str)

    try:
        candidates.append(ObjectId(driver_id_str))
    except Exception:
        pass

    return candidates


def find_driver_document(driver_id):
    if mongo_drivers_col is None:
        return None

    for candidate in get_driver_id_candidates(driver_id):
        driver = mongo_drivers_col.find_one({"driverId": candidate})
        if driver:
            return driver
        driver = mongo_drivers_col.find_one({"_id": candidate})
        if driver:
            return driver
    return None


def upsert_attendance_record(record):
    if mongo_attendance_col is None:
        raise HTTPException(status_code=500, detail="Attendance collection not configured.")

    driver_id = str(record.get("driver_id") or record.get("driverId") or "").strip()
    attendance_date = record.get("date")

    if not driver_id or not attendance_date:
        raise HTTPException(status_code=400, detail="driver_id and date are required.")

    payload = {
        "driver_id": driver_id,
        "raw_name": record.get("raw_name") or record.get("rawName") or "Unknown Driver",
        "date": attendance_date,
        "check_in": record.get("check_in") or record.get("checkIn"),
        "check_out": record.get("check_out") or record.get("checkOut"),
        "gps_first_in": record.get("gps_first_in") or record.get("gpsFirstIn"),
        "gps_last_out": record.get("gps_last_out") or record.get("gpsLastOut"),
        "gps_total_hours": record.get("gps_total_hours") or record.get("gpsTotalHours"),
        "source": record.get("source"),
    }

    cleaned_payload = {key: value for key, value in payload.items() if value is not None}

    mongo_attendance_col.update_one(
        {"driver_id": driver_id, "date": attendance_date},
        {"$set": cleaned_payload},
        upsert=True,
    )

    return cleaned_payload


def normalize_attendance_date(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date().isoformat()

    value_str = str(value).strip()
    if not value_str:
        return None

    if "T" in value_str:
        return value_str.split("T", 1)[0]
    if " " in value_str:
        return value_str.split(" ", 1)[0]
    return value_str


@app.post("/api/sync-drivers")
async def sync_legacy_drivers_to_mongo():
    if mongo_client is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not configured.")

    try:
        if legacy_users_col is None or legacy_vehicles_col is None or mongo_drivers_col is None:
            raise HTTPException(status_code=500, detail="MongoDB collections not configured.")

        iitb_vehicles = list(legacy_vehicles_col.find({"organization": "IITB Campus Auto"}))
        print(f"🔍 Found {len(iitb_vehicles)} IITB vehicles")

        if not iitb_vehicles:
            return {
                "status": "success",
                "message": "No IITB drivers found in MongoDB.",
                "synced_count": 0,
            }

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
            except Exception:
                print(f"⚠️ Invalid ObjectId: {driver_id}")
                continue

        if not target_user_ids:
            return {
                "status": "success",
                "message": "No valid driver IDs found.",
                "synced_count": 0,
            }

        users = list(legacy_users_col.find({"_id": {"$in": target_user_ids}}))
        print(f"🔍 Found {len(users)} matching users")

        def safe_date(val):
            if isinstance(val, datetime):
                return val.isoformat()
            if isinstance(val, str):
                return val
            return None

        mongo_payload = []

        for user in users:
            uid_str = str(user.get("_id"))
            vehicle_info = vehicle_map.get(uid_str, {})

            mongo_payload.append({
                "driverId": uid_str,
                "name": user.get("name", "Unknown Driver"),
                "phone": user.get("phone", ""),
                "email": user.get("email", ""),
                "image": user.get("image"),
                "address": user.get("address", ""),
                "rating": user.get("rating", 0),
                "gender": user.get("gender", ""),
                "dob": safe_date(user.get("dateOfBirth")),
                "created_at": safe_date(user.get("createdAt")),
                "organization": vehicle_info.get("organization", "IITB Campus Auto"),
                "vehicleClass": vehicle_info.get("vehicleClass", ""),
                "vehicleMake": vehicle_info.get("vehicleMake", ""),
                "vehicleModel": vehicle_info.get("vehicleModel", ""),
                "vehicleRegistrationNo": vehicle_info.get("vehicleRegistrationNo", ""),
            })

        if mongo_payload:
            for row in mongo_payload:
                mongo_drivers_col.update_one(
                    {"driverId": row["driverId"]},
                    {"$set": row},
                    upsert=True,
                )

        return {
            "status": "success",
            "message": f"Successfully synced {len(mongo_payload)} IITB drivers into MongoDB.",
            "synced_count": len(mongo_payload),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")

@app.get("/api/external/drivers")
async def fetch_mongo_drivers():
    if mongo_client is None or mongo_drivers_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")
    
    try:
        cursor = mongo_drivers_col.find({})
        drivers_list = [serialize_mongo_doc(driver) for driver in cursor]
        
        return {
            "status": "success",
            "total_drivers": len(drivers_list),
            "data": drivers_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching from MongoDB: {str(e)}")


@app.get("/api/drivers")
async def list_drivers():
    if mongo_client is None or mongo_drivers_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        drivers = [serialize_mongo_doc(driver) for driver in mongo_drivers_col.find({})]
        return {"status": "success", "total_drivers": len(drivers), "data": drivers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching drivers: {str(e)}")


@app.get("/api/drivers/count")
async def count_drivers():
    if mongo_client is None or mongo_drivers_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        return {"status": "success", "count": mongo_drivers_col.count_documents({})}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error counting drivers: {str(e)}")


@app.get("/api/drivers/{driver_id}")
async def get_driver(driver_id: str):
    if mongo_client is None or mongo_drivers_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        driver = find_driver_document(driver_id)
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found.")
        return {"status": "success", "data": serialize_mongo_doc(driver)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching driver: {str(e)}")


@app.post("/api/drivers")
async def upsert_driver(payload: dict):
    if mongo_client is None or mongo_drivers_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    driver_id = str(payload.get("driverId") or payload.get("driver_id") or "").strip()
    if not driver_id:
        raise HTTPException(status_code=400, detail="driverId is required.")

    record = {key: value for key, value in payload.items() if value is not None}
    record["driverId"] = driver_id

    try:
        mongo_drivers_col.update_one({"driverId": driver_id}, {"$set": record}, upsert=True)
        return {"status": "success", "data": serialize_mongo_doc(record)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving driver: {str(e)}")


@app.get("/api/attendance")
async def list_attendance(date: str | None = None, driver_id: str | None = None):
    if mongo_client is None or mongo_attendance_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    query: dict[str, object] = {}
    if driver_id:
        query["driver_id"] = driver_id

    try:
        raw_records = list(mongo_attendance_col.find(query).sort("date", 1))
        records = [serialize_mongo_doc(record) for record in raw_records]

        if date:
            target_date = normalize_attendance_date(date)
            records = [
                record
                for record in records
                if normalize_attendance_date(record.get("date")) == target_date
            ]

        return {"status": "success", "total_records": len(records), "data": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching attendance: {str(e)}")


@app.post("/api/attendance/bulk")
async def upsert_attendance_bulk(payload: dict):
    if mongo_client is None or mongo_attendance_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    records = payload.get("records")
    if not isinstance(records, list):
        raise HTTPException(status_code=400, detail="records must be a list.")

    saved_count = 0
    for record in records:
        if not isinstance(record, dict):
            continue
        upsert_attendance_record(record)
        saved_count += 1

    return {"status": "success", "saved_count": saved_count}


@app.post("/api/attendance/extract-from-image")
async def extract_attendance_from_image(payload: dict):
    image_base64 = payload.get("imageBase64")
    drivers = payload.get("drivers") or []

    if not image_base64:
        raise HTTPException(status_code=400, detail="imageBase64 is required")

    gateway_api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("LOVABLE_API_KEY")
    if gateway_api_key and gateway_api_key.upper().startswith("PASTE_YOUR_"):
        gateway_api_key = None

    if not gateway_api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY (or LOVABLE_API_KEY) is not configured")

    unique_driver_names = sorted(
        {
            str(driver.get("name", "")).strip()
            for driver in drivers
            if isinstance(driver, dict) and str(driver.get("name", "")).strip()
        }
    )

    driver_list = "\n".join(unique_driver_names)
    today = datetime.utcnow().date().isoformat()

    system_prompt = f"""You are an expert data entry assistant reading a handwritten gate register. 

Assume date = {today} if a row has no visible date.

This is the STRICT, ALLOWED LIST of driver names from my database:
=== DRIVER LIST ===
{driver_list}
===================

CRITICAL INSTRUCTION FOR NAME MAPPING:
When you read a handwritten name, you MUST perform a \"fuzzy match\" against the DRIVER LIST. 
- If the handwritten name is abbreviated (e.g., \"Deepak P.\").
- If it is missing a middle name (e.g., \"Deepak Panhalkar\").
- If it is misspelled (e.g., \"Depak\").
You must STILL output the EXACT full name from the DRIVER LIST. 
DO NOT output the literal handwritten name. If a name is completely illegible and cannot be matched to the list, skip that row entirely.

Give records in this exact structure and return ONLY JSON:
{{
  "rows": [
    {{
      "rawName": "EXACT MATCH FROM DRIVER LIST",
      "date": "YYYY-MM-DD",
      "inTime": "HH:MM",
      "outTime": "HH:MM or empty string"
    }}
  ]
}}

Rules:
- Extract all attendance rows visible in the image.
- rawName MUST exactly match a name from the list.
- Convert all dates to YYYY-MM-DD format.
- If date is missing on a row, use {today}.
- Convert all times to 24-hour HH:MM format.
- If out time is missing, set outTime to empty string "".
- Return ONLY valid JSON.
- If no attendance rows are readable, return {{"rows": []}}."""

    request_body = {
        "model": "google/gemini-2.5-flash",
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                    {
                        "type": "text",
                        "text": "Extract attendance and fuzzy-match every name directly to the provided driver list.",
                    },
                ],
            },
        ],
    }

    req = urllib_request.Request(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {gateway_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(req, timeout=90) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="ignore")
        if error.code == 429:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again in a moment.")
        if error.code == 402:
            raise HTTPException(status_code=402, detail="AI credits exhausted. Please add funds in Settings > Workspace > Usage.")
        raise HTTPException(status_code=500, detail=error_body or "AI extraction failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    content = response_payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    json_str = content.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()

    try:
        parsed = json.loads(json_str)
    except Exception:
        raise HTTPException(status_code=422, detail={"error": "Could not parse AI response", "raw": content})

    return parsed


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
    if not is_mongo_ready(mongo_drivers_col, mongo_location_col, mongo_route_col):
        raise HTTPException(status_code=500, detail="MongoDB not connected")

    time_threshold = datetime.utcnow() - timedelta(minutes=7)

    active_locations = list(mongo_location_col.find({"updatedAt": {"$gte": time_threshold}}))
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

        str_id = str(driver_id)
        try:
            obj_id = ObjectId(str_id)
        except Exception:
            print(f"⚠️ Invalid ObjectId format for {driver_id}")
            continue

        driver_info = find_driver_document(str_id) or {}
        route_info = mongo_route_col.find_one({"driverId": str_id}) or mongo_route_col.find_one({"driverId": obj_id}) or {}
        
        org = driver_info.get("organization")
        if org != "IITB Campus Auto":
            print(f"🚫 Dropped {driver_id}: Wrong organization ('{org}')")
            continue
        
        merged_drivers.append({
            "driverId": str_id,
            "name": driver_info.get("name", "Unknown Driver"),
            "shuttleService": driver_info.get("shuttleService", False),
            "latitude": lat,
            "longitude": lng,
            "vehicleRegistrationNo": driver_info.get("vehicleRegistrationNo", "N/A"),
            "vehicleColor": driver_info.get("vehicleColor"),
            "vehicleRoute": route_info.get("colorName", driver_info.get("vehicleRoute", "Not Assigned")),
        })
        
    return sorted(merged_drivers, key=lambda x: x["name"])

@app.get("/api/ride-request/drivers/name/locations/iitb/getIITBDriverCount")
async def get_iitb_registered_count():
    if not mongo_client or mongo_drivers_col is None:
        raise HTTPException(status_code=500, detail="MongoDB not connected")
        
    count = mongo_drivers_col.count_documents({"organization": "IITB Campus Auto"})
    return {"count": count}




@app.post("/api/attendance/verify-gps-bulk")
async def verify_gps_attendance_bulk(
    file: UploadFile = File(...)
):
    if campus_boundary is None:
        raise HTTPException(status_code=500, detail="Campus boundary data not loaded.")
    if not is_mongo_ready(mongo_drivers_col, mongo_attendance_col):
        raise HTTPException(status_code=500, detail="MongoDB connection not configured.")

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

        # 3. Fetch Driver Names from MongoDB
        unique_driver_ids = [str(driver_id) for driver_id in points_inside['driverId'].dropna().unique().tolist()]
        driver_name_map = {}
        valid_driver_ids = set()

        if unique_driver_ids:
            drivers_result = list(mongo_drivers_col.find({"driverId": {"$in": unique_driver_ids}}, {"_id": 0, "driverId": 1, "name": 1}))

            for driver in drivers_result:
                db_driver_id = str(driver.get("driverId"))
                valid_driver_ids.add(db_driver_id)
                db_driver_name = (driver.get("name") or "").strip()
                if db_driver_name:
                    driver_name_map[db_driver_id] = db_driver_name

        # 4. Bulk Grouping: Calculate In/Out for EVERY driver instantly
        attendance_results = []
        mongo_payload = []
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

            # Prepare the raw data for MongoDB Upsert
            if driver_id_str in valid_driver_ids:
                gps_first_in_time, gps_last_out_time = resolve_group_time(
                    group,
                    ["ist_time", "first_time", "in_time", "entry_time", "time", "last_time", "out_time", "exit_time"]
                )

                if pd.isna(gps_first_in_time) or pd.isna(gps_last_out_time):
                    gps_first_in_time = first_in
                    gps_last_out_time = last_out

                mongo_payload.append({
                    "driver_id": driver_id_str,
                    "raw_name": driver_name_map.get(driver_id_str, "Unknown Driver"),
                    "date": attendance_date_str,
                    "gps_first_in": gps_first_in_time.strftime("%H:%M"),
                    "gps_last_out": gps_last_out_time.strftime("%H:%M"),
                    "gps_total_hours": round(duration_hours, 2)
                })
            else:
                skipped_driver_ids.append(driver_id_str)

        # 5. Push GPS Data to MongoDB (Upsert)
        for record in mongo_payload:
            upsert_attendance_record(record)

        # 6. Return the complete list to the frontend
        processed_dates = sorted({record["date"] for record in attendance_results})
        return {
            "status": "success",
            "dates": processed_dates,
            "total_drivers_processed": len(attendance_results),
            "saved_to_attendance": len(mongo_payload),
            "skipped_missing_drivers": len(skipped_driver_ids),
            "skipped_driver_ids": skipped_driver_ids,
            "data": attendance_results
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")