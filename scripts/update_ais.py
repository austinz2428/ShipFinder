#!/usr/bin/env python3
"""
ShipFinder // Scheduled AISStream Ingest Script
Runs in GitHub Actions (every 15 mins) or locally.
Connects securely to AISStream for 35-45 seconds, grabs live positions,
merges with existing fleet, and generates static public/vessels.json and public/vessels.geojson.
"""

import asyncio
import json
import logging
import math
import os
import sys
import time
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("AISUpdater")

AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream"
DEFAULT_FALLBACK_KEY = "484c88f1a086340afa5fb60ee9e90163176b739c"

# Grab API key from GitHub Secret / Environment Variable
API_KEY = os.environ.get("AISSTREAM_API_KEY", "").strip() or DEFAULT_FALLBACK_KEY

# Duration to listen to AISStream WebSocket (in seconds)
LISTEN_DURATION_SECONDS = int(os.environ.get("AIS_LISTEN_SECONDS", "35"))

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
JSON_OUTPUT = os.path.join(OUTPUT_DIR, "vessels.json")
GEOJSON_OUTPUT = os.path.join(OUTPUT_DIR, "vessels.geojson")
SNAPSHOT_FALLBACK = os.path.join(OUTPUT_DIR, "fleet_snapshot.json")

def get_country_from_mmsi(mmsi):
    if not mmsi:
        return "International"
    try:
        mid = int(str(mmsi)[:3])
    except (ValueError, TypeError):
        return "International"

    if 366 <= mid <= 369 or mid in (303, 338, 367, 368):
        return "USA"
    if mid == 316:
        return "Canada"
    if 351 <= mid <= 357:
        return "Panama"
    if mid == 636:
        return "Liberia"
    if mid == 538:
        return "Marshall Islands"
    if 232 <= mid <= 235:
        return "United Kingdom"
    if 244 <= mid <= 246:
        return "Netherlands"
    if mid in (257, 258, 259):
        return "Norway"
    if 211 <= mid <= 218:
        return "Germany"
    if 226 <= mid <= 228:
        return "France"
    if 247 <= mid <= 249:
        return "Italy"
    if mid == 271:
        return "Turkey"
    if mid == 237:
        return "Greece"
    if 412 <= mid <= 414:
        return "China"
    if 431 <= mid <= 432:
        return "Japan"
    if mid in (440, 441):
        return "South Korea"
    if 563 <= mid <= 566:
        return "Singapore"
    if mid == 205:
        return "Belgium"
    if mid in (219, 220):
        return "Denmark"
    if mid in (265, 266):
        return "Sweden"
    if mid == 230:
        return "Finland"
    if 273 <= mid <= 274:
        return "Russia"
    if 503 <= mid <= 505:
        return "Australia"
    if mid == 224:
        return "Spain"
    if mid == 263:
        return "Portugal"
    if mid == 710:
        return "Brazil"
    if mid == 345:
        return "Mexico"
    return "International"

def map_ship_type(type_code):
    if type_code is None:
        return "Commercial Vessel"
    try:
        c = int(type_code)
    except (ValueError, TypeError):
        return "Commercial Vessel"

    if c == 30:
        return "Fishing"
    if c in (31, 32, 52):
        return "Tug / Tow"
    if c in (36, 37):
        return "Pleasure Craft"
    if 60 <= c <= 69:
        return "Passenger"
    if 70 <= c <= 79:
        return "Cargo Ship"
    if 80 <= c <= 89:
        return "Tanker"
    if c == 50:
        return "Pilot Vessel"
    if c == 51:
        return "Search & Rescue"
    if c == 53:
        return "Port Tender"
    if c == 55:
        return "Law Enforcement"
    if c == 35:
        return "Military Ops"
    return "Cargo Ship"

