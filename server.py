import asyncio
import json
import logging
import time
import math
import random
import os
import sys
from datetime import datetime, timezone
import websockets
from aiohttp import web, WSMsgType

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("AISServer")

PORT = int(os.environ.get("PORT", "8080"))
HOST = os.environ.get("HOST", "0.0.0.0")
DEFAULT_API_KEY = "484c88f1a086340afa5fb60ee9e90163176b739c"
API_KEY = os.environ.get("AISSTREAM_API_KEY", "").strip() or DEFAULT_API_KEY
AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream"

START_TIME = time.time()
vessels_db = {}
connected_clients = set()
update_batch = {}  # mmsi -> vessel dict for buffered broadcast

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
}

alerts_db = [
    {
        "id": "alert-1",
        "time": "14:12",
        "title": "AIS GAP · 18M",
        "vessel": "MV ORION",
        "level": "CRIT",
        "details": "Transponder signal dropped near northern choke passage"
    },
    {
        "id": "alert-2",
        "time": "14:05",
        "title": "OFF-LANE · 0.4 NM",
        "vessel": "SAM LAUD",
        "level": "WARN",
        "details": "Heading deviation along Lake Michigan TSS approach"
    },
    {
        "id": "alert-3",
        "time": "13:58",
        "title": "SPEED DROP · -3.1 KN",
        "vessel": "AMERICAN MARINER",
        "level": "INFO",
        "details": "Speed reduced entering St. Marys river"
    },
    {
        "id": "alert-4",
        "time": "13:41",
        "title": "QUEUE +2 · DETROIT",
        "vessel": "V-12, V-15",
        "level": "INFO",
        "details": "Vessel queue increased at Ambassador channel"
    }
]

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

