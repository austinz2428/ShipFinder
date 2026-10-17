import asyncio
import json
import os
import sys
import websockets

API_KEY = "484c88f1a086340afa5fb60ee9e90163176b739c"

async def main():
    print("Connecting to AISStream...")
    async with websockets.connect("wss://stream.aisstream.io/v0/stream") as ws:
        sub = {
            "APIKey": API_KEY,
            "BoundingBoxes": [
                [[41.0, -93.5], [49.5, -74.5]],   # Great Lakes
                [[24.0, -98.0], [45.0, -65.0]],   # US East / Gulf
            ]
        }
        await ws.send(json.dumps(sub))
        print("Subscribed! Listening for 20 position reports...")
        count = 0
        while count < 20:
            msg = await ws.recv()
            d = json.loads(msg)
            msg_type = d.get("MessageType")
            meta = d.get("MetaData", {})
            lat = meta.get("latitude")
            lon = meta.get("longitude")
            if lat is None or lon is None or lat == 0 or lon == 0:
                continue
            name = meta.get("ShipName", "").strip() or f"MMSI-{meta.get('MMSI')}"
            mmsi = meta.get("MMSI")
            msg_body = d.get("Message", {}).get(msg_type, {})
            sog = msg_body.get("Sog", 0.0)
            hdg = msg_body.get("TrueHeading", 0)
            time_utc = meta.get("time_utc", "")
            print(f"[{count+1}] {name:<25} (MMSI: {mmsi}) | Lat: {lat:.5f}, Lon: {lon:.5f} | SOG: {sog} KN | HDG: {hdg} deg | {time_utc}")
            sys.stdout.flush()
            count += 1

if __name__ == "__main__":
    asyncio.run(main())