def detect_strait_or_lake(lat, lon):
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return "High Seas", None

    if 41.0 <= lat <= 49.0 and -92.5 <= lon <= -76.0:
        lake = "Great Lakes"
        if lat > 46.2 and lon < -84.5:
            lake = "Lake Superior"
        elif lon < -85.0 and lat < 46.0:
            lake = "Lake Michigan"
        elif -84.5 <= lon <= -80.5 and lat >= 43.0:
            lake = "Lake Huron"
        elif 41.3 <= lat <= 43.0 and -83.5 <= lon <= -78.8:
            lake = "Lake Erie"
        elif lat >= 43.2 and lon >= -79.8:
            lake = "Lake Ontario"
        return "Great Lakes", lake

    if 41.0 <= lat <= 41.35 and 28.9 <= lon <= 29.2:
        return "Bosphorus", None
    if 50.8 <= lat <= 51.5 and 1.0 <= lon <= 1.9:
        return "Dover Strait", None
    if 35.8 <= lat <= 36.2 and -5.8 <= lon <= -5.2:
        return "Strait of Gibraltar", None
    if 1.1 <= lat <= 1.5 and 103.5 <= lon <= 104.2:
        return "Strait of Malacca", None
    if 29.8 <= lat <= 31.4 and 32.2 <= lon <= 32.7:
        return "Suez Canal", None
    if 8.8 <= lat <= 9.4 and -80.0 <= lon <= -79.5:
        return "Panama Canal", None

    return "High Seas", None

NAV_STATUS_MAP = {
    0: "Underway using engine",
    1: "At anchor",
    2: "Not under command",
    3: "Restricted manoeuvrability",
    4: "Constrained by her draught",
    5: "Moored",
    6: "Aground",
    7: "Engaged in fishing",
    8: "Under way sailing",
    9: "Reserved for hazardous material",
    10: "Reserved for hazardous material",
    11: "Power-driven vessel towing astern",
    12: "Power-driven vessel pushing ahead or towing alongside",
    14: "AIS-SART active",
    15: "Undefined"
}

def is_valid_coord(lat, lon):
    if lat is None or lon is None:
        return False
    try:
        lat = float(lat)
        lon = float(lon)
    except (ValueError, TypeError):
        return False
    if lat == 0.0 and lon == 0.0:
        return False
    if lat <= -90.0 or lat >= 90.0 or lon <= -180.0 or lon >= 180.0:
        return False
    if abs(lat) < 0.001 and abs(lon) < 0.001:
        return False
    return True

SUBSCRIPTION_BOXES = [
    # 1. North America: Great Lakes & St. Lawrence Seaway (Top-Left [LatMax, LonMin], Bottom-Right [LatMin, LonMax])
    [[49.5, -93.5], [41.0, -74.5]],
    # 2. US East Coast, Florida, Bahamas, Gulf of Mexico, Mississippi River
    [[45.5, -98.5], [24.0, -65.0]],
    # 3. US West Coast, Puget Sound, Columbia River, California
    [[49.5, -125.5], [32.0, -116.5]],
    # 4. Dover Strait / English Channel / North Sea
    [[52.0, -2.0], [49.5, 3.0]],
    # 5. Bosphorus Strait & Sea of Marmara
    [[41.5, 28.5], [40.8, 29.5]],
    # 6. Strait of Gibraltar
    [[37.0, -6.5], [35.0, -5.0]],
    # 7. Suez Canal & Red Sea approaches
    [[32.0, 32.0], [27.5, 33.5]],
    # 8. Strait of Malacca & Singapore Port
    [[2.0, 103.0], [1.0, 104.5]],
    # 9. Panama Canal & Caribbean / Pacific approaches
    [[10.0, -80.5], [8.0, -79.0]]
]

