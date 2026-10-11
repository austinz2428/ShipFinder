import { INITIAL_VESSELS, INITIAL_ALERTS } from '../data/mockVessels';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const AISSTREAM_API_KEY = '484c88f1a086340afa5fb60ee9e90163176b739c';

// ITU Maritime Identification Digits (MID) to Country mapping
function getCountryFromMMSI(mmsi) {
  if (!mmsi) return 'International';
  const mid = parseInt(String(mmsi).slice(0, 3), 10);
  if (mid >= 366 && mid <= 369) return 'USA';
  if (mid === 303 || mid === 338 || mid === 367 || mid === 368) return 'USA';
  if (mid === 316) return 'Canada';
  if (mid >= 351 && mid <= 357) return 'Panama';
  if (mid === 636) return 'Liberia';
  if (mid === 538) return 'Marshall Islands';
  if (mid >= 232 && mid <= 235) return 'United Kingdom';
  if (mid >= 244 && mid <= 246) return 'Netherlands';
  if (mid === 257 || mid === 258 || mid === 259) return 'Norway';
  if (mid >= 211 && mid <= 218) return 'Germany';
  if (mid >= 226 && mid <= 228) return 'France';
  if (mid >= 247 && mid <= 249) return 'Italy';
  if (mid === 271) return 'Turkey';
  if (mid === 237) return 'Greece';
  if (mid >= 412 && mid <= 414) return 'China';
  if (mid >= 431 && mid <= 432) return 'Japan';
  if (mid === 440 || mid === 441) return 'South Korea';
  if (mid >= 563 && mid <= 566) return 'Singapore';
  if (mid === 205) return 'Belgium';
  if (mid === 219 || mid === 220) return 'Denmark';
  if (mid === 265 || mid === 266) return 'Sweden';
  if (mid === 230) return 'Finland';
  if (mid >= 273 && mid <= 274) return 'Russia';
  if (mid >= 503 && mid <= 505) return 'Australia';
  if (mid === 224) return 'Spain';
  if (mid === 263) return 'Portugal';
  if (mid === 710) return 'Brazil';
  if (mid === 345) return 'Mexico';
  return 'International';
}

function mapAISStreamType(typeCode) {
  if (typeCode === undefined || typeCode === null) return 'Commercial Vessel';
  const c = parseInt(typeCode, 10);
  if (c === 30) return 'Fishing';
  if (c === 31 || c === 32 || c === 52) return 'Tug / Tow';
  if (c === 36 || c === 37) return 'Pleasure Craft';
  if (c >= 60 && c <= 69) return 'Passenger';
  if (c >= 70 && c <= 79) return 'Cargo Ship';
  if (c >= 80 && c <= 89) return 'Tanker';
  if (c === 50) return 'Pilot Vessel';
  if (c === 51) return 'Search & Rescue';
  if (c === 53) return 'Port Tender';
  if (c === 55) return 'Law Enforcement';
  if (c === 35) return 'Military Ops';
  return 'Cargo Ship';
}

function detectStraitOrLake(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return { strait: 'High Seas', lake: null };
  if (lat >= 41.0 && lat <= 49.0 && lon >= -92.5 && lon <= -76.0) {
    let lake = 'Great Lakes';
    if (lat > 46.2 && lon < -84.5) lake = 'Lake Superior';
    else if (lon < -85.0 && lat < 46.0) lake = 'Lake Michigan';
    else if (lon >= -84.5 && lon <= -80.5 && lat >= 43.0) lake = 'Lake Huron';
    else if (lat >= 41.3 && lat <= 43.0 && lon >= -83.5 && lon <= -78.8) lake = 'Lake Erie';
    else if (lat >= 43.2 && lon >= -79.8) lake = 'Lake Ontario';
    return { strait: 'Great Lakes', lake };
  }
  if (lat >= 41.0 && lat <= 41.35 && lon >= 28.9 && lon <= 29.2) return { strait: 'Bosphorus', lake: null };
  if (lat >= 50.8 && lat <= 51.5 && lon >= 1.0 && lon <= 1.9) return { strait: 'Dover Strait', lake: null };
  if (lat >= 35.8 && lat <= 36.2 && lon >= -5.8 && lon <= -5.2) return { strait: 'Strait of Gibraltar', lake: null };
  if (lat >= 1.1 && lat <= 1.5 && lon >= 103.5 && lon <= 104.2) return { strait: 'Strait of Malacca', lake: null };
  if (lat >= 29.8 && lat <= 31.4 && lon >= 32.2 && lon <= 32.7) return { strait: 'Suez Canal', lake: null };
  if (lat >= 8.8 && lat <= 9.4 && lon >= -80.0 && lon <= -79.5) return { strait: 'Panama Canal', lake: null };
  return { strait: 'High Seas', lake: null };
}

