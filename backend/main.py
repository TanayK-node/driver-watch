# main.py
from itertools import count
from collections import defaultdict
import os
import io
import json
import asyncio
from datetime import datetime, timezone
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
mongo_users_col = None
mongo_attendance_col = None
mongo_trip_analysis_col = None
mongo_location_col = None
mongo_route_col = None
legacy_riderequests_col = None
legacy_users_col = None
legacy_vehicles_col = None
user_sync_task = None
users_last_sync_at = None
user_trip_stats_cache = None
user_trip_stats_cache_at = None
USER_TRIP_STATS_CACHE_TTL_SECONDS = int(os.environ.get("USER_TRIP_STATS_CACHE_TTL_SECONDS", "120"))

mongo_uri = os.environ.get("MONGO_URI")
if mongo_uri:
    try:
        mongo_client = MongoClient(mongo_uri)
        mongo_db_name = os.environ.get("MONGO_DB_NAME", "TutemIq")
        mongo_db = mongo_client[mongo_db_name]

        mongo_drivers_col = mongo_db["drivers"]
        mongo_users_col = mongo_db["users"]
        mongo_attendance_col = mongo_db["attendance"]
        mongo_trip_analysis_col = mongo_db["trip_analysis"]

        # Keep legacy collections available for one-time migration from the old source database.
        legacy_db = mongo_client["tutemprod"]
        legacy_users_col = legacy_db["users"]
        legacy_vehicles_col = legacy_db["drivervehicledetails"]
        legacy_riderequests_col = legacy_db["riderequests"]
        mongo_route_col = legacy_db["vehiclerouteiitbs"]
        mongo_location_col = legacy_db["driverlocationstatuses"]

        try:
            legacy_riderequests_col.create_index("userId")
        except Exception:
            pass

        try:
            legacy_riderequests_col.create_index([("userId", 1), ("status", 1)])
        except Exception:
            pass

        try:
            mongo_users_col.create_index("userId", unique=True)
        except Exception:
            # Index creation failures should not block API startup.
            pass

        try:
            mongo_trip_analysis_col.create_index("snapshotDate", unique=True)
        except Exception:
            pass
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


def get_trip_id_candidates(value):
    candidates = []
    if value is None:
        return candidates

    value_str = str(value).strip()
    if not value_str:
        return candidates

    candidates.append(value_str)

    try:
        candidates.append(ObjectId(value_str))
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


def find_user_document(user_id):
    if legacy_users_col is None:
        return None

    for candidate in get_trip_id_candidates(user_id):
        if isinstance(candidate, ObjectId):
            user = legacy_users_col.find_one({"_id": candidate})
            if user:
                return user

        user = legacy_users_col.find_one({"userId": str(candidate)})
        if user:
            return user
    return None


def normalize_trip_status(value):
    status = str(value or "").strip().lower()

    if status in {"endtrip", "completed", "complete", "done", "tripcompleted"}:
        return "completed"
    if status.startswith("cancel") or status in {"rejected", "failed"}:
        return "cancelled"
    if status in {"started", "ongoing", "active", "inprogress", "ontrip"}:
        return "ongoing"
    return status or "unknown"


def get_trip_time_value(trip):
    for key in ("completedAt", "cancelledAt", "updatedAt", "createdAt", "startedAt", "reachedDestinationAt", "onTripAt", "driverReachedAt"):
        value = trip.get(key)
        if value:
            return value
    return None


def trip_list_item(trip):
    return {
        "tripId": str(trip.get("_id")),
        "driverId": str(trip.get("driverId") or ""),
        "userId": str(trip.get("userId") or ""),
        "originName": trip.get("originName") or "",
        "destName": trip.get("destName") or "",
        "date": serialize_mongo_value(get_trip_time_value(trip)),
        "status": normalize_trip_status(trip.get("status")),
        "createdAt": serialize_mongo_value(trip.get("createdAt")),
        "updatedAt": serialize_mongo_value(trip.get("updatedAt")),
    }


def build_trip_query(user_id=None, driver_id=None, status=None):
    query_parts = []

    if user_id is not None:
        user_candidates = get_trip_id_candidates(user_id)
        if user_candidates:
            query_parts.append({"userId": {"$in": user_candidates}})

    if driver_id is not None:
        driver_candidates = get_trip_id_candidates(driver_id)
        if driver_candidates:
            query_parts.append({"driverId": {"$in": driver_candidates}})

    if status:
        query_parts.append({"status": str(status)})

    return {"$and": query_parts} if query_parts else {}


