import asyncio
import json
import logging
import time
import math
import random
from datetime import datetime, timezone
import websockets
from aiohttp import web, WSMsgType

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("AISServer")

API_KEY = "484c88f1a086340afa5fb60ee9e90163176b739c"
AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream"

vessels_db = {}
connected_clients = set()

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

def init_global_fleet():
    fleet = {}
    mmsi_ctr = 300000000

    def add(name, vtype, flag, cargo, lat, lon, sog, cog, l=190, w=28, draft=8.5, mmsi=None, strait="High Seas", dir="En Route"):
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
            "direction": dir,
            "track": [[round(lat - 0.04, 5), round(lon - 0.04, 5)], [round(lat, 5), round(lon, 5)]],
            "last_updated": time.time()
        }

    # Top 20 Biggest Ships on the Great Lakes (Real Fleet Roster)
    add("PAUL R. TREGURTHA", "Cargo Ship", "USA", "Low Sulfur Coal", 43.15, -82.42, 10.2, 182, 308.9, 32.0, 8.9, 366904930, "Great Lakes", "Southbound")
    add("EDWIN H. GOTT", "Cargo Ship", "USA", "Iron Ore", 44.10, -83.40, 12.8, 330, 306.0, 32.0, 9.1, 366904880, "Great Lakes", "Northbound")
    add("JAMES R. BARKER", "Cargo Ship", "USA", "Taconite Pellets", 47.25, -88.10, 12.1, 285, 306.0, 32.0, 9.0, 366904940, "Great Lakes", "Westbound")
    add("MESABI MINER", "Cargo Ship", "USA", "Iron Ore Pellets", 46.75, -84.95, 11.4, 310, 306.0, 32.0, 8.9, 366904950, "Great Lakes", "Northbound")
    add("EDGAR B. SPEER", "Cargo Ship", "USA", "Taconite", 43.80, -87.10, 13.0, 175, 306.0, 32.0, 9.1, 366904890, "Great Lakes", "Southbound")
    add("AMERICAN SPIRIT", "Cargo Ship", "USA", "Low Sulfur Coal", 41.75, -82.50, 11.9, 72, 306.0, 32.0, 8.8, 366904920, "Great Lakes", "Eastbound")
    add("INDIANA HARBOR", "Cargo Ship", "USA", "Taconite", 42.10, -87.10, 11.5, 345, 304.8, 32.0, 8.6, 366972000, "Great Lakes", "Northbound")
    add("BURNS HARBOR", "Cargo Ship", "USA", "Iron Ore Pellets", 43.05, -87.40, 12.3, 20, 304.8, 32.0, 8.7, 366972010, "Great Lakes", "Northbound")
    add("STEWART J. CORT", "Cargo Ship", "USA", "Pellets", 45.85, -84.80, 10.9, 92, 304.8, 32.0, 8.7, 366904820, "Great Lakes", "Eastbound")
    add("AMERICAN CENTURY", "Cargo Ship", "USA", "Coal", 47.10, -89.80, 12.6, 65, 304.8, 32.0, 8.8, 366904980, "Great Lakes", "Eastbound")
    add("AMERICAN INTEGRITY", "Cargo Ship", "USA", "Iron Ore", 44.80, -82.90, 11.7, 160, 304.8, 32.0, 8.8, 366904910, "Great Lakes", "Southbound")
    add("WALTER J. MCCARTHY JR.", "Cargo Ship", "USA", "Low Sulfur Coal", 46.90, -91.20, 10.5, 75, 304.8, 32.0, 8.7, 366904960, "Great Lakes", "Eastbound")
    add("PRESQUE ISLE", "Cargo Ship", "USA", "Stone & Pellets", 45.30, -83.45, 11.2, 145, 304.8, 31.7, 8.6, 366904830, "Great Lakes", "Southbound")
    add("LEE A. TREGURTHA", "Cargo Ship", "USA", "Iron Ore", 41.90, -81.70, 12.0, 250, 251.8, 22.9, 8.4, 366904860, "Great Lakes", "Westbound")
    add("HON. JAMES L. OBERSTAR", "Cargo Ship", "USA", "Iron Ore", 46.78, -92.05, 8.5, 235, 245.7, 22.9, 8.4, 366904840, "Great Lakes", "Inbound")
    add("JOHN G. MUNSON", "Cargo Ship", "USA", "Limestone", 44.20, -86.95, 13.2, 190, 234.1, 21.9, 8.3, 366904850, "Great Lakes", "Southbound")
    add("ARTHUR M. ANDERSON", "Cargo Ship", "USA", "Stone", 46.80, -89.50, 11.8, 78, 233.8, 21.3, 8.2, 366914590, "Great Lakes", "Eastbound")
    add("CASON J. CALLAWAY", "Cargo Ship", "USA", "Iron Ore Pellets", 45.10, -83.20, 12.5, 340, 233.8, 21.3, 8.2, 366904870, "Great Lakes", "Northbound")
    add("AMERICAN MARINER", "Cargo Ship", "USA", "Coal", 45.45, -84.22, 13.1, 125, 222.5, 23.8, 8.8, 366904970, "Great Lakes", "Southbound")
    add("SAM LAUD", "Cargo Ship", "USA", "Iron Ore Pellets", 44.62, -86.85, 12.4, 42, 198.0, 20.7, 8.5, 367123450, "Great Lakes", "Eastbound")

    # Pleasure craft & yachts in Great Lakes, Florida, East Coast (Pink/Magenta)
    clusters = [
        (25.8, -80.1, 70, 2.2), (27.9, -82.5, 50, 1.8), (26.5, -78.5, 40, 2.0),
        (42.0, -87.5, 35, 1.2), (43.5, -86.5, 30, 1.5), (41.8, -82.8, 30, 1.4),
        (40.6, -73.8, 55, 1.5), (38.5, -76.3, 45, 1.6)
    ]
    for blat, blon, cnt, rad in clusters:
        for _ in range(cnt):
            lat = blat + (random.random() - 0.5) * rad
            lon = blon + (random.random() - 0.5) * rad
            sog = 0 if random.random() < 0.35 else random.uniform(4, 18)
            add(f"YACHT-{random.randint(1000, 9999)}", "Pleasure Craft", "USA", "Private", lat, lon, sog, random.uniform(0, 360), 24, 6, 2.5)

    # Mississippi River Tugs (Blue dots)
    m_pts = [(44.9, -93.1), (41.5, -90.5), (38.6, -90.2), (37.0, -89.2), (35.1, -90.0), (33.4, -91.0), (32.3, -90.9), (30.4, -91.2), (29.9, -90.0)]
    for i in range(len(m_pts) - 1):
        p1, p2 = m_pts[i], m_pts[i + 1]
        for step in range(14):
            t = step / 14.0
            lat = p1[0] + (p2[0] - p1[0]) * t + (random.random() - 0.5) * 0.15
            lon = p1[1] + (p2[1] - p1[1]) * t + (random.random() - 0.5) * 0.15
            cog = 165 if random.random() > 0.45 else 345
            sog = 0 if random.random() < 0.25 else random.uniform(5, 11)
            add(f"TUG RIVER-{step+1}", "Tug / Tow", "USA", "Barge Tow", lat, lon, sog, cog, 40, 11, 4.0)

    # Gulf of Mexico (Orange Tankers & Yellow Cargo)
    for i in range(95):
        lat = random.uniform(25.8, 29.5)
        lon = random.uniform(-95.5, -88.0)
        is_tanker = random.random() > 0.35
        vtype = "Tanker" if is_tanker else "Cargo Ship"
        sog = 0 if random.random() < 0.2 else random.uniform(8, 15)
        add(f"GULF {vtype.upper()}-{i+1}", vtype, "USA", "Crude/Refined" if is_tanker else "Containers", lat, lon, sog, random.uniform(0, 360), 230, 36, 12.0)

    # Transatlantic Shipping Corridor (Dense streams across the Atlantic)
    for i in range(160):
        t = random.random()
        lat = 34.0 + t * 16.0 + (random.random() - 0.5) * 6.0
        lon = -74.0 + t * 62.0 + (random.random() - 0.5) * 4.0
        cog = 68 if random.random() > 0.45 else 248
        is_tanker = random.random() > 0.6
        vtype = "Tanker" if is_tanker else "Cargo Ship"
        add(f"ATLANTIC-{i+1}", vtype, "International", "Commercial", lat, lon, random.uniform(11, 19), cog, 280, 40, 13.5)

    # Pacific Coast (LA, SF, Seattle)
    for i in range(75):
        lat = random.uniform(32.0, 48.0)
        lon = -125.0 + (lat - 32.0) * 0.15 + (random.random() - 0.5) * 3.0
        cog = 320 if random.random() > 0.5 else 140
        add(f"PACIFIC-{i+1}", "Cargo Ship", "Panama", "General Cargo", lat, lon, random.uniform(10, 18), cog, 260, 36, 11.5)

    # Bosphorus Strait Original Vessels
    add("MV ORION", "Tanker", "Malta", "Crude Oil", 41.1685, 29.0558, 9.4, 11, 245, 42, 14.2, 938472200, "Bosphorus", "Northbound")
    add("MV KARA", "Cargo Ship", "Panama", "General Cargo", 41.2150, 29.0980, 11.8, 38, 220, 32, 11.5, 215883000, "Bosphorus", "Northbound")
    add("MV MIRA", "Cargo Ship", "Turkey", "Grain", 41.1350, 29.0505, 9.4, 15, 198, 30, 12.1, 271044120, "Bosphorus", "Northbound")

    return fleet

