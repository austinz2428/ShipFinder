import { INITIAL_VESSELS, INITIAL_ALERTS } from '../data/mockVessels';

const DEFAULT_RELAY_URL = 'https://shipfinder-relay.onrender.com';

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
    this.pingInterval = null;
    this.hasPendingUpdates = false;
    this.batchTimer = null;
    this.ws = null;
    this.feedMode = 'CRON_SNAPSHOT'; // 'LIVE_RELAY' | 'CRON_SNAPSHOT'
    this.relayUrl = this.getSavedRelayUrl();
    this.pingStartTime = 0;

    // Initialize with baseline vessels
    INITIAL_VESSELS.forEach(v => {
      this.vessels.set(v.mmsi, { ...v, last_updated: Date.now() });
    });
  }

  getSavedRelayUrl() {
    if (typeof window === 'undefined') return DEFAULT_RELAY_URL;
    if (window.localStorage.getItem('shipfinder_relay_disabled') === 'true') {
      return null;
    }
    const stored = window.localStorage.getItem('shipfinder_relay_url');
    if (stored) return stored.trim();
    if (import.meta.env?.VITE_AIS_RELAY_URL) {
      return import.meta.env.VITE_AIS_RELAY_URL.trim();
    }
    if (this.isLocalHost()) {
      return `http://${window.location.hostname || 'localhost'}:8080`;
    }
    // Built-in Render URL: 100% automatic connection with zero copy-pasting!
    return DEFAULT_RELAY_URL;
  }

  saveRelayUrl(url) {
    if (typeof window === 'undefined') return;
    if (url) {
      window.localStorage.setItem('shipfinder_relay_url', url.trim());
      window.localStorage.removeItem('shipfinder_relay_disabled');
      this.relayUrl = url.trim();
    } else {
      window.localStorage.removeItem('shipfinder_relay_url');
      this.relayUrl = null;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState() {
    return {
      vessels: Array.from(this.vessels.values()),
      alerts: this.alerts,
      connected: this.connected,
      latency: this.latency,
      lastSyncTime: this.lastSyncTime,
      feedMode: this.feedMode,
      relayUrl: this.relayUrl
    };
  }

  notify() {
    const data = this.getState();
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
    }, 250);
  }

  isLocalHost() {
    if (typeof window === 'undefined') return true;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.');
  }

  connect() {
    // 1. Fetch initial static fleet snapshot immediately so UI renders in <1s
    this.fetchInitialSnapshot();

    // 2. Start dead-reckoning engine to smoothly advance moving ships
    this.startLiveSimulation();

    // 3. Connect to live cloud relay if configured or localhost
    if (this.relayUrl || this.isLocalHost()) {
      this.connectCloudRelay(this.relayUrl);
    } else {
      // Otherwise poll static vessels.json periodically
      this.startCronPolling();
    }
  }

  startCronPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      if (this.feedMode === 'CRON_SNAPSHOT') {
        this.pollVessels();
      }
    }, 60000);
  }

  async fetchInitialSnapshot() {
    const sources = [];
    if (this.relayUrl) {
      const httpBase = this.relayUrl.replace(/^wss?:\/\//i, (m) => m.toLowerCase().startsWith('wss') ? 'https://' : 'http://').replace(/\/ws\/?$/i, '');
      sources.push(`${httpBase}/api/vessels`);
    } else if (this.isLocalHost()) {
      sources.push(`http://${window.location.hostname || 'localhost'}:8080/api/vessels`);
    }

    sources.push('./vessels.json', './fleet_snapshot.json');

    for (const url of sources) {
      try {
        const res = await fetch(`${url}?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.vessels || []);
          if (list.length > 0) {
            console.log(`[AISClient] Loaded ${list.length.toLocaleString()} vessels from ${url}`);
            list.forEach(v => {
              if (v && v.mmsi) {
                this.vessels.set(v.mmsi, v);
              }
            });
            if (data.last_updated) {
              this.lastSyncTime = data.last_updated;
            }
            this.connected = true;
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
            return;
          }
        }
      } catch (e) {
        // Continue to fallback source
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

  connectCloudRelay(targetUrl) {
    if (!targetUrl && this.isLocalHost()) {
      targetUrl = `http://${window.location.hostname || 'localhost'}:8080`;
    }
    if (!targetUrl) return;

    this.saveRelayUrl(targetUrl);

    // Normalize URL to wss:// or ws://
    let wsUrl = targetUrl.trim();
    if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    } else if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    } else if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = `wss://${wsUrl}`;
    }
    if (!wsUrl.endsWith('/ws')) {
      wsUrl = wsUrl.replace(/\/+$/, '') + '/ws';
    }

    // Close any previous socket
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }

    console.log('[AISClient] Connecting to live cloud relay WebSocket:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[AISClient] 🟢 Connected to Cloud Relay:', wsUrl);
        this.connected = true;
        this.feedMode = 'LIVE_RELAY';
        this.hasPendingUpdates = true;
        this.scheduleBatchNotify();

        // Start ping/pong latency monitor
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.pingStartTime = Date.now();
            try {
              this.ws.send(JSON.stringify({ type: 'PING' }));
            } catch (e) {}
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'PONG') {
            this.latency = Math.max(12, Date.now() - this.pingStartTime);
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
            return;
          }

          if (msg.type === 'SNAPSHOT' && Array.isArray(msg.vessels)) {
            msg.vessels.forEach(v => {
              if (v && v.mmsi) {
                this.vessels.set(v.mmsi, v);
              }
            });
            if (msg.alerts) {
              this.alerts = msg.alerts;
            }
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
          } else if (msg.type === 'VESSEL_BATCH' && Array.isArray(msg.vessels)) {
            msg.vessels.forEach(v => {
              if (v && v.mmsi) {
                const existing = this.vessels.get(v.mmsi);
                this.vessels.set(v.mmsi, { ...(existing || {}), ...v });
              }
            });
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
          } else if (msg.type === 'VESSEL_UPDATE' && msg.vessel?.mmsi) {
            const v = msg.vessel;
            const existing = this.vessels.get(v.mmsi);
            this.vessels.set(v.mmsi, { ...(existing || {}), ...v });
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
          }
        } catch (e) {
          console.warn('[AISClient] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[AISClient] WebSocket closed. Reverting to static cron feed.');
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.feedMode = 'CRON_SNAPSHOT';
        this.startCronPolling();
        this.hasPendingUpdates = true;
        this.scheduleBatchNotify();
      };

      ws.onerror = (err) => {
        console.warn('[AISClient] Cloud Relay connection error:', err);
      };
    } catch (e) {
      console.warn('[AISClient] WebSocket initiation error:', e);
      this.feedMode = 'CRON_SNAPSHOT';
      this.startCronPolling();
    }
  }

  disconnectCloudRelay() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('shipfinder_relay_disabled', 'true');
    }
    this.saveRelayUrl(null);
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.feedMode = 'CRON_SNAPSHOT';
    this.startCronPolling();
    this.hasPendingUpdates = true;
    this.scheduleBatchNotify();
  }

  startLiveSimulation() {
    if (this.simInterval) return;
    // Dead-reckoning: smoothly advances moving vessels in real-time along their course & speed
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
    }, 2000);
  }
}

export const aisClient = new AISClientService();