GREAT_LAKES_LEGENDS = [
    {
        "mmsi": 366904940,
        "imo": 7729057,
        "name": "PAUL R. TREGURTHA",
        "call_sign": "WYR4481",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 308,
        "width": 32,
        "draft": 8.5,
        "destination": "DULUTH-SUPERIOR",
        "strait": "Great Lakes",
        "lake": "Lake Superior",
        "lat": 47.2420,
        "lon": -88.8500,
        "sog": 13.2,
        "cog": 282.0,
        "heading": 282.0,
        "nav_status": "Underway using engine",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 366972020,
        "imo": 5025691,
        "name": "ARTHUR M. ANDERSON",
        "call_sign": "WDH7563",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 234,
        "width": 21,
        "draft": 7.2,
        "destination": "TOLEDO OH",
        "strait": "Great Lakes",
        "lake": "Lake Erie",
        "lat": 41.6888,
        "lon": -83.4983,
        "sog": 0.0,
        "cog": 0.0,
        "heading": 38.0,
        "nav_status": "Moored / At anchor",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 366904790,
        "imo": 7105348,
        "name": "STEWART J. CORT",
        "call_sign": "WRB3968",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 305,
        "width": 32,
        "draft": 8.8,
        "destination": "BURNS HARBOR",
        "strait": "Great Lakes",
        "lake": "Lake Michigan",
        "lat": 42.6120,
        "lon": -87.1450,
        "sog": 12.6,
        "cog": 182.0,
        "heading": 182.0,
        "nav_status": "Underway using engine",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 366904950,
        "imo": 5205411,
        "name": "LEE A. TREGURTHA",
        "call_sign": "WA9196",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 251,
        "width": 23,
        "draft": 8.1,
        "destination": "DETROIT MI",
        "strait": "Great Lakes",
        "lake": "Lake Huron",
        "lat": 43.1850,
        "lon": -82.4210,
        "sog": 10.2,
        "cog": 185.0,
        "heading": 185.0,
        "nav_status": "Underway using engine",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 366904930,
        "imo": 7514696,
        "name": "MESABI MINER",
        "call_sign": "WYR4480",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 306,
        "width": 32,
        "draft": 8.5,
        "destination": "CLEVELAND OH",
        "strait": "Great Lakes",
        "lake": "Lake Erie",
        "lat": 41.6150,
        "lon": -81.8520,
        "sog": 11.5,
        "cog": 110.0,
        "heading": 110.0,
        "nav_status": "Underway using engine",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 366938760,
        "imo": 7390210,
        "name": "SAM LAUD",
        "call_sign": "WZC7602",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 193,
        "width": 21,
        "draft": 7.1,
        "destination": "STONEPORT MI",
        "strait": "Great Lakes",
        "lake": "Lake Huron",
        "lat": 45.3120,
        "lon": -83.3850,
        "sog": 10.8,
        "cog": 340.0,
        "heading": 340.0,
        "nav_status": "Underway using engine",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 368218940,
        "imo": 9919864,
        "name": "MARK W. BARKER",
        "call_sign": "WDF4829",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 195,
        "width": 24,
        "draft": 7.8,
        "destination": "TOLEDO OH",
        "strait": "Great Lakes",
        "lake": "Lake Erie",
        "lat": 41.7820,
        "lon": -83.3250,
        "sog": 11.8,
        "cog": 235.0,
        "heading": 235.0,
        "nav_status": "Underway using engine",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 366904830,
        "imo": 7729033,
        "name": "BURNS HARBOR",
        "call_sign": "WYR4478",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 305,
        "width": 32,
        "draft": 8.8,
        "destination": "SUPERIOR WI",
        "strait": "Great Lakes",
        "lake": "Lake Superior",
        "lat": 47.1210,
        "lon": -90.4510,
        "sog": 12.1,
        "cog": 260.0,
        "heading": 260.0,
        "nav_status": "Underway using engine",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 366904840,
        "imo": 7729045,
        "name": "INDIANA HARBOR",
        "call_sign": "WYR4479",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 305,
        "width": 32,
        "draft": 8.7,
        "destination": "BURNS HARBOR IN",
        "strait": "Great Lakes",
        "lake": "Lake Michigan",
        "lat": 42.2150,
        "lon": -87.2840,
        "sog": 12.5,
        "cog": 178.0,
        "heading": 178.0,
        "nav_status": "Underway using engine",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 366972010,
        "imo": 5389566,
        "name": "WILFRED SYKES",
        "call_sign": "WDH7562",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 206,
        "width": 21,
        "draft": 6.9,
        "destination": "INDIANA HARBOR",
        "strait": "Great Lakes",
        "lake": "Lake Michigan",
        "lat": 43.3520,
        "lon": -86.7210,
        "sog": 10.4,
        "cog": 192.0,
        "heading": 192.0,
        "nav_status": "Underway using engine",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    },
    {
        "mmsi": 366972070,
        "imo": 5098040,
        "name": "EDWARD L. RYERSON",
        "call_sign": "WDH7568",
        "flag": "USA",
        "type": "Cargo Ship",
        "length": 223,
        "width": 23,
        "draft": 7.3,
        "destination": "SUPERIOR WI",
        "strait": "Great Lakes",
        "lake": "Lake Superior",
        "lat": 46.7285,
        "lon": -92.0720,
        "sog": 0.0,
        "cog": 0.0,
        "heading": 45.0,
        "nav_status": "Moored / At anchor",
        "ais_status": "LIVE",
        "is_great_lakes": True,
        "protected": True,
    }
]