vessels_db = init_global_fleet()

def map_ship_type(type_code):
    if not type_code: return "Cargo Ship"
    code = int(type_code)
    if 70 <= code <= 79: return "Cargo Ship"
    elif 80 <= code <= 89: return "Tanker"
    elif 60 <= code <= 69: return "Passenger"
    elif 30 <= code <= 39: return "Fishing"
    elif 50 <= code <= 59: return "Tug / Tow"
    elif 36 <= code <= 37: return "Pleasure Craft"
    return "Commercial Vessel"

async def broadcast_to_clients(payload):
    if not connected_clients: return
    msg_str = json.dumps(payload)
    stale = []
    for client in connected_clients:
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

                msg_counter = 0
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
                        vessels_db[mmsi] = {
                            "mmsi": mmsi,
                            "name": meta.get("ShipName", f"VESSEL-{mmsi}").strip() or f"VESSEL-{mmsi}",
                            "imo": 0,
                            "flag": "International",
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
                            "strait": "High Seas",
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

                    msg_counter += 1
                    if msg_counter % 2 == 0:
                        await broadcast_to_clients({
                            "type": "VESSEL_UPDATE",
                            "vessel": v
                        })

                    # Maintain capacity around 25,000 vessels
                    if len(vessels_db) > 25000:
                        oldest = min(vessels_db.keys(), key=lambda k: vessels_db[k].get("last_updated", 0))
                        del vessels_db[oldest]

        except Exception as e:
            logger.warning("AISStream connection error: %s. Reconnecting in 5s...", e)
            await asyncio.sleep(5)

# Periodic dead-reckoning movement simulation for active fleet
async def fleet_simulation_loop():
    last_sim = time.time()
    while True:
        await asyncio.sleep(1.0)
        now = time.time()
        dt = min(2.5, max(0.5, now - last_sim))
        last_sim = now
        batch = []

        for mmsi, v in list(vessels_db.items()):
            sog = v.get("sog", 0)
            if sog >= 0.5:
                hdg = v.get("heading") if v.get("heading", 511) != 511 else v.get("cog", 0)
                hdg_rad = math.radians(hdg)
                dist_nm = (sog / 3600.0) * dt
                dist_deg = dist_nm / 60.0

                new_lat = round(v["lat"] + dist_deg * math.cos(hdg_rad), 5)
                cos_lat = max(0.2, math.cos(math.radians(new_lat)))
                new_lon = round(v["lon"] + (dist_deg * math.sin(hdg_rad)) / cos_lat, 5)

                v["lat"] = new_lat
                v["lon"] = new_lon
                v["last_updated"] = now

                # Update recent track
                track = v.get("track", [])
                if not track or math.hypot(new_lat - track[-1][0], new_lon - track[-1][1]) > 0.0004:
                    track.append([new_lat, new_lon])
                    if len(track) > 25:
                        track.pop(0)
                v["track"] = track
                batch.append(v)

        if batch and connected_clients:
            sample = random.sample(batch, min(24, len(batch)))
            for v in sample:
                await broadcast_to_clients({"type": "VESSEL_UPDATE", "vessel": v})

# HTTP & WebSocket Endpoints
async def handle_get_vessels(request):
    return web.json_response(list(vessels_db.values()), headers={"Access-Control-Allow-Origin": "*"})

async def handle_get_vessel_by_mmsi(request):
    mmsi = int(request.match_info.get("mmsi", 0))
    v = vessels_db.get(mmsi)
    if v: return web.json_response(v, headers={"Access-Control-Allow-Origin": "*"})
    return web.json_response({"error": "Not found"}, status=404, headers={"Access-Control-Allow-Origin": "*"})

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
        return web.json_response(photo_cache[name], headers={"Access-Control-Allow-Origin": "*"})

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
    return web.json_response(result, headers={"Access-Control-Allow-Origin": "*"})

async def handle_get_stats(request):
    return web.json_response({
        "wait_vsl": 14,
        "dwell_hrs": 6,
        "clear_hrs": 3,
        "delta_hrs": 2,
        "active_alerts": len(alerts_db),
        "total_tracked": len(vessels_db)
    }, headers={"Access-Control-Allow-Origin": "*"})

async def handle_get_alerts(request):
    return web.json_response(alerts_db, headers={"Access-Control-Allow-Origin": "*"})

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    connected_clients.add(ws)
    logger.info("Client connected. Total clients: %d", len(connected_clients))

    # Initial snapshot
    await ws.send_str(json.dumps({
        "type": "SNAPSHOT",
        "vessels": list(vessels_db.values()),
        "alerts": alerts_db
    }))

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                pass
    finally:
        connected_clients.discard(ws)
    return ws

def create_app():
    app = web.Application()
    app.router.add_get("/api/vessels", handle_get_vessels)
    app.router.add_get("/api/vessel/{mmsi}", handle_get_vessel_by_mmsi)
    app.router.add_get("/api/vessel-photo", handle_get_vessel_photo)
    app.router.add_get("/api/stats", handle_get_stats)
    app.router.add_get("/api/alerts", handle_get_alerts)
    app.router.add_get("/ws", websocket_handler)

    import os
    if os.path.exists("dist"):
        app.router.add_static("/assets", path="dist/assets", name="assets")
        async def index_handler(request):
            return web.FileResponse("dist/index.html")
        app.router.add_get("/", index_handler)

    return app

async def main():
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()
    logger.info("AIS Tactical Server running at http://localhost:8080 (Fleet size: %d)", len(vessels_db))

    await asyncio.gather(
        aisstream_consumer(),
        fleet_simulation_loop()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
