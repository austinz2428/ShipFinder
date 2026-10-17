# 🚢 ShipFinder 3D Fairway

A sleek, modern maritime vessel tracker and 3D topographical simulator featuring live AIS ingestion, an authentic global fleet, the **Top 20 Largest Great Lakes super-carriers**, interactive telemetry in feet, and real-time 3D topographical visualization with custom vessel models.

---

## ✨ Features

- **🌐 Global Fleet & Top 20 Great Lakes Super-Carriers**:
  - Live interactive map powered by Leaflet tracking vessels worldwide.
  - Dedicated **"⚓ TOP 20 GREAT LAKES"** tab featuring the 20 largest Great Lakes freighters ranked from the **#1 Paul R. Tregurtha (1,013 ft)** down to the **#20 Sam Laud (635 ft)**.
- **🏔️ 3D Topographical View**:
  - Real-time WebGL/Three.js fairway visualization with contoured dot-matrix heightfield terrain.
  - Symmetrical, mathematically straight naval architecture bows (`createTaperedBowGeometry`) with zero diamond or crooked distortions.
  - **5 Distinct 3D Vessel Models** dynamically selected by fleet type:
    - **Cargo / Container Freighter**: Multi-tier aft bridge with wings, radar mast, and colorful stacks of 20ft/40ft shipping containers.
    - **Tanker**: High-gloss maritime international orange hull, elevated centerline catwalk, longitudinal pipelines, midships hose cranes, and split twin funnels.
    - **Luxury Superyacht**: Pearl white glossy hull with cyan waterline boot-stripe, razor-sharp reverse-raked vertical axe bow, teak decks, smoked panoramic glass, and aft cascading swim platform.
    - **Tug / Workboat**: Muscular ocean blue hull with safety yellow sheer bulwarks, thick matte black rubber bow push fender, 360° panoramic wheelhouse, and industrial towing winch.
    - **Fishing Trawler**: Emerald green hull, forward-set wheelhouse, working trawl deck, towering bright yellow stern A-frame gantry, and outrigger stabilizer booms.
- **🛰️ Live Mini GPS Screen**:
  - Pinned to the right side in 3D view, continuously tracking the vessel's real coordinates and heading over live satellite/nautical tiles.
- **📏 Ship Dimensions in Feet**:
  - Vessel Information dossier displays length overall (LOA), beam (width), and draught in feet.
- **🚨 Interactive Maritime Alerts**:
  - Real-time alert monitor in the top header tracking critical signal gaps, traffic queues, and channel advisories with 1-click vessel focus.
- **⚡ GitHub Pages Ready**:
  - Built-in Autonomous Live Simulation Engine with dead reckoning so the app runs smoothly as a static site on GitHub Pages even without a local backend.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Frontend
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 3. (Optional) Run the Live AISStream Backend Proxy Locally
To ingest real-time worldwide WebSocket data from `aisstream.io` locally:
```bash
pip install -r requirements.txt
python server.py
```

---

## ⚡ Automated Scheduled Ingest (Cron every 15 mins)

The repository includes a serverless GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):
1. **Runs every 15 minutes** on a scheduled cron trigger (and on manual trigger / git push).
2. Runs [`scripts/update_ais.py`](scripts/update_ais.py) using your private `AISSTREAM_API_KEY` stored securely in GitHub Secrets.
3. Listens to AISStream for 40 seconds to collect real-time vessel updates worldwide.
4. Generates static `public/vessels.json` and `public/vessels.geojson`, commits the dataset with `[skip ci]`, and deploys to GitHub Pages.
5. The frontend loads `fetch('./vessels.json')` without exposing any API keys to web visitors.

### 🔑 Adding Your API Key to GitHub Secrets:
1. Go to `Settings` → `Secrets and variables` → `Actions` → `New repository secret`.
2. Name: `AISSTREAM_API_KEY`.
3. Secret: Paste your private API key from `aisstream.io`.

---

## 🌐 Option 2: 24/7 Live Cloud Relay (VesselFinder-Style Real-Time Streaming)

For **0-second real-time vessel movements** just like VesselFinder, deploy the included `server.py` to a free cloud service:

### 1-Click Deployment on Render.com (Free)
1. Go to [**Render Dashboard**](https://dashboard.render.com/) → **New** → **Web Service**.
2. Connect your GitHub repository: `austinz2428/ShipFinder`.
3. Render will automatically detect [`render.yaml`](render.yaml) and start `python server.py`.
4. Copy your live Render URL (e.g. `https://shipfinder-relay.onrender.com`).
5. In your web app, click the **LIVE RELAY / CRON SYNC** button in the top bar, paste your Render URL, and click **Connect Live Stream**!

### Docker / Fly.io / Railway
A production [`Dockerfile`](Dockerfile) and [`Procfile`](Procfile) are provided in the root directory. To run with Docker:
```bash
docker build -t shipfinder-relay .
docker run -p 8080:8080 -e AISSTREAM_API_KEY=your_key shipfinder-relay
```

---

## 📦 How to Deploy Frontend to GitHub Pages

1. Go to your repository on GitHub: `Settings` → `Pages`.
2. Under **Build and deployment** → **Source**, select **`GitHub Actions`**.
3. Live site: **`https://<YOUR_USERNAME>.github.io/ShipFinder/`**

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 4, Tailwind CSS, Lucide React
- **3D Engine**: Three.js (WebGL, PCF Soft Shadows, procedural terrain point-clouds)
- **Mapping**: Leaflet, OpenStreetMap, ESRI World Imagery
- **Backend (Optional)**: Python 3, aiohttp, websockets, AISStream.io API
