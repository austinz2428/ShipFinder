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
    # 1. North America: Great Lakes & St. Lawrence Seaway
    [[41.0, -93.5], [49.5, -74.5]],
    # 2. US East Coast, Florida, Bahamas, Gulf of Mexico, Mississippi River
    [[24.0, -98.5], [45.5, -65.0]],
    # 3. US West Coast, Puget Sound, Columbia River, California
    [[32.0, -125.5], [49.5, -116.5]],
    # 4. Dover Strait / English Channel / North Sea
    [[49.5, -2.0], [52.0, 3.0]],
    # 5. Bosphorus Strait & Sea of Marmara
    [[40.8, 28.5], [41.5, 29.5]],
    # 6. Strait of Gibraltar
    [[35.0, -6.5], [37.0, -5.0]],
    # 7. Suez Canal & Red Sea approaches
    [[27.5, 32.0], [32.0, 33.5]],
    # 8. Strait of Malacca & Singapore Port
    [[1.0, 103.0], [2.0, 104.5]],
    # 9. Panama Canal & Caribbean / Pacific approaches
    [[8.0, -80.5], [10.0, -79.0]]
]

def init_global_fleet():
    fleet = {}
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
                logger.info("Loaded %d genuine vessels from snapshot %s", len(fleet), os.path.basename(c))
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
                    "BoundingBoxes": SUBSCRIPTION_BOXES
                }
                await ws.send(json.dumps(subscription))
                logger.info("Subscribed to %d prioritized maritime bounding boxes successfully.", len(SUBSCRIPTION_BOXES))

                while True:
                    raw_data = await ws.recv()
                    data = json.loads(raw_data)
                    msg_type = data.get("MessageType")
                    if msg_type == "SubscriptionConfirmation":
                        continue

                    meta = data.get("MetaData", {})
                    mmsi = meta.get("MMSI")
                    if not mmsi:
                        continue
                    mmsi = int(mmsi)
                    now_ts = time.time()
                    time_utc_str = meta.get("time_utc", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"))

                    msg_body = data.get("Message", {})
                    pos = msg_body.get(msg_type, {}) if isinstance(msg_body, dict) else {}

                    # Extract coordinates from pos report or metadata
                    raw_lat = pos.get("Latitude") if pos.get("Latitude") is not None else meta.get("latitude")
                    raw_lon = pos.get("Longitude") if pos.get("Longitude") is not None else meta.get("longitude")
                    has_valid_coords = is_valid_coord(raw_lat, raw_lon)

                    # If vessel not seen yet and no valid coordinates, don't create an invalid record
                    if mmsi not in vessels_db:
                        if not has_valid_coords:
                            continue
                        cur_lat = round(float(raw_lat), 5)
                        cur_lon = round(float(raw_lon), 5)
                        strait_name, lake_name = detect_strait_or_lake(cur_lat, cur_lon)
                        vessels_db[mmsi] = {
                            "mmsi": mmsi,
                            "name": meta.get("ShipName", f"VESSEL-{mmsi}").strip().lstrip("@") or f"VESSEL-{mmsi}",
                            "imo": 0,
                            "flag": get_country_from_mmsi(mmsi),
                            "type": "Cargo Ship",
                            "cargo": "Commercial Cargo",
                            "lat": cur_lat,
                            "lon": cur_lon,
                            "sog": 0.0,
                            "cog": 0.0,
                            "heading": 0.0,
                            "draft": 9.5,
                            "length": 185,
                            "width": 28,
                            "last_port": "EN ROUTE",
                            "eta": "--:--",
                            "ais_status": "LIVE",
                            "nav_status": "Underway using engine",
                            "score": 85,
                            "strait": strait_name,
                            "lake": lake_name,
                            "direction": "En Route",
                            "track": [[cur_lat, cur_lon]],
                            "time_utc": time_utc_str,
                            "last_updated": now_ts
                        }

                    v = vessels_db[mmsi]
                    v["last_updated"] = now_ts
                    v["time_utc"] = time_utc_str

                    if meta.get("ShipName"):
                        name = meta.get("ShipName").strip().lstrip("@")
                        if name:
                            v["name"] = name

                    if msg_type in ("PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport"):
                        if has_valid_coords:
                            new_lat = round(float(raw_lat), 5)
                            new_lon = round(float(raw_lon), 5)
                            v["lat"] = new_lat
                            v["lon"] = new_lon
                            strait_name, lake_name = detect_strait_or_lake(new_lat, new_lon)
                            v["strait"] = strait_name
                            if lake_name:
                                v["lake"] = lake_name

                            # GPS breadcrumb track
                            if not v.get("track"):
                                v["track"] = [[new_lat, new_lon]]
                            else:
                                last_pt = v["track"][-1]
                                if abs(last_pt[0] - new_lat) > 0.0005 or abs(last_pt[1] - new_lon) > 0.0005:
                                    v["track"].append([new_lat, new_lon])
                                    if len(v["track"]) > 30:
                                        v["track"] = v["track"][-30:]

                        if "Sog" in pos and pos["Sog"] is not None:
                            v["sog"] = round(float(pos["Sog"]), 1)
                        if "Cog" in pos and pos["Cog"] is not None:
                            v["cog"] = round(float(pos["Cog"]), 1)
                        if "TrueHeading" in pos and pos["TrueHeading"] not in (None, 511):
                            v["heading"] = round(float(pos["TrueHeading"]), 1)
                        else:
                            v["heading"] = v.get("cog", 0.0)

                        if "RateOfTurn" in pos:
                            v["rate_of_turn"] = pos["RateOfTurn"]

                        if "NavigationalStatus" in pos and pos["NavigationalStatus"] is not None:
                            v["nav_status_code"] = pos["NavigationalStatus"]
                            v["nav_status"] = NAV_STATUS_MAP.get(pos["NavigationalStatus"], "Underway" if v["sog"] >= 0.5 else "Moored")
                        elif v.get("sog", 0) < 0.6:
                            v["nav_status"] = "Moored / At anchor"
                        else:
                            v["nav_status"] = "Underway using engine"

                        if msg_type == "StandardClassBPositionReport" and v.get("type") == "Commercial Vessel":
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
                            v["cargo_type_code"] = static["Type"]
                        if static.get("MaximumStaticDraught"):
                            v["draft"] = round(float(static["MaximumStaticDraught"]), 1)
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
                            v["name"] = rep_a["ShipName"].strip().lstrip("@") or v["name"]
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
        batch_broadcast_worker()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