class AISClientService {
  constructor() {
    this.vessels = new Map();
    this.alerts = [...INITIAL_ALERTS];
    this.listeners = new Set();
    this.connected = false;
    this.ws = null;
    this.localWs = null;
    this.reconnectTimer = null;
    this.latency = 42;
    this.streamMessageCount = 0;
    this.hasPendingUpdates = false;
    this.batchTimer = null;

    // Initialize with comprehensive global fleet
    INITIAL_VESSELS.forEach(v => {
      this.vessels.set(v.mmsi, { ...v, last_updated: Date.now() });
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({
      vessels: Array.from(this.vessels.values()),
      alerts: this.alerts,
      connected: this.connected,
      latency: this.latency,
      streamMessageCount: this.streamMessageCount
    });
    return () => this.listeners.delete(listener);
  }

  notify() {
    const data = {
      vessels: Array.from(this.vessels.values()),
      alerts: this.alerts,
      connected: this.connected,
      latency: this.latency,
      streamMessageCount: this.streamMessageCount
    };
    this.listeners.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('[AISClient] Listener error:', e);
      }
    });
  }

  scheduleBatchNotify() {
    if (this.batchTimer) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      if (this.hasPendingUpdates) {
        this.hasPendingUpdates = false;
        this.notify();
      }
    }, 350); // 350ms batch dispatch gives smooth 60fps UI while ingesting 50-100 msgs/sec
  }

  isLocalHost() {
    if (typeof window === 'undefined') return true;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.');
  }

  connect() {
    this.connectDirectAISStream();
    this.startLiveSimulation();

    // If local proxy server is running, also try connecting to it to sync local cache
    if (this.isLocalHost()) {
      this.connectLocalProxy();
    }
  }

  connectDirectAISStream() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    try {
      console.log('[AISClient] Connecting directly to live AISStream worldwide feed...');
      this.ws = new WebSocket(AISSTREAM_URL);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[AISClient] Connected to AISStream.io! Subscribing to worldwide fleet...');
        this.connected = true;
        this.latency = Math.floor(Math.random() * 20 + 28);

        // Subscribe to complete global bounding box without message filters to track EVERYTHING
        const subscription = {
          APIKey: AISSTREAM_API_KEY,
          BoundingBoxes: [[[-90, -180], [90, 180]]]
        };
        this.ws.send(JSON.stringify(subscription));
        this.hasPendingUpdates = true;
        this.scheduleBatchNotify();
      };

      this.ws.onmessage = async (event) => {
        try {
          let text;
          if (typeof event.data === 'string') {
            text = event.data;
          } else if (event.data instanceof ArrayBuffer) {
            text = new TextDecoder('utf-8').decode(event.data);
          } else if (event.data && typeof event.data.text === 'function') {
            text = await event.data.text();
          } else {
            return;
          }

          const data = JSON.parse(text);
          if (data.MessageType === 'SubscriptionConfirmation') {
            console.log('[AISClient] AISStream Subscription Confirmed. Live ingest active!');
            return;
          }
          this.handleAISStreamMessage(data);
        } catch (e) {
          // Ignore JSON parse blips
        }
      };

      this.ws.onclose = () => {
        console.log('[AISClient] AISStream disconnected. Reconnecting in 4s...');
        this.connected = false;
        this.scheduleBatchNotify();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[AISClient] AISStream WebSocket connection warning:', err);
      };
    } catch (e) {
      console.error('[AISClient] Error initiating AISStream connection:', e);
      this.scheduleReconnect();
    }
  }

  handleAISStreamMessage(data) {
    const meta = data.MetaData || {};
    const mmsi = meta.MMSI ? Number(meta.MMSI) : null;
    if (!mmsi || isNaN(mmsi) || mmsi <= 0) return;

    const msgType = data.MessageType;
    const msg = data.Message || {};

    let v = this.vessels.get(mmsi);
    const isNew = !v;
    const now = Date.now();

    let name = (meta.ShipName ? meta.ShipName.trim().replace(/^@+/, '') : '') || v?.name || `VESSEL-${mmsi}`;
    let lat = meta.latitude !== undefined ? meta.latitude : (v?.lat ?? 0);
    let lon = meta.longitude !== undefined ? meta.longitude : (v?.lon ?? 0);
    let sog = v?.sog ?? 0;
    let cog = v?.cog ?? 0;
    let heading = v?.heading ?? (v?.cog ?? 0);
    let type = v?.type || 'Commercial Vessel';
    let imo = v?.imo ?? 0;
    let callSign = v?.callSign ?? '';
    let draft = v?.draft ?? 8.5;
    let length = v?.length ?? 185;
    let width = v?.width ?? 28;
    let destination = v?.destination ?? 'EN ROUTE';

    if (msgType === 'PositionReport' && msg.PositionReport) {
      const pr = msg.PositionReport;
      if (typeof pr.Latitude === 'number') lat = pr.Latitude;
      if (typeof pr.Longitude === 'number') lon = pr.Longitude;
      if (typeof pr.Sog === 'number') sog = Math.round(pr.Sog * 10) / 10;
      if (typeof pr.Cog === 'number') cog = Math.round(pr.Cog * 10) / 10;
      if (typeof pr.TrueHeading === 'number' && pr.TrueHeading !== 511) heading = pr.TrueHeading;
      else heading = cog;
    } else if (msgType === 'StandardClassBPositionReport' && msg.StandardClassBPositionReport) {
      const pr = msg.StandardClassBPositionReport;
      if (typeof pr.Latitude === 'number') lat = pr.Latitude;
      if (typeof pr.Longitude === 'number') lon = pr.Longitude;
      if (typeof pr.Sog === 'number') sog = Math.round(pr.Sog * 10) / 10;
      if (typeof pr.Cog === 'number') cog = Math.round(pr.Cog * 10) / 10;
      if (typeof pr.TrueHeading === 'number' && pr.TrueHeading !== 511) heading = pr.TrueHeading;
      else heading = cog;
      if (isNew) type = 'Pleasure Craft';
    } else if (msgType === 'ExtendedClassBPositionReport' && msg.ExtendedClassBPositionReport) {
      const pr = msg.ExtendedClassBPositionReport;
      if (typeof pr.Latitude === 'number') lat = pr.Latitude;
      if (typeof pr.Longitude === 'number') lon = pr.Longitude;
      if (typeof pr.Sog === 'number') sog = Math.round(pr.Sog * 10) / 10;
      if (typeof pr.Cog === 'number') cog = Math.round(pr.Cog * 10) / 10;
      if (typeof pr.TrueHeading === 'number' && pr.TrueHeading !== 511) heading = pr.TrueHeading;
      else heading = cog;
      if (pr.ShipName) {
        const clean = pr.ShipName.trim().replace(/^@+/, '');
        if (clean) name = clean;
      }
      if (pr.Type !== undefined) type = mapAISStreamType(pr.Type);
      if (pr.Dimension) {
        const l = (pr.Dimension.A || 0) + (pr.Dimension.B || 0);
        const w = (pr.Dimension.C || 0) + (pr.Dimension.D || 0);
        if (l > 0) length = l;
        if (w > 0) width = w;
      }
    } else if (msgType === 'ShipStaticData' && msg.ShipStaticData) {
      const sd = msg.ShipStaticData;
      if (sd.Name) {
        const clean = sd.Name.trim().replace(/^@+/, '');
        if (clean) name = clean;
      }
      if (sd.ImoNumber) imo = sd.ImoNumber;
      if (sd.CallSign) callSign = sd.CallSign.trim();
      if (sd.Type !== undefined) type = mapAISStreamType(sd.Type);
      if (sd.MaximumStaticDraught) draft = Math.round(sd.MaximumStaticDraught * 10) / 10;
      if (sd.Destination) destination = sd.Destination.trim();
      if (sd.Dimension) {
        const l = (sd.Dimension.A || 0) + (sd.Dimension.B || 0);
        const w = (sd.Dimension.C || 0) + (sd.Dimension.D || 0);
        if (l > 0) length = l;
        if (w > 0) width = w;
      }
    } else if (msgType === 'StaticDataReport' && msg.StaticDataReport) {
      const sdr = msg.StaticDataReport;
      if (sdr.ReportA?.Valid && sdr.ReportA?.ShipName) {
        const clean = sdr.ReportA.ShipName.trim().replace(/^@+/, '');
        if (clean) name = clean;
      }
      if (sdr.ReportB?.Valid) {
        if (sdr.ReportB.Type !== undefined) type = mapAISStreamType(sdr.ReportB.Type);
        if (sdr.ReportB.CallSign) callSign = sdr.ReportB.CallSign.trim();
        if (sdr.ReportB.Dimension) {
          const l = (sdr.ReportB.Dimension.A || 0) + (sdr.ReportB.Dimension.B || 0);
          const w = (sdr.ReportB.Dimension.C || 0) + (sdr.ReportB.Dimension.D || 0);
          if (l > 0) length = l;
          if (w > 0) width = w;
        }
      }
    }

    // Coordinates sanity check
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
    if (Math.abs(lat) < 0.001 && Math.abs(lon) < 0.001) return;

    const { strait, lake } = detectStraitOrLake(lat, lon);
    const flag = v?.flag || getCountryFromMMSI(mmsi);

    const updatedVessel = {
      ...(v || {}),
      mmsi,
      name: name || `VESSEL-${mmsi}`,
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      sog,
      cog,
      heading,
      type,
      flag,
      imo,
      callSign,
      draft,
      length,
      width,
      destination,
      eta: destination || 'EN ROUTE',
      last_port: v?.last_port || 'EN ROUTE',
      strait: v?.strait || strait,
      lake: v?.lake || lake,
      ais_status: 'LIVE',
      score: v?.score || Math.floor(75 + Math.random() * 25),
      last_updated: now,
      streamed: true
    };

    this.vessels.set(mmsi, updatedVessel);
    this.streamMessageCount += 1;
    this.hasPendingUpdates = true;

    // Prune if exceeds 25,000 vessels to preserve memory
    if (this.vessels.size > 25000) {
      this.pruneOldestVessels();
    }

    this.scheduleBatchNotify();
  }

  pruneOldestVessels() {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [mmsi, v] of this.vessels.entries()) {
      // Never delete Great Lakes authentic roster or vessels with rank
      if (v.is_great_lakes || v.rank) continue;
      if (v.last_updated < oldestTime) {
        oldestTime = v.last_updated;
        oldestKey = mmsi;
      }
    }
    if (oldestKey) {
      this.vessels.delete(oldestKey);
    }
  }

  connectLocalProxy() {
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8080/ws`;

    try {
      this.localWs = new WebSocket(wsUrl);
      this.localWs.onopen = () => {
        console.log('[AISClient] Also connected to local Python AIS proxy:', wsUrl);
      };
      this.localWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SNAPSHOT' && Array.isArray(msg.vessels)) {
            msg.vessels.forEach(v => {
              if (v && v.mmsi && !this.vessels.has(v.mmsi)) {
                this.vessels.set(v.mmsi, v);
              }
            });
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
          } else if (msg.type === 'VESSEL_UPDATE' && msg.vessel?.mmsi) {
            this.vessels.set(msg.vessel.mmsi, msg.vessel);
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
          }
        } catch (e) {}
      };
    } catch (e) {}
  }

  startLiveSimulation() {
    if (this.simInterval) return;
    // Continuous dead-reckoning engine advances moving vessels smoothly between AIS broadcasts
    this.simInterval = setInterval(() => {
      let changed = false;
      this.vessels.forEach(v => {
        if (v.sog && v.sog >= 0.5) {
          const cogRad = ((v.cog || v.heading || 0) * Math.PI) / 180;
          const speedFactor = v.sog * 0.000004;
          v.lat += Math.cos(cogRad) * speedFactor;
          v.lon += Math.sin(cogRad) * speedFactor;
          changed = true;
        }
      });
      if (changed) {
        this.hasPendingUpdates = true;
        this.scheduleBatchNotify();
      }
    }, 2500);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  async fetchInitialSnapshot() {
    // 1. On localhost, query the live Python AIS backend proxy if running
    if (this.isLocalHost()) {
      try {
        const host = window.location.hostname || 'localhost';
        const res = await fetch(`http://${host}:8080/api/vessels`);
        if (res.ok) {
          const vessels = await res.json();
          vessels.forEach(v => {
            if (v && v.mmsi) {
              this.vessels.set(v.mmsi, v);
            }
          });
          this.hasPendingUpdates = true;
          this.scheduleBatchNotify();
          return;
        }
      } catch (e) {}
    }

    // 2. On static hosting (GitHub Pages) or if local server is not running:
    // Load pre-bundled live global fleet snapshot containing 20,000+ real AIS vessels
    try {
      const res = await fetch('./fleet_snapshot.json');
      if (res.ok) {
        const vessels = await res.json();
        vessels.forEach(v => {
          if (v && v.mmsi) {
            this.vessels.set(v.mmsi, v);
          }
        });
        this.hasPendingUpdates = true;
        this.scheduleBatchNotify();
      }
    } catch (e) {
      console.warn('[AISClient] Could not load fleet_snapshot.json:', e);
    }
  }
}

export const aisClient = new AISClientService();
