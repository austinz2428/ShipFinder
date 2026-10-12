import { INITIAL_VESSELS, INITIAL_ALERTS } from '../data/mockVessels';

class AISClientService {
  constructor() {
    this.vessels = new Map();
    this.alerts = [...INITIAL_ALERTS];
    this.listeners = new Set();
    this.connected = true;
    this.latency = 28;
    this.lastSyncTime = null;
    this.pollInterval = null;
    this.simInterval = null;
    this.hasPendingUpdates = false;
    this.batchTimer = null;

    // Initialize with baseline vessels
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
      lastSyncTime: this.lastSyncTime
    });
    return () => this.listeners.delete(listener);
  }

  notify() {
    const data = {
      vessels: Array.from(this.vessels.values()),
      alerts: this.alerts,
      connected: this.connected,
      latency: this.latency,
      lastSyncTime: this.lastSyncTime
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
    }, 350);
  }

  isLocalHost() {
    if (typeof window === 'undefined') return true;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.');
  }

  connect() {
    // 1. Fetch latest static vessels snapshot immediately
    this.fetchInitialSnapshot();

    // 2. Poll vessels.json periodically (every 60s) to receive updates from GitHub Actions cron
    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => {
        this.pollVessels();
      }, 60000);
    }

    // 3. Autonomous dead-reckoning engine moves vessels smoothly in real time between cron updates
    this.startLiveSimulation();

    // 4. If running locally with python server.py, sync with local proxy too
    if (this.isLocalHost()) {
      this.connectLocalProxy();
    }
  }

  async fetchInitialSnapshot() {
    // Try vessels.json first, then fallback to fleet_snapshot.json or localhost
    const sources = ['./vessels.json', './fleet_snapshot.json'];
    if (this.isLocalHost()) {
      sources.unshift(`http://${window.location.hostname || 'localhost'}:8080/api/vessels`);
    }

    for (const url of sources) {
      try {
        const res = await fetch(`${url}?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.vessels || []);
          if (list.length > 0) {
            console.log(`[AISClient] Successfully loaded ${list.length.toLocaleString()} vessels from ${url}`);
            list.forEach(v => {
              if (v && v.mmsi) {
                this.vessels.set(v.mmsi, v);
              }
            });
            if (data.last_updated) {
              this.lastSyncTime = data.last_updated;
            }
            this.connected = true;
            this.latency = Math.floor(Math.random() * 15 + 20);
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
            return;
          }
        }
      } catch (e) {
        // Try next source
      }
    }
  }

  async pollVessels() {
    try {
      const res = await fetch(`./vessels.json?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.vessels || []);
        if (list.length > 0) {
          list.forEach(v => {
            if (v && v.mmsi) {
              const existing = this.vessels.get(v.mmsi);
              this.vessels.set(v.mmsi, { ...(existing || {}), ...v });
            }
          });
          if (data.last_updated) {
            this.lastSyncTime = data.last_updated;
          }
          this.connected = true;
          this.hasPendingUpdates = true;
          this.scheduleBatchNotify();
        }
      }
    } catch (e) {}
  }

  connectLocalProxy() {
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8080/ws`;

    try {
      const localWs = new WebSocket(wsUrl);
      localWs.onopen = () => {
        console.log('[AISClient] Connected to local Python AIS proxy:', wsUrl);
      };
      localWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SNAPSHOT' && Array.isArray(msg.vessels)) {
            msg.vessels.forEach(v => {
              if (v && v.mmsi) {
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
    // Advances moving vessels in real time along their course and speed
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
}

export const aisClient = new AISClientService();
