# ShipFinder 3D Fairway

ShipFinder is a real-time maritime vessel tracking and 3D topographical visualization platform. It combines live global AIS vessel positions, a dedicated tracker for the Top 20 Great Lakes super-carriers, telemetry dossiers, and WebGL-powered 3D fairway simulations.

---

## Live Demo

- **Web Application**: [https://austinz2428.github.io/ShipFinder/](https://austinz2428.github.io/ShipFinder/)
- **Live Cloud Relay**: [https://shipfinder-relay.onrender.com](https://shipfinder-relay.onrender.com)

---

## Key Features

- **Global Fleet Tracking**: Interactive Leaflet map displaying commercial vessels worldwide with AIS updates, direction vectors, and navigation status.
- **Top 20 Great Lakes Super-Carriers**: Dedicated fleet view tracking the largest Great Lakes freighters, from the 1,013 ft *Paul R. Tregurtha* to the *Sam Laud*.
- **3D Topographical View**: Three.js WebGL viewport rendering vessels over procedural dot-matrix bathymetry and terrain contours, with distinct 3D models for cargo ships, tankers, yachts, tugs, and fishing trawlers.
- **Picture-in-Picture GPS**: Real-time satellite and nautical map tracking synced to the selected vessel in 3D view.
- **Telemetry Dossiers**: Vessel specifications including length overall, beam, draught, destination, ETA, and speed over ground.
- **Dual-Mode Data Pipeline**:
  - **Static CDN Cache**: Instant initial load (<400ms) from GitHub Pages CDN.
  - **Live WebSocket Relay**: Sub-second streaming updates powered by an aiohttp cloud backend.
  - **Dead-Reckoning Engine**: Real-time nautical physics engine advancing underway vessels smoothly between AIS pings.

---

## Architecture

ShipFinder uses a hybrid architecture designed for reliability and instant loading:

1. **Frontend (GitHub Pages)**: Static React/Vite SPA hosted on GitHub Pages CDN.
2. **Background Ingest (GitHub Actions)**: Ingests live AISStream pings every 15 minutes to keep static fleet snapshots fresh.
3. **Live Cloud Relay (Render)**: Python/aiohttp service (`server.py`) that maintains a persistent connection to AISStream.io and broadcasts live WebSocket deltas directly to connected browsers.

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+ (for local backend relay)

### 1. Run the Frontend Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. (Optional) Run the Backend Relay Locally

To connect directly to AISStream locally:

```bash
pip install -r requirements.txt
python server.py
```

The relay binds to `http://localhost:8080` (or `PORT` environment variable) and exposes:
- `GET /health`: Health and fleet stats
- `GET /api/vessels`: Fleet JSON
- `GET /ws`: Real-time WebSocket stream

---

## Deployment

### GitHub Pages (Frontend)

1. Navigate to **Settings** → **Pages** in your GitHub repository.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Push to `main` to trigger the build and deployment workflow (`.github/workflows/deploy.yml`).

### Cloud Relay (Backend)

The backend runs as a Python web service. A [`render.yaml`](render.yaml), [`Dockerfile`](Dockerfile), and [`Procfile`](Procfile) are included for 1-click or container deployment.

To deploy on Render:
1. Create a new **Web Service** on [Render](https://dashboard.render.com/).
2. Connect your repository.
3. Set the environment variable:
   - `AISSTREAM_API_KEY`: Your API key from [aisstream.io](https://aisstream.io).
4. Render will build and run `python server.py`.

---

## Tech Stack

- **Frontend**: React 18, Vite 4, Tailwind CSS, Lucide Icons
- **3D Visualization**: Three.js (WebGL)
- **Mapping**: Leaflet, OpenStreetMap, ESRI World Imagery
- **Backend**: Python 3, aiohttp, websockets, AISStream API