def init_global_fleet():
    fleet = {}
    mmsi_ctr = 300000000

    def add(name, vtype, flag, cargo, lat, lon, sog, cog, l=190, w=28, draft=8.5, mmsi=None, strait="High Seas", dir="En Route", lake=None):
        nonlocal mmsi_ctr
        if not mmsi:
            mmsi_ctr += 1
            mmsi = mmsi_ctr
        fleet[mmsi] = {
            "mmsi": mmsi,
            "name": name,
            "imo": random.randint(9100000, 9890000),
            "flag": flag,
            "type": vtype,
            "cargo": cargo,
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "sog": round(sog, 1),
            "cog": round(cog, 1),
            "heading": round(cog, 1),
            "draft": round(draft, 1),
            "length": l,
            "width": w,
            "last_port": "COMMERCIAL",
            "eta": "SCHEDULED",
            "ais_status": "LIVE",
            "score": random.randint(78, 96),
            "strait": strait,
            "lake": lake,
            "direction": dir,
            "track": [[round(lat - 0.04, 5), round(lon - 0.04, 5)], [round(lat, 5), round(lon, 5)]],
            "last_updated": time.time()
        }

    # Top 20 Biggest Ships on the Great Lakes (Real Fleet Roster)
    add("PAUL R. TREGURTHA", "Cargo Ship", "USA", "Low Sulfur Coal", 43.15, -82.42, 10.2, 182, 308.9, 32.0, 8.9, 366904930, "Great Lakes", "Southbound", "Lake Huron")
    add("EDWIN H. GOTT", "Cargo Ship", "USA", "Iron Ore", 44.10, -83.40, 12.8, 330, 306.0, 32.0, 9.1, 366904880, "Great Lakes", "Northbound", "Lake Huron")
    add("JAMES R. BARKER", "Cargo Ship", "USA", "Taconite Pellets", 47.25, -88.10, 12.1, 285, 306.0, 32.0, 9.0, 366904940, "Great Lakes", "Westbound", "Lake Superior")
    add("MESABI MINER", "Cargo Ship", "USA", "Iron Ore Pellets", 46.75, -84.95, 11.4, 310, 306.0, 32.0, 8.9, 366904950, "Great Lakes", "Northbound", "Lake Superior")
    add("EDGAR B. SPEER", "Cargo Ship", "USA", "Taconite", 43.80, -87.10, 13.0, 175, 306.0, 32.0, 9.1, 366904890, "Great Lakes", "Southbound", "Lake Michigan")
    add("AMERICAN SPIRIT", "Cargo Ship", "USA", "Low Sulfur Coal", 41.75, -82.50, 11.9, 72, 306.0, 32.0, 8.8, 366904920, "Great Lakes", "Eastbound", "Lake Erie")
    add("INDIANA HARBOR", "Cargo Ship", "USA", "Taconite", 42.10, -87.10, 11.5, 345, 304.8, 32.0, 8.6, 366972000, "Great Lakes", "Northbound", "Lake Michigan")
    add("BURNS HARBOR", "Cargo Ship", "USA", "Iron Ore Pellets", 43.05, -87.40, 12.3, 20, 304.8, 32.0, 8.7, 366972010, "Great Lakes", "Northbound", "Lake Michigan")
    add("STEWART J. CORT", "Cargo Ship", "USA", "Pellets", 45.85, -84.80, 10.9, 92, 304.8, 32.0, 8.7, 366904820, "Great Lakes", "Eastbound", "Lake Huron")
    add("AMERICAN CENTURY", "Cargo Ship", "USA", "Coal", 47.10, -89.80, 12.6, 65, 304.8, 32.0, 8.8, 366904980, "Great Lakes", "Eastbound", "Lake Superior")
    add("AMERICAN INTEGRITY", "Cargo Ship", "USA", "Iron Ore", 44.80, -82.90, 11.7, 160, 304.8, 32.0, 8.8, 366904910, "Great Lakes", "Southbound", "Lake Huron")
    add("WALTER J. MCCARTHY JR.", "Cargo Ship", "USA", "Low Sulfur Coal", 46.90, -91.20, 10.5, 75, 304.8, 32.0, 8.7, 366904960, "Great Lakes", "Eastbound", "Lake Superior")
    add("PRESQUE ISLE", "Cargo Ship", "USA", "Stone & Pellets", 45.30, -83.45, 11.2, 145, 304.8, 31.7, 8.6, 366904830, "Great Lakes", "Southbound", "Lake Huron")
    add("LEE A. TREGURTHA", "Cargo Ship", "USA", "Iron Ore", 41.90, -81.70, 12.0, 250, 251.8, 22.9, 8.4, 366904860, "Great Lakes", "Westbound", "Lake Erie")
    add("HON. JAMES L. OBERSTAR", "Cargo Ship", "USA", "Iron Ore", 46.78, -92.05, 8.5, 235, 245.7, 22.9, 8.4, 366904840, "Great Lakes", "Inbound", "Lake Superior")
    add("JOHN G. MUNSON", "Cargo Ship", "USA", "Limestone", 44.20, -86.95, 13.2, 190, 234.1, 21.9, 8.3, 366904850, "Great Lakes", "Southbound", "Lake Michigan")
    add("ARTHUR M. ANDERSON", "Cargo Ship", "USA", "Stone", 46.80, -89.50, 11.8, 78, 233.8, 21.3, 8.2, 366914590, "Great Lakes", "Eastbound", "Lake Superior")
    add("CASON J. CALLAWAY", "Cargo Ship", "USA", "Iron Ore Pellets", 45.10, -83.20, 12.5, 340, 233.8, 21.3, 8.2, 366904870, "Great Lakes", "Northbound", "Lake Huron")
    add("AMERICAN MARINER", "Cargo Ship", "USA", "Coal", 45.45, -84.22, 13.1, 125, 222.5, 23.8, 8.8, 366904970, "Great Lakes", "Southbound", "Lake Huron")
    add("SAM LAUD", "Cargo Ship", "USA", "Iron Ore Pellets", 44.62, -86.85, 12.4, 42, 198.0, 20.7, 8.5, 367123450, "Great Lakes", "Eastbound", "Lake Michigan")

    # Load from public/vessels.json if present
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, "public", "vessels.json"),
        os.path.join(base_dir, "public", "fleet_snapshot.json")
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                with open(c, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                    vlist = raw.get("vessels", []) if isinstance(raw, dict) else raw
                    if isinstance(vlist, list):
                        for v in vlist:
                            mmsi = v.get("mmsi")
                            if mmsi:
                                fleet[int(mmsi)] = v
                logger.info("Loaded %d vessels from snapshot %s", len(fleet), os.path.basename(c))
                break
            except Exception as e:
                logger.warning("Error loading snapshot %s: %s", c, e)

    return fleet

vessels_db = init_global_fleet()

def map_ship_type(type_code):
    if not type_code: return "Cargo Ship"
    try:
        code = int(type_code)
    except (ValueError, TypeError):
        return "Cargo Ship"

    if 70 <= code <= 79: return "Cargo Ship"
    elif 80 <= code <= 89: return "Tanker"
    elif 60 <= code <= 69: return "Passenger"
    elif 30 <= code <= 39: return "Fishing"
    elif 50 <= code <= 59 or code in (31, 32): return "Tug / Tow"
    elif 36 <= code <= 37: return "Pleasure Craft"
    return "Commercial Vessel"

# High-efficiency batch broadcaster (flushes every 250ms)
async def batch_broadcast_worker():
    while True:
        await asyncio.sleep(0.25)
        if update_batch and connected_clients:
            batch_list = list(update_batch.values())
            update_batch.clear()
            msg_str = json.dumps({
                "type": "VESSEL_BATCH",
                "count": len(batch_list),
                "vessels": batch_list
            })
            stale = []
            for client in list(connected_clients):
                try:
                    await client.send_str(msg_str)
                except Exception:
                    stale.append(client)
            for c in stale:
                connected_clients.discard(c)

async def aisstream_consumer():
    while True:
        try:
            logger.info("Connecting to AISStream.io: %s", AISSTREAM_URL)
            async with websockets.connect(AISSTREAM_URL, ping_interval=20, ping_timeout=20) as ws:
                subscription = {
                    "APIKey": API_KEY,
                    "BoundingBoxes": [[[-90, -180], [90, 180]]]
                }
                await ws.send(json.dumps(subscription))
                logger.info("Subscribed to global unfiltered AIS stream successfully.")

                while True:
                    raw_data = await ws.recv()
                    data = json.loads(raw_data)
                    msg_type = data.get("MessageType")
                    meta = data.get("MetaData", {})
                    mmsi = meta.get("MMSI")

                    if not mmsi: continue
                    mmsi = int(mmsi)
                    now_ts = time.time()

                    if mmsi not in vessels_db:
                        strait_name, lake_name = detect_strait_or_lake(meta.get("latitude", 0.0), meta.get("longitude", 0.0))
                        vessels_db[mmsi] = {
                            "mmsi": mmsi,
                            "name": meta.get("ShipName", f"VESSEL-{mmsi}").strip() or f"VESSEL-{mmsi}",
                            "imo": 0,
                            "flag": get_country_from_mmsi(mmsi),
                            "type": "Cargo Ship",
                            "cargo": "Commercial Cargo",
                            "lat": meta.get("latitude", 0.0),
                            "lon": meta.get("longitude", 0.0),
                            "sog": 0.0,
                            "cog": 0.0,
                            "heading": 0.0,
                            "draft": 9.5,
                            "length": 185,
                            "width": 28,
                            "last_port": "EN ROUTE",
                            "eta": "--:--",
                            "ais_status": "LIVE",
                            "score": 85,
                            "strait": strait_name,
                            "lake": lake_name,
                            "direction": "En Route",
                            "track": [],
                            "last_updated": now_ts
                        }

                    v = vessels_db[mmsi]
                    v["last_updated"] = now_ts

                    if meta.get("ShipName"):
                        name = meta.get("ShipName").strip()
                        if name: v["name"] = name

                    msg_body = data.get("Message", {})

                    if msg_type in ("PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport"):
                        pos = msg_body.get(msg_type, {})
                        lat = pos.get("Latitude", v["lat"])
                        lon = pos.get("Longitude", v["lon"])
                        sog = pos.get("Sog", v["sog"])
                        cog = pos.get("Cog", v["cog"])
                        hdg = pos.get("TrueHeading", v["heading"])
                        if hdg == 511: hdg = cog

                        v["lat"] = round(lat, 5)
                        v["lon"] = round(lon, 5)
                        v["sog"] = round(sog, 1)
                        v["cog"] = round(cog, 1)
                        v["heading"] = round(hdg, 1)
                        if "RateOfTurn" in pos: v["rate_of_turn"] = pos["RateOfTurn"]
                        if "NavigationalStatus" in pos: v["nav_status"] = pos["NavigationalStatus"]
                        if msg_type == "StandardClassBPositionReport" and v["type"] == "Commercial Vessel":
                            v["type"] = "Pleasure Craft"
                        if msg_type == "ExtendedClassBPositionReport":
                            if pos.get("ShipName"): v["name"] = pos["ShipName"].strip() or v["name"]
                            if pos.get("Type"): v["type"] = map_ship_type(pos["Type"])
                        
                        strait_name, lake_name = detect_strait_or_lake(v["lat"], v["lon"])
                        v["strait"] = strait_name
                        if lake_name: v["lake"] = lake_name
                        v["time_utc"] = meta.get("time_utc", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"))

                    elif msg_type == "ShipStaticData":
                        static = msg_body.get("ShipStaticData", {})
                        if static.get("Name"):
                            v["name"] = static["Name"].strip() or v["name"]
                        if static.get("ImoNumber"):
                            v["imo"] = static["ImoNumber"]
                        if static.get("CallSign"):
                            v["call_sign"] = static["CallSign"].strip()
                        if static.get("Type"):
                            v["type"] = map_ship_type(static["Type"])
                            v["cargo_type_code"] = static["Type"]
                        if static.get("MaximumStaticDraught"):
                            v["draft"] = round(static["MaximumStaticDraught"], 1)
                        if static.get("Destination"):
                            v["destination"] = static["Destination"].strip()
                            v["eta"] = v["destination"]
                        dim = static.get("Dimension", {})
                        if dim:
                            v["dim_a"] = dim.get("A", 120)
                            v["dim_b"] = dim.get("B", 35)
                            v["dim_c"] = dim.get("C", 12)
                            v["dim_d"] = dim.get("D", 12)
                            l = v["dim_a"] + v["dim_b"]
                            w = v["dim_c"] + v["dim_d"]
                            if l > 0: v["length"] = l
                            if w > 0: v["width"] = w

                    elif msg_type == "StaticDataReport":
                        sdr = msg_body.get("StaticDataReport", {})
                        rep_a = sdr.get("ReportA", {})
                        rep_b = sdr.get("ReportB", {})
                        if rep_a.get("Valid") and rep_a.get("ShipName"):
                            v["name"] = rep_a["ShipName"].strip() or v["name"]
                        if rep_b.get("Valid"):
                            if rep_b.get("Type"): v["type"] = map_ship_type(rep_b["Type"])
                            if rep_b.get("CallSign"): v["call_sign"] = rep_b["CallSign"].strip()

                    # Add to batch queue
                    update_batch[mmsi] = v

                    # Cap memory to ~25,000 vessels (free cloud 512MB RAM safe)
                    if len(vessels_db) > 25000:
                        oldest = min(vessels_db.keys(), key=lambda k: vessels_db[k].get("last_updated", 0))
                        del vessels_db[oldest]

        except Exception as e:
            logger.warning("AISStream connection error: %s. Reconnecting in 5s...", e)
            await asyncio.sleep(5)

# Periodic dead-reckoning movement simulation for active fleet
async def fleet_simulation_loop():
    while True:
        await asyncio.sleep(2.0)
        for mmsi, v in list(vessels_db.items())[:300]:
            sog = v.get("sog", 0)
            if sog > 0.5:
                hdg_rad = math.radians(v.get("heading", 0))
                dist_deg = (sog * (2.0 / 3600.0)) / 60.0
                v["lat"] = round(v["lat"] + dist_deg * math.cos(hdg_rad), 5)
                v["lon"] = round(v["lon"] + (dist_deg * math.sin(hdg_rad)) / max(0.2, math.cos(math.radians(v["lat"]))), 5)
                # Queue a fraction for batch update
                if random.random() < 0.1:
                    update_batch[mmsi] = v

# --- HTTP Endpoints ---
async def handle_options(request):
    return web.Response(headers=CORS_HEADERS)

async def handle_health(request):
    return web.json_response({
        "status": "online",
        "service": "ShipFinder 3D Tactical Cloud Relay",
        "tracked_vessels": len(vessels_db),
        "connected_clients": len(connected_clients),
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "version": "2.2.0"
    }, headers=CORS_HEADERS)

async def handle_get_vessels(request):
    min_lat = request.query.get("minLat")
    max_lat = request.query.get("maxLat")
    min_lon = request.query.get("minLon")
    max_lon = request.query.get("maxLon")
    limit = int(request.query.get("limit", 0))

    if min_lat and max_lat and min_lon and max_lon:
        try:
            min_lat, max_lat = float(min_lat), float(max_lat)
            min_lon, max_lon = float(min_lon), float(max_lon)
            filtered = [
                v for v in vessels_db.values()
                if min_lat <= v.get("lat", -999) <= max_lat and min_lon <= v.get("lon", -999) <= max_lon
            ]
            if limit > 0:
                filtered = filtered[:limit]
            return web.json_response({
                "vessels": filtered,
                "total": len(vessels_db),
                "in_view": len(filtered),
                "last_updated": time.time()
            }, headers=CORS_HEADERS)
        except ValueError:
            pass

    res_list = list(vessels_db.values())
    if limit > 0:
        res_list = res_list[:limit]
    return web.json_response(res_list, headers=CORS_HEADERS)

async def handle_get_vessel_by_mmsi(request):
    mmsi = int(request.match_info.get("mmsi", 0))
    v = vessels_db.get(mmsi)
    if v: return web.json_response(v, headers=CORS_HEADERS)
    return web.json_response({"error": "Not found"}, status=404, headers=CORS_HEADERS)

photo_cache = {}
TYPE_DEFAULT_PHOTOS = {
    "Tanker": "https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=800&q=80",
    "Cargo Ship": "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80",
    "Pleasure Craft": "https://images.unsplash.com/photo-1569263979104-865ab7cd8d17?auto=format&fit=crop&w=800&q=80",
    "Tug / Tow": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
    "Fishing": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    "Passenger": "https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=800&q=80"
}

async def handle_get_vessel_photo(request):
    name = request.query.get("name", "").strip()
    vtype = request.query.get("type", "Cargo Ship").strip()

    if name in photo_cache:
        return web.json_response(photo_cache[name], headers=CORS_HEADERS)

    clean_name = name.replace("MV ", "").replace("SS ", "").strip().title()
    queries = [
        f"MV {clean_name}",
        clean_name,
        f"{clean_name} (ship)",
        f"SS {clean_name}"
    ]

    photo_url = None
    loop = asyncio.get_event_loop()

    def search_wiki():
        import urllib.request, urllib.parse
        for q in queries:
            url = f"https://en.wikipedia.org/w/api.php?action=query&titles={urllib.parse.quote(q)}&prop=pageimages&format=json&pithumbsize=800"
            req = urllib.request.Request(url, headers={"User-Agent": "ShipFinderTactical/1.0"})
            try:
                with urllib.request.urlopen(req, timeout=2.5) as res:
                    data = json.loads(res.read().decode("utf-8"))
                    pages = data.get("query", {}).get("pages", {})
                    for pid, p in pages.items():
                        if "thumbnail" in p:
                            return p["thumbnail"]["source"]
            except Exception:
                pass
        return None

    try:
        photo_url = await loop.run_in_executor(None, search_wiki)
    except Exception:
        pass

    source = "Wikimedia Commons" if photo_url else "Maritime Fleet Archive"
    if not photo_url:
        for k, v in TYPE_DEFAULT_PHOTOS.items():
            if k.lower() in vtype.lower():
                photo_url = v
                break
        if not photo_url:
            photo_url = TYPE_DEFAULT_PHOTOS["Cargo Ship"]

    result = {
        "name": name,
        "photo_url": photo_url,
        "source": source
    }
    photo_cache[name] = result
    return web.json_response(result, headers=CORS_HEADERS)

async def handle_get_stats(request):
    return web.json_response({
        "wait_vsl": 14,
        "dwell_hrs": 6,
        "clear_hrs": 3,
        "delta_hrs": 2,
        "active_alerts": len(alerts_db),
        "total_tracked": len(vessels_db)
    }, headers=CORS_HEADERS)

async def handle_get_alerts(request):
    return web.json_response(alerts_db, headers=CORS_HEADERS)

async def websocket_handler(request):
    ws = web.WebSocketResponse(heartbeat=25.0)
    await ws.prepare(request)
    connected_clients.add(ws)
    logger.info("Client connected. Total clients: %d", len(connected_clients))

    # Initial snapshot to client (keep frame < 1MB so mobile Safari and proxies never drop)
    try:
        active_sample = sorted(vessels_db.values(), key=lambda v: v.get("last_updated", 0), reverse=True)[:2500]
        await ws.send_str(json.dumps({
            "type": "SNAPSHOT",
            "vessels": active_sample,
            "total_tracked": len(vessels_db),
            "alerts": alerts_db,
            "server_time": time.time()
        }))
    except Exception as e:
        logger.warning("Error sending initial snapshot: %s", e)

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                # Handle client ping or filter requests
                try:
                    payload = json.loads(msg.data)
                    if payload.get("type") == "PING":
                        await ws.send_str(json.dumps({"type": "PONG", "ts": time.time()}))
                except Exception:
                    pass
    finally:
        connected_clients.discard(ws)
        logger.info("Client disconnected. Remaining clients: %d", len(connected_clients))
    return ws

def create_app():
    app = web.Application()
    app.router.add_route("OPTIONS", "/{tail:.*}", handle_options)
    app.router.add_get("/", handle_health)
    app.router.add_get("/health", handle_health)
    app.router.add_get("/api/vessels", handle_get_vessels)
    app.router.add_get("/api/vessel/{mmsi}", handle_get_vessel_by_mmsi)
    app.router.add_get("/api/vessel-photo", handle_get_vessel_photo)
    app.router.add_get("/api/stats", handle_get_stats)
    app.router.add_get("/api/alerts", handle_get_alerts)
    app.router.add_get("/ws", websocket_handler)

    # Static build support if present
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "dist")
    if os.path.exists(dist_dir):
        assets_dir = os.path.join(dist_dir, "assets")
        if os.path.exists(assets_dir):
            app.router.add_static("/assets", path=assets_dir, name="assets")

    return app

async def main():
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()
    logger.info("ShipFinder Tactical Cloud Relay running on http://%s:%d (Fleet size: %d)", HOST, PORT, len(vessels_db))

    await asyncio.gather(
        aisstream_consumer(),
        fleet_simulation_loop(),
        batch_broadcast_worker()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