def compute_trip_stats(query):
    if legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="Trip collection not configured.")

    total_trips = legacy_riderequests_col.count_documents(query)

    completed_statuses = ["endtrip", "completed", "complete", "done", "tripcompleted"]
    completed_query = dict(query)
    completed_query["status"] = {"$in": completed_statuses}
    successful_trips = legacy_riderequests_col.count_documents(completed_query)

    return {
        "totalTrips": total_trips,
        "successfulTrips": successful_trips,
        "cancelledOrIncompleteTrips": max(0, total_trips - successful_trips),
    }


def build_user_trip_stats_map():
    if legacy_riderequests_col is None:
        return {}

    pipeline = [
        {"$match": {"userId": {"$ne": None}}},
        {
            "$group": {
                "_id": "$userId",
                "totalTrips": {"$sum": 1},
                "successfulTrips": {
                    "$sum": {
                        "$cond": [
                            {
                                "$in": [
                                    {"$toLower": {"$trim": {"input": {"$ifNull": ["$status", ""]}}}},
                                    ["endtrip", "completed", "complete", "done", "tripcompleted"],
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
            }
        },
    ]

    stats_map = {}
    for row in legacy_riderequests_col.aggregate(pipeline, allowDiskUse=True):
        user_id = str(row.get("_id") or "").strip()
        if not user_id:
            continue

        total_trips = int(row.get("totalTrips") or 0)
        successful_trips = int(row.get("successfulTrips") or 0)
        stats_map[user_id] = {
            "totalTrips": total_trips,
            "successfulTrips": successful_trips,
            "cancelledOrIncompleteTrips": max(0, total_trips - successful_trips),
        }

    return stats_map


def get_cached_user_trip_stats_map(force_refresh=False):
    global user_trip_stats_cache
    global user_trip_stats_cache_at

    if legacy_riderequests_col is None:
        return {}

    now_utc = datetime.now(timezone.utc)
    cache_age_seconds = None
    if user_trip_stats_cache_at is not None:
        cache_age_seconds = (now_utc - user_trip_stats_cache_at).total_seconds()

    if (
        not force_refresh
        and user_trip_stats_cache is not None
        and cache_age_seconds is not None
        and cache_age_seconds < USER_TRIP_STATS_CACHE_TTL_SECONDS
    ):
        return user_trip_stats_cache

    user_trip_stats_cache = build_user_trip_stats_map()
    user_trip_stats_cache_at = now_utc
    return user_trip_stats_cache


def fetch_trips_for_query(user_id=None, driver_id=None, status=None, limit=200):
    if legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="Trip collection not configured.")

    query = build_trip_query(user_id=user_id, driver_id=driver_id, status=status)

    cursor = legacy_riderequests_col.find(query).sort("createdAt", -1).limit(max(1, min(int(limit or 200), 500)))
    return [serialize_mongo_doc(trip) for trip in cursor]


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


def parse_mongo_datetime(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    value_str = str(value).strip()
    if not value_str:
        return None

    try:
        parsed = datetime.fromisoformat(value_str.replace("Z", "+00:00"))
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def to_iso_string(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    value_str = str(value).strip()
    return value_str or None


def get_trip_created_at(trip):
    return parse_mongo_datetime(trip.get("createdAt")) or parse_mongo_datetime(get_trip_time_value(trip))


def build_trip_analysis_snapshot(reference_time=None):
    if legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="Trip collection not configured.")

    now_utc = reference_time or datetime.now(timezone.utc)
    today_date = now_utc.date()

    daily_total = 0
    daily_active = 0
    daily_completed = 0
    daily_cancelled_or_incompleted = 0

    overall_total = 0
    overall_successful = 0
    overall_cancelled = 0

    projection = {
        "status": 1,
        "createdAt": 1,
        "updatedAt": 1,
        "startedAt": 1,
        "completedAt": 1,
        "cancelledAt": 1,
        "onTripAt": 1,
        "driverReachedAt": 1,
        "reachedDestinationAt": 1,
    }

    for trip in legacy_riderequests_col.find({}, projection):
        overall_total += 1
        normalized_status = normalize_trip_status(trip.get("status"))

        if normalized_status == "completed":
            overall_successful += 1
        elif normalized_status == "cancelled":
            overall_cancelled += 1

        created_at = get_trip_created_at(trip)
        if not created_at or created_at.date() != today_date:
            continue

        daily_total += 1
        if normalized_status == "ongoing":
            daily_active += 1
        elif normalized_status == "completed":
            daily_completed += 1
        else:
            daily_cancelled_or_incompleted += 1

    return {
        "snapshotDate": today_date.isoformat(),
        "generatedAt": now_utc.isoformat(),
        "source": "tutemprod.riderequests",
        "daily": {
            "totalTripsToday": daily_total,
            "activeTrips": daily_active,
            "completedTripsToday": daily_completed,
            "cancelledOrIncompletedTripsToday": daily_cancelled_or_incompleted,
        },
        "past": {
            "overallTrips": overall_total,
            "successfulTrips": overall_successful,
            "cancelledTrips": overall_cancelled,
        },
    }


def save_trip_analysis_snapshot(snapshot):
    if mongo_trip_analysis_col is None:
        raise HTTPException(status_code=500, detail="Trip analysis collection not configured.")

    mongo_trip_analysis_col.update_one(
        {"snapshotDate": snapshot.get("snapshotDate")},
        {"$set": snapshot},
        upsert=True,
    )
    return snapshot


def build_today_trip_briefs(limit=200):
    if legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="Trip collection not configured.")

    today_date = datetime.now(timezone.utc).date()
    max_items = max(1, min(int(limit or 200), 500))

    projection = {
        "userId": 1,
        "driverId": 1,
        "userName": 1,
        "driverName": 1,
        "status": 1,
        "originName": 1,
        "destName": 1,
        "destinationName": 1,
        "createdAt": 1,
        "updatedAt": 1,
        "startedAt": 1,
        "completedAt": 1,
        "cancelledAt": 1,
        "onTripAt": 1,
        "driverReachedAt": 1,
        "reachedDestinationAt": 1,
    }

    items = []

    cursor = legacy_riderequests_col.find({}, projection).sort("createdAt", -1).limit(5000)
    for trip in cursor:
        created_at = get_trip_created_at(trip)
        if not created_at or created_at.date() != today_date:
            continue

        status_normalized = normalize_trip_status(trip.get("status"))

        user_name = str(trip.get("userName") or "").strip()
        if not user_name:
            user_doc = find_user_document(trip.get("userId"))
            if user_doc:
                user_name = str(user_doc.get("name") or "").strip()

        driver_name = str(trip.get("driverName") or "").strip()
        if not driver_name:
            driver_doc = find_driver_document(trip.get("driverId"))
            if driver_doc:
                driver_name = str(driver_doc.get("name") or "").strip()

        items.append(
            {
                "tripId": str(trip.get("_id") or ""),
                "userId": str(trip.get("userId") or ""),
                "userName": user_name or "Unknown User",
                "driverId": str(trip.get("driverId") or ""),
                "driverName": driver_name or "Unknown Driver",
                "isCompleted": status_normalized == "completed",
                "status": status_normalized,
                "originName": str(trip.get("originName") or trip.get("origin") or ""),
                "destinationName": str(trip.get("destName") or trip.get("destinationName") or trip.get("destination") or ""),
                "createdAt": serialize_mongo_value(created_at),
            }
        )

        if len(items) >= max_items:
            break

    return items


def to_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def parse_lat_lng(value):
    if value is None:
        return None

    if isinstance(value, dict):
        for lat_key, lng_key in (
            ("lat", "lng"),
            ("lat", "lon"),
            ("lat", "longitude"),
            ("latitude", "longitude"),
            ("latitude", "lng"),
            ("latitude", "lon"),
        ):
            lat = to_float(value.get(lat_key))
            lng = to_float(value.get(lng_key))
            if lat is not None and lng is not None and -90 <= lat <= 90 and -180 <= lng <= 180:
                return lat, lng

        coordinates = value.get("coordinates")
        parsed = parse_lat_lng(coordinates)
        if parsed:
            return parsed

        return None

    if isinstance(value, (list, tuple)) and len(value) >= 2:
        first = to_float(value[0])
        second = to_float(value[1])
        if first is None or second is None:
            return None

        if -90 <= first <= 90 and -180 <= second <= 180:
            return first, second

        if -180 <= first <= 180 and -90 <= second <= 90:
            return second, first

        return None

    if isinstance(value, str) and "," in value:
        parts = [part.strip() for part in value.split(",")]
        if len(parts) >= 2:
            first = to_float(parts[0])
            second = to_float(parts[1])
            if first is not None and second is not None:
                if -90 <= first <= 90 and -180 <= second <= 180:
                    return first, second
                if -180 <= first <= 180 and -90 <= second <= 90:
                    return second, first

    return None


def get_trip_point(trip, point_type):
    if point_type == "origin":
        object_candidates = (
            "originCoordinates",
            "originCoordinate",
            "originLocation",
            "originPoint",
            "pickupLocation",
            "pickUpLocation",
            "pickupCoordinates",
            "sourceCoordinates",
            "sourceLocation",
        )
        lat_candidates = ("originLat", "originLatitude", "pickupLat", "pickupLatitude", "sourceLat", "sourceLatitude")
        lng_candidates = ("originLng", "originLon", "originLong", "originLongitude", "pickupLng", "pickupLon", "pickupLongitude", "sourceLng", "sourceLon", "sourceLongitude")
    else:
        object_candidates = (
            "destCoordinates",
            "destinationCoordinates",
            "destinationCoordinate",
            "destinationLocation",
            "destLocation",
            "dropLocation",
            "dropCoordinates",
        )
        lat_candidates = ("destLat", "destLatitude", "destinationLat", "destinationLatitude", "dropLat", "dropLatitude")
        lng_candidates = ("destLng", "destLon", "destLong", "destLongitude", "destinationLng", "destinationLon", "destinationLongitude", "dropLng", "dropLon", "dropLongitude")

    for key in object_candidates:
        parsed = parse_lat_lng(trip.get(key))
        if parsed:
            return parsed

    lat_value = None
    lng_value = None

    for key in lat_candidates:
        lat_value = to_float(trip.get(key))
        if lat_value is not None:
            break

    for key in lng_candidates:
        lng_value = to_float(trip.get(key))
        if lng_value is not None:
            break

    if lat_value is not None and lng_value is not None and -90 <= lat_value <= 90 and -180 <= lng_value <= 180:
        return lat_value, lng_value

    return None


def build_trip_visual_analytics(days=120, limit=20000):
    if legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="Trip collection not configured.")

    max_limit = max(500, min(int(limit or 20000), 50000))
    days_window = max(7, min(int(days or 120), 730))

    now_utc = datetime.now(timezone.utc)
    min_date = (now_utc - timedelta(days=days_window - 1)).date()

    projection = {
        "status": 1,
        "createdAt": 1,
        "updatedAt": 1,
        "startedAt": 1,
        "completedAt": 1,
        "cancelledAt": 1,
        "onTripAt": 1,
        "driverReachedAt": 1,
        "reachedDestinationAt": 1,
        "originName": 1,
        "origin": 1,
        "destName": 1,
        "destinationName": 1,
        "destination": 1,
        "originCoordinates": 1,
        "originCoordinate": 1,
        "originLocation": 1,
        "originPoint": 1,
        "pickupLocation": 1,
        "pickUpLocation": 1,
        "pickupCoordinates": 1,
        "sourceCoordinates": 1,
        "sourceLocation": 1,
        "destCoordinates": 1,
        "destinationCoordinates": 1,
        "destinationCoordinate": 1,
        "destinationLocation": 1,
        "destLocation": 1,
        "dropLocation": 1,
        "dropCoordinates": 1,
        "originLat": 1,
        "originLatitude": 1,
        "originLng": 1,
        "originLon": 1,
        "originLong": 1,
        "originLongitude": 1,
        "pickupLat": 1,
        "pickupLatitude": 1,
        "pickupLng": 1,
        "pickupLon": 1,
        "pickupLongitude": 1,
        "sourceLat": 1,
        "sourceLatitude": 1,
        "sourceLng": 1,
        "sourceLon": 1,
        "sourceLongitude": 1,
        "destLat": 1,
        "destLatitude": 1,
        "destLng": 1,
        "destLon": 1,
        "destLong": 1,
        "destLongitude": 1,
        "destinationLat": 1,
        "destinationLatitude": 1,
        "destinationLng": 1,
        "destinationLon": 1,
        "destinationLongitude": 1,
        "dropLat": 1,
        "dropLatitude": 1,
        "dropLng": 1,
        "dropLon": 1,
        "dropLongitude": 1,
    }

    daily_counts = defaultdict(lambda: {"trips": 0, "successful": 0, "cancelled": 0})
    od_counts = defaultdict(int)
    origin_points = defaultdict(lambda: {"name": "", "lat": 0.0, "lng": 0.0, "count": 0})
    destination_points = defaultdict(lambda: {"name": "", "lat": 0.0, "lng": 0.0, "count": 0})
    route_points = defaultdict(lambda: {"originName": "", "destinationName": "", "count": 0, "originLat": 0.0, "originLng": 0.0, "destinationLat": 0.0, "destinationLng": 0.0})

    scanned = 0

    cursor = legacy_riderequests_col.find({}, projection).sort("createdAt", -1).limit(max_limit)
    for trip in cursor:
        scanned += 1
        created_at = get_trip_created_at(trip)
        if not created_at:
            continue

        trip_date = created_at.date()
        if trip_date < min_date:
            continue

        status_normalized = normalize_trip_status(trip.get("status"))
        date_key = trip_date.isoformat()

        daily_counts[date_key]["trips"] += 1
        if status_normalized == "completed":
            daily_counts[date_key]["successful"] += 1
        elif status_normalized == "cancelled":
            daily_counts[date_key]["cancelled"] += 1

        origin_name = str(trip.get("originName") or trip.get("origin") or "Unknown Origin").strip() or "Unknown Origin"
        destination_name = str(trip.get("destName") or trip.get("destinationName") or trip.get("destination") or "Unknown Destination").strip() or "Unknown Destination"
        od_counts[(origin_name, destination_name)] += 1

        origin_point = get_trip_point(trip, "origin")
        if origin_point:
            rounded = (round(origin_point[0], 4), round(origin_point[1], 4), origin_name)
            origin_points[rounded]["name"] = origin_name
            origin_points[rounded]["lat"] = round(origin_point[0], 4)
            origin_points[rounded]["lng"] = round(origin_point[1], 4)
            origin_points[rounded]["count"] += 1

        destination_point = get_trip_point(trip, "destination")
        if destination_point:
            rounded = (round(destination_point[0], 4), round(destination_point[1], 4), destination_name)
            destination_points[rounded]["name"] = destination_name
            destination_points[rounded]["lat"] = round(destination_point[0], 4)
            destination_points[rounded]["lng"] = round(destination_point[1], 4)
            destination_points[rounded]["count"] += 1

        if origin_point and destination_point:
            route_key = (
                origin_name,
                destination_name,
                round(origin_point[0], 4),
                round(origin_point[1], 4),
                round(destination_point[0], 4),
                round(destination_point[1], 4),
            )
            route_points[route_key]["originName"] = origin_name
            route_points[route_key]["destinationName"] = destination_name
            route_points[route_key]["originLat"] = round(origin_point[0], 4)
            route_points[route_key]["originLng"] = round(origin_point[1], 4)
            route_points[route_key]["destinationLat"] = round(destination_point[0], 4)
            route_points[route_key]["destinationLng"] = round(destination_point[1], 4)
            route_points[route_key]["count"] += 1

    ordered_dates = sorted(daily_counts.keys())
    cumulative_trips = 0
    cumulative_successful = 0
    cumulative_cancelled = 0
    trend = []

    for date_key in ordered_dates:
        day_info = daily_counts[date_key]
        cumulative_trips += day_info["trips"]
        cumulative_successful += day_info["successful"]
        cumulative_cancelled += day_info["cancelled"]
        trend.append(
            {
                "date": date_key,
                "dailyTrips": day_info["trips"],
                "dailySuccessfulTrips": day_info["successful"],
                "dailyCancelledTrips": day_info["cancelled"],
                "cumulativeTrips": cumulative_trips,
                "cumulativeSuccessfulTrips": cumulative_successful,
                "cumulativeCancelledTrips": cumulative_cancelled,
            }
        )

    active_days = len(ordered_dates)
    avg_trips_per_day = (cumulative_trips / active_days) if active_days > 0 else 0

    od_matrix = [
        {"originName": origin, "destinationName": destination, "count": count}
        for (origin, destination), count in sorted(od_counts.items(), key=lambda item: item[1], reverse=True)
    ][:40]

    top_origin_points = sorted(origin_points.values(), key=lambda item: item["count"], reverse=True)[:120]
    top_destination_points = sorted(destination_points.values(), key=lambda item: item["count"], reverse=True)[:120]
    top_routes = sorted(route_points.values(), key=lambda item: item["count"], reverse=True)[:30]

    return {
        "generatedAt": now_utc.isoformat(),
        "windowDays": days_window,
        "scannedTrips": scanned,
        "summary": {
            "activeDays": active_days,
            "avgTripsPerDay": round(avg_trips_per_day, 2),
            "totalTripsInWindow": cumulative_trips,
        },
        "trend": trend,
        "od": {
            "matrix": od_matrix,
            "origins": top_origin_points,
            "destinations": top_destination_points,
            "routes": top_routes,
        },
    }


def sync_legacy_users_to_mongo_once() -> dict:
    global users_last_sync_at
    global user_trip_stats_cache
    global user_trip_stats_cache_at

    if mongo_client is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not configured.")

    if legacy_users_col is None or mongo_users_col is None:
        raise HTTPException(status_code=500, detail="MongoDB collections not configured.")

    role_query = {
        "$or": [
            {"userRole": {"$regex": "^user$", "$options": "i"}},
            {"userrole": {"$regex": "^user$", "$options": "i"}},
            {"role": {"$regex": "^user$", "$options": "i"}},
        ]
    }

    source_users = list(legacy_users_col.find(role_query))
    upserted = 0

    for user in source_users:
        user_id = str(user.get("_id") or "").strip()
        if not user_id:
            continue

        is_verified = user.get("isVerified")
        if isinstance(is_verified, bool):
            verification_status = "verified" if is_verified else "pending"
        else:
            verification_status = (
                user.get("verificationStatus")
                or user.get("verification_status")
                or user.get("kycStatus")
                or user.get("kyc_status")
                or "pending"
            )

        payload = {
            "userId": user_id,
            "name": user.get("name") or "Unknown User",
            "email": user.get("email") or "",
            "phone": user.get("phone") or user.get("phoneNumber") or "",
            "dob": to_iso_string(user.get("dateOfBirth") or user.get("dob")),
            "gender": user.get("gender") or "",
            "createdAt": to_iso_string(user.get("createdAt")),
            "rating": user.get("rating") if user.get("rating") is not None else 0,
            "verificationStatus": str(verification_status),
            "isVerified": True if str(verification_status).lower() == "verified" else False,
            "address": user.get("address") or "",
            "deviceId": user.get("deviceId") or user.get("device_id") or "",
            "sourceUpdatedAt": to_iso_string(user.get("updatedAt")),
            "syncedAt": datetime.now(timezone.utc).isoformat(),
        }

        mongo_users_col.update_one(
            {"userId": user_id},
            {"$set": payload},
            upsert=True,
        )
        upserted += 1

    users_last_sync_at = datetime.now(timezone.utc)
    user_trip_stats_cache = None
    user_trip_stats_cache_at = None

    return {
        "status": "success",
        "source_count": len(source_users),
        "synced_count": upserted,
        "last_synced_at": users_last_sync_at.isoformat(),
    }


async def auto_sync_users_loop():
    interval_seconds = int(os.environ.get("SYNC_USERS_INTERVAL_SECONDS", "300"))
    # Run an initial sync quickly after startup.
    await asyncio.sleep(2)

    while True:
        try:
            result = sync_legacy_users_to_mongo_once()
            print(
                f"[users-sync] Synced {result.get('synced_count', 0)} users at {result.get('last_synced_at', 'n/a')}"
            )
        except HTTPException as sync_err:
            print(f"[users-sync] HTTP error: {sync_err.detail}")
        except Exception as sync_err:
            print(f"[users-sync] Unexpected error: {sync_err}")

        await asyncio.sleep(max(60, interval_seconds))


@app.on_event("startup")
async def start_background_sync_tasks():
    global user_sync_task

    if mongo_client is None or legacy_users_col is None or mongo_users_col is None:
        return

    if user_sync_task is None or user_sync_task.done():
        user_sync_task = asyncio.create_task(auto_sync_users_loop())


@app.on_event("shutdown")
async def stop_background_sync_tasks():
    global user_sync_task

    if user_sync_task and not user_sync_task.done():
        user_sync_task.cancel()
        try:
            await user_sync_task
        except asyncio.CancelledError:
            pass
    user_sync_task = None


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


@app.post("/api/sync-users")
async def sync_legacy_users_to_mongo():
    try:
        return sync_legacy_users_to_mongo_once()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"User sync error: {str(e)}")


@app.get("/api/users")
async def list_users():
    if mongo_client is None or mongo_users_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        users = [serialize_mongo_doc(user) for user in mongo_users_col.find({})]
        trip_stats_map = get_cached_user_trip_stats_map()

        for user in users:
            user_id = str(user.get("userId") or "").strip()
            stats = trip_stats_map.get(user_id, {"totalTrips": 0, "successfulTrips": 0, "cancelledOrIncompleteTrips": 0})
            user.update(stats)

        users.sort(key=lambda item: item.get("totalTrips", 0), reverse=True)
        return {"status": "success", "total_users": len(users), "data": users, "last_synced_at": users_last_sync_at.isoformat() if users_last_sync_at else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")


@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    if mongo_client is None or mongo_users_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        user = mongo_users_col.find_one({"userId": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        serialized_user = serialize_mongo_doc(user)
        stats = compute_trip_stats(build_trip_query(user_id=user_id))
        serialized_user.update(stats)
        return {"status": "success", "data": serialized_user}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user: {str(e)}")


@app.get("/api/users/{user_id}/trips")
async def get_user_trips(user_id: str, limit: int = 100):
    if mongo_client is None or legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        stats = compute_trip_stats(build_trip_query(user_id=user_id))
        trips = fetch_trips_for_query(user_id=user_id, limit=limit)
        return {
            "status": "success",
            "total_trips": stats["totalTrips"],
            "successful_trips": stats["successfulTrips"],
            "cancelled_or_incomplete_trips": stats["cancelledOrIncompleteTrips"],
            "data": [trip_list_item(trip) for trip in trips],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user trips: {str(e)}")


@app.get("/api/drivers/{driver_id}/trips")
async def get_driver_trips(driver_id: str, limit: int = 100):
    if mongo_client is None or legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        trips = fetch_trips_for_query(driver_id=driver_id, limit=limit)
        return {"status": "success", "total_trips": len(trips), "data": [trip_list_item(trip) for trip in trips]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching driver trips: {str(e)}")


@app.get("/api/trips/{trip_id}")
async def get_trip(trip_id: str):
    if mongo_client is None or legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        trip = legacy_riderequests_col.find_one({"_id": ObjectId(trip_id)})
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found.")
        serialized = serialize_mongo_doc(trip)
        serialized["statusNormalized"] = normalize_trip_status(serialized.get("status"))
        return {"status": "success", "data": serialized}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching trip: {str(e)}")


@app.post("/api/tutem/trip-analysis/sync")
async def sync_tutem_trip_analysis():
    if mongo_client is None or legacy_riderequests_col is None or mongo_trip_analysis_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        snapshot = build_trip_analysis_snapshot()
        saved = save_trip_analysis_snapshot(snapshot)
        return {"status": "success", "data": serialize_mongo_doc(saved)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing trip analysis: {str(e)}")


@app.get("/api/tutem/trip-analysis/latest")
async def get_latest_tutem_trip_analysis():
    if mongo_client is None or mongo_trip_analysis_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        snapshot = mongo_trip_analysis_col.find_one({}, sort=[("snapshotDate", -1)])
        if not snapshot:
            raise HTTPException(status_code=404, detail="No trip analysis snapshot found.")
        return {"status": "success", "data": serialize_mongo_doc(snapshot)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching latest trip analysis: {str(e)}")


@app.get("/api/tutem/trip-analysis/today-trips")
async def get_today_trip_briefs(limit: int = 200):
    if mongo_client is None or legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        items = build_today_trip_briefs(limit=limit)
        return {"status": "success", "count": len(items), "data": items}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching today's trip briefs: {str(e)}")


@app.get("/api/tutem/trip-analysis/visuals")
async def get_trip_analysis_visuals(days: int = 120, limit: int = 20000):
    if mongo_client is None or legacy_riderequests_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        visuals = build_trip_visual_analytics(days=days, limit=limit)
        return {"status": "success", "data": visuals}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building trip visuals: {str(e)}")


@app.get("/api/users/count")
async def count_users():
    if mongo_client is None or mongo_users_col is None:
        raise HTTPException(status_code=500, detail="MongoDB connection not established.")

    try:
        return {"status": "success", "count": mongo_users_col.count_documents({}), "last_synced_at": users_last_sync_at.isoformat() if users_last_sync_at else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error counting users: {str(e)}")

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
    mime_type = payload.get("mimeType") or "image/jpeg"
    drivers = payload.get("drivers") or []

    if not image_base64:
        raise HTTPException(status_code=400, detail="imageBase64 is required")

    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    lovable_api_key = os.environ.get("LOVABLE_API_KEY")

    if gemini_api_key and gemini_api_key.upper().startswith("PASTE_YOUR_"):
        gemini_api_key = None
    if lovable_api_key and lovable_api_key.upper().startswith("PASTE_YOUR_"):
        lovable_api_key = None

    if not gemini_api_key and not lovable_api_key:
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

    content = ""

    # Preferred path: call Gemini directly when GEMINI_API_KEY is set.
    if gemini_api_key:
        gemini_body = {
            "contents": [
                {
                    "parts": [
                        {"text": system_prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": image_base64,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
            },
        }

        gemini_req = urllib_request.Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}",
            data=json.dumps(gemini_body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib_request.urlopen(gemini_req, timeout=90) as response:
                gemini_payload = json.loads(response.read().decode("utf-8"))
            content = (
                gemini_payload.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
        except urllib_error.HTTPError as error:
            error_body = error.read().decode("utf-8", errors="ignore")
            try:
                parsed_error = json.loads(error_body) if error_body else {}
                message = parsed_error.get("error", {}).get("message")
            except Exception:
                parsed_error = {}
                message = None

            if error.code == 429:
                raise HTTPException(status_code=429, detail=message or "Gemini quota exceeded. Please check billing/limits and retry.")

            raise HTTPException(status_code=500, detail=message or error_body or "Gemini extraction failed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Fallback path for Lovable gateway if GEMINI_API_KEY is unavailable.
    elif lovable_api_key:
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
                            "image_url": {"url": f"data:{mime_type};base64,{image_base64}"},
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
                "Authorization": f"Bearer {lovable_api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib_request.urlopen(req, timeout=90) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
            content = response_payload.get("choices", [{}])[0].get("message", {}).get("content", "")
        except urllib_error.HTTPError as error:
            error_body = error.read().decode("utf-8", errors="ignore")
            if error.code == 429:
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again in a moment.")
            if error.code == 402:
                raise HTTPException(status_code=402, detail="AI credits exhausted. Please add funds in Settings > Workspace > Usage.")
            if "1010" in (error_body or ""):
                raise HTTPException(status_code=500, detail="Lovable gateway rejected the key/token (code 1010). Use GEMINI_API_KEY for direct Gemini calls.")
            raise HTTPException(status_code=500, detail=error_body or "AI extraction failed")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    json_str = content.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()

    try:
        parsed = json.loads(json_str)
    except Exception:
        raise HTTPException(status_code=422, detail={"error": "Could not parse AI response", "raw": content})

    return parsed


# mongo_route_col = mongo_db["vehiclerouteiitbs"]
# mongo_location_col = mongo_db["driverlocationstatuses"]

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

    time_threshold = datetime.now(timezone.utc) - timedelta(minutes=7)
    count = mongo_location_col.count_documents({})
    print("TOTAL DOCS IN COLLECTION:", count)
    sample = mongo_location_col.find_one({"updatedAt": {"$exists": True}})
    # if sample:
        
    #     print(f"DEBUG: DB Sample Time: {sample.get('updatedAt')} | Local Threshold: {time_threshold}")

    active_locations = []
    for location in mongo_location_col.find({}, {"driverId": 1, "location": 1, "updatedAt": 1}):
        updated_at = parse_mongo_datetime(location.get("updatedAt"))
        # print(f"Driver: {location.get('driverId')} | Raw: {location.get('updatedAt')} | Parsed: {updated_at} | Threshold: {time_threshold}")
        if updated_at is None or updated_at < time_threshold:
            continue
        active_locations.append(location)
    # print("NOW:", datetime.now(timezone.utc))
    # print(f"🔍 DEBUG: Found {len(active_locations)} locations updated in the last 7 minutes.")

    merged_drivers = []
    
    for loc in active_locations:
        driver_id = loc.get("driverId")
        if not driver_id: continue
            
        # Coordinate Parsing Logic (Keeping your robust try/except)
        lat, lng = 0.0, 0.0
        try:
            loc_obj = loc.get("location", {})
            if isinstance(loc_obj, dict) and "coordinates" in loc_obj:
                coords = loc_obj.get("coordinates", [0.0, 0.0])
                lat, lng = float(coords[0]), float(coords[1])
            elif isinstance(loc_obj, dict) and "latitude" in loc_obj:
                lat = float(loc_obj.get("latitude", 0))
                lng = float(loc_obj.get("longitude", 0))
        except (ValueError, TypeError, IndexError):
            continue

        str_id = str(driver_id)
        try:
            obj_id = ObjectId(str_id)
        except:
            continue

        driver_info = find_driver_document(str_id) or {}
        route_info = mongo_route_col.find_one({"driverId": str_id}) or {}
        
        org = driver_info.get("organization")
        
        if org != "IITB Campus Auto":
            # If this prints for everyone, your data isn't where you think it is!
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
            "vehicleRoute": route_info.get("colorName", "Not Assigned"),
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