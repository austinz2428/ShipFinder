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

### 3. (Optional) Run the Live AISStream Backend Proxy
To ingest real-time worldwide WebSocket data from `aisstream.io`:
```bash
pip install aiohttp websockets
python server.py
```
*(The frontend automatically connects to `ws://localhost:8080/ws` when running locally, and falls back to autonomous simulation when hosted on static hosts).*

---

## 📦 How to Deploy to GitHub Pages

### Step 1: Initialize Git and Commit
```bash
git init
git add .
git commit -m "Initial commit: ShipFinder tactical maritime intelligence"
```

### Step 2: Push to Your GitHub Repository
Create a new repository on [GitHub](https://github.com/new) named `ShipFinder`, then run:
```bash
git remote add origin https://github.com/<YOUR_USERNAME>/ShipFinder.git
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub: `Settings` → `Pages`.
2. Under **Build and deployment** → **Source**, select:
   - **`GitHub Actions`** (Recommended - uses the included `.github/workflows/deploy.yml` to automatically build and deploy on every push).
3. Within 1–2 minutes, your live site will be published at:
   ```
   https://<YOUR_USERNAME>.github.io/ShipFinder/
   ```

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 4, Tailwind CSS, Lucide React
- **3D Engine**: Three.js (WebGL, PCF Soft Shadows, procedural terrain point-clouds)
- **Mapping**: Leaflet, OpenStreetMap, ESRI World Imagery
- **Backend (Optional)**: Python 3, aiohttp, websockets, AISStream.io API