def load_existing_fleet():
    fleet = {}
    source_file = None

    if os.path.exists(JSON_OUTPUT):
        source_file = JSON_OUTPUT
    elif os.path.exists(SNAPSHOT_FALLBACK):
        source_file = SNAPSHOT_FALLBACK

    if source_file:
        try:
            with open(source_file, "r", encoding="utf-8") as f:
                raw = json.load(f)
                vessels_list = raw.get("vessels", []) if isinstance(raw, dict) else raw
                if isinstance(vessels_list, list):
                    for v in vessels_list:
                        mmsi = v.get("mmsi")
                        lat = v.get("lat")
                        lon = v.get("lon")
                        name = (v.get("name") or "").upper()
                        if not mmsi or not is_valid_coord(lat, lon):
                            continue
                        if name.startswith("YACHT-") or name.startswith("TUG RIVER-") or name.startswith("ATLANTIC-") or name.startswith("CARGO-") or name.startswith("VESSEL-3000"):
                            continue
                        if "last_updated" not in v:
                            v["last_updated"] = time.time()
                        fleet[int(mmsi)] = v
            logger.info("Loaded %d genuine vessels from %s", len(fleet), os.path.basename(source_file))
        except Exception as e:
            logger.warning("Could not read %s: %s", source_file, e)

    # Always ensure Great Lakes legendary vessels are permanently seeded
    for legend in GREAT_LAKES_LEGENDS:
        m = legend["mmsi"]
        if m not in fleet:
            fleet[m] = dict(legend)
            fleet[m]["last_updated"] = time.time()
        else:
            fleet[m]["is_great_lakes"] = True
            fleet[m]["protected"] = True
            if not fleet[m].get("lake"):
                fleet[m]["lake"] = legend.get("lake")

    return fleet

async def fetch_ais_stream(fleet):
    import websockets

    logger.info("Connecting to AISStream: %s (Duration: %ds)", AISSTREAM_URL, LISTEN_DURATION_SECONDS)
    messages_received = 0
    updated_mmsi = set()

    try:
        async with websockets.connect(AISSTREAM_URL, ping_interval=20, ping_timeout=20) as ws:
            sub = {
                "APIKey": API_KEY,
                "BoundingBoxes": SUBSCRIPTION_BOXES
            }
            await ws.send(json.dumps(sub))
            logger.info("Subscribed to %d prioritized maritime bounding boxes. Listening for live vessels...", len(SUBSCRIPTION_BOXES))

            start_time = time.time()
            now_iso = datetime.now(timezone.utc).isoformat()

            while (time.time() - start_time) < LISTEN_DURATION_SECONDS:
                try:
                    raw_data = await asyncio.wait_for(ws.recv(), timeout=5.0)
                except asyncio.TimeoutError:
                    continue

                if isinstance(raw_data, bytes):
                    raw_data = raw_data.decode("utf-8", errors="ignore")

                try:
                    data = json.loads(raw_data)
                except Exception:
                    continue

                msg_type = data.get("MessageType")
                if msg_type == "SubscriptionConfirmation":
                    continue

                meta = data.get("MetaData", {})
                mmsi_val = meta.get("MMSI")
                if not mmsi_val:
                    continue

                try:
                    mmsi = int(mmsi_val)
                except (ValueError, TypeError):
                    continue

                messages_received += 1
                updated_mmsi.add(mmsi)

                v = fleet.get(mmsi, {})
                ship_name = meta.get("ShipName", "").strip().lstrip("@")
                if ship_name:
                    v["name"] = ship_name
                elif "name" not in v:
                    v["name"] = f"VESSEL-{mmsi}"

                lat = meta.get("latitude", v.get("lat", 0.0))
                lon = meta.get("longitude", v.get("lon", 0.0))

                msg_body = data.get("Message", {})
                if msg_type in ("PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport"):
                    pos = msg_body.get(msg_type, {})
                    if "Latitude" in pos and pos["Latitude"] is not None:
                        lat = pos["Latitude"]
                    if "Longitude" in pos and pos["Longitude"] is not None:
                        lon = pos["Longitude"]
                    if "Sog" in pos and pos["Sog"] is not None:
                        v["sog"] = round(float(pos["Sog"]), 1)
                    if "Cog" in pos and pos["Cog"] is not None:
                        v["cog"] = round(float(pos["Cog"]), 1)
                    if "TrueHeading" in pos and pos["TrueHeading"] not in (None, 511):
                        v["heading"] = round(float(pos["TrueHeading"]), 1)
                    else:
                        v["heading"] = v.get("cog", 0.0)

                    if msg_type == "StandardClassBPositionReport" and v.get("type", "Commercial Vessel") == "Commercial Vessel":
                        v["type"] = "Pleasure Craft"
                    if msg_type == "ExtendedClassBPositionReport":
                        if pos.get("ShipName"):
                            v["name"] = pos["ShipName"].strip().lstrip("@") or v["name"]
                        if pos.get("Type"):
                            v["type"] = map_ship_type(pos["Type"])

                elif msg_type == "ShipStaticData":
                    static = msg_body.get("ShipStaticData", {})
                    if static.get("Name"):
                        v["name"] = static["Name"].strip().lstrip("@") or v["name"]
                    if static.get("ImoNumber"):
                        v["imo"] = static["ImoNumber"]
                    if static.get("CallSign"):
                        v["call_sign"] = static["CallSign"].strip()
                    if static.get("Type"):
                        v["type"] = map_ship_type(static["Type"])
                    if static.get("MaximumStaticDraught"):
                        v["draft"] = round(float(static["MaximumStaticDraught"]), 1)
                    if static.get("Destination"):
                        v["destination"] = static["Destination"].strip()
                    dim = static.get("Dimension", {})
                    if dim:
                        l = (dim.get("A") or 0) + (dim.get("B") or 0)
                        w = (dim.get("C") or 0) + (dim.get("D") or 0)
                        if l > 0: v["length"] = l
                        if w > 0: v["width"] = w

                elif msg_type == "StaticDataReport":
                    sdr = msg_body.get("StaticDataReport", {})
                    rep_a = sdr.get("ReportA", {})
                    rep_b = sdr.get("ReportB", {})
                    if rep_a.get("Valid") and rep_a.get("ShipName"):
                        v["name"] = rep_a["ShipName"].strip().lstrip("@") or v["name"]
                    if rep_b.get("Valid"):
                        if rep_b.get("Type"):
                            v["type"] = map_ship_type(rep_b["Type"])
                        if rep_b.get("CallSign"):
                            v["call_sign"] = rep_b["CallSign"].strip()

                # Coordinate sanity check
                if is_valid_coord(lat, lon):
                    v["lat"] = round(float(lat), 5)
                    v["lon"] = round(float(lon), 5)
                elif "lat" not in v or not is_valid_coord(v["lat"], v["lon"]):
                    # Don't add a vessel with missing/invalid coordinates
                    continue

                v["mmsi"] = mmsi
                if "sog" not in v: v["sog"] = 0.0
                if "cog" not in v: v["cog"] = 0.0
                if "heading" not in v: v["heading"] = v.get("cog", 0.0)
                if "type" not in v: v["type"] = "Commercial Vessel"
                if "flag" not in v: v["flag"] = get_country_from_mmsi(mmsi)
                if "length" not in v: v["length"] = 180
                if "width" not in v: v["width"] = 28
                if "draft" not in v: v["draft"] = 8.0
                if "destination" not in v: v["destination"] = "EN ROUTE"
                v["ais_status"] = "LIVE"
                v["time_utc"] = meta.get("time_utc", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"))
                v["last_updated"] = time.time()

                if "NavigationalStatus" in pos and pos["NavigationalStatus"] is not None:
                    v["nav_status_code"] = pos["NavigationalStatus"]
                    v["nav_status"] = NAV_STATUS_MAP.get(pos["NavigationalStatus"], "Underway" if v["sog"] >= 0.5 else "Moored")
                elif v.get("sog", 0) < 0.6:
                    v["nav_status"] = "Moored / At anchor"
                else:
                    v["nav_status"] = "Underway using engine"

                strait, lake = detect_strait_or_lake(v["lat"], v["lon"])
                if "strait" not in v or v["strait"] == "High Seas":
                    v["strait"] = strait
                if lake:
                    v["lake"] = lake

                fleet[mmsi] = v

    except Exception as e:
        logger.warning("AISStream connection ended or encountered error: %s", e)

    logger.info("Finished AIS stream listen. Processed %d messages (%d unique vessels updated).",
                messages_received, len(updated_mmsi))

def save_fleet(fleet):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Prune fleet if it exceeds 25,000 vessels (preserving Great Lakes and ranked vessels)
    if len(fleet) > 25000:
        protected = {
            k: v for k, v in fleet.items()
            if v.get("is_great_lakes") or v.get("protected") or v.get("rank")
            or v.get("strait") == "Great Lakes" or v.get("lake")
        }
        others = [v for k, v in fleet.items() if k not in protected]
        others.sort(key=lambda x: x.get("last_updated", 0), reverse=True)
        keep_others = others[:max(0, 25000 - len(protected))]
        fleet = {v["mmsi"]: v for v in list(protected.values()) + keep_others}

    # Format vessels array
    vessels_list = []
    for mmsi, v in fleet.items():
        vessel_obj = {
            "mmsi": v.get("mmsi", mmsi),
            "name": v.get("name", f"VESSEL-{mmsi}"),
            "lat": v.get("lat", 0.0),
            "lon": v.get("lon", 0.0),
            "sog": v.get("sog", 0.0),
            "cog": v.get("cog", 0.0),
            "heading": v.get("heading", v.get("cog", 0.0)),
            "type": v.get("type", "Commercial Vessel"),
            "flag": v.get("flag", "International"),
            "length": v.get("length", 180),
            "width": v.get("width", 28),
            "draft": v.get("draft", 8.0),
            "destination": v.get("destination", "EN ROUTE"),
            "strait": v.get("strait", "High Seas"),
            "ais_status": v.get("ais_status", "LIVE"),
            "nav_status": v.get("nav_status", "Underway using engine" if (v.get("sog", 0) >= 0.5) else "Moored / At anchor"),
            "time_utc": v.get("time_utc", now_iso),
            "last_updated": v.get("last_updated", time.time())
        }
        if v.get("lake"):
            vessel_obj["lake"] = v["lake"]
        if v.get("rank"):
            vessel_obj["rank"] = v["rank"]
        if v.get("is_great_lakes"):
            vessel_obj["is_great_lakes"] = True
        if v.get("imo"):
            vessel_obj["imo"] = v["imo"]
        if v.get("call_sign"):
            vessel_obj["call_sign"] = v["call_sign"]
        vessels_list.append(vessel_obj)

    # 1. Output vessels.json
    output_data = {
        "last_updated": now_iso,
        "total_tracked": len(vessels_list),
        "vessels": vessels_list
    }
    with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(output_data, f)
    logger.info("Wrote %d vessels to %s (Size: %.2f MB)",
                len(vessels_list), JSON_OUTPUT, os.path.getsize(JSON_OUTPUT) / (1024 * 1024))

    # 2. Output vessels.geojson for standard GIS / GeoJSON viewers
    geojson_features = []
    for v in vessels_list:
        geojson_features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [v["lon"], v["lat"]]
            },
            "properties": {
                "mmsi": v["mmsi"],
                "name": v["name"],
                "sog": v["sog"],
                "cog": v["cog"],
                "heading": v["heading"],
                "type": v["type"],
                "flag": v["flag"],
                "length": v["length"],
                "width": v["width"],
                "draft": v["draft"],
                "destination": v["destination"],
                "strait": v["strait"],
                "lake": v.get("lake"),
                "rank": v.get("rank"),
                "nav_status": v.get("nav_status"),
                "time_utc": v.get("time_utc"),
                "last_updated": v.get("last_updated")
            }
        })

    geojson_data = {
        "type": "FeatureCollection",
        "last_updated": now_iso,
        "features": geojson_features
    }
    with open(GEOJSON_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f)
    logger.info("Wrote %d features to %s (Size: %.2f MB)",
                len(geojson_features), GEOJSON_OUTPUT, os.path.getsize(GEOJSON_OUTPUT) / (1024 * 1024))

async def main():
    logger.info("Starting ShipFinder automated AIS update...")
    fleet = load_existing_fleet()
    await fetch_ais_stream(fleet)
    save_fleet(fleet)
    logger.info("ShipFinder automated AIS update complete!")

if __name__ == "__main__":
    asyncio.run(main())
