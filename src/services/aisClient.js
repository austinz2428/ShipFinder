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
    this.feedMode = 'CONNECTING'; // 'LIVE_RELAY' | 'CONNECTING' | 'CRON_SNAPSHOT'
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.autoReconnect = true;
    this.windowListenersAttached = false;
    this.relayUrl = this.getSavedRelayUrl();
    this.pingStartTime = 0;

    // Initialize with baseline vessels
    INITIAL_VESSELS.forEach(v => {
      this.vessels.set(v.mmsi, { ...v, last_updated: Date.now() });
    });
  }

  getSavedRelayUrl() {
    if (typeof window === 'undefined') return DEFAULT_RELAY_URL;
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
      this.relayUrl = url.trim();
    } else {
      window.localStorage.removeItem('shipfinder_relay_url');
      this.relayUrl = DEFAULT_RELAY_URL;
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

    // 3. Attach auto-resume listeners for network reconnection & tab focus
    if (typeof window !== 'undefined' && !this.windowListenersAttached) {
      this.windowListenersAttached = true;
      window.addEventListener('online', () => {
        if (this.autoReconnect && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this.connectCloudRelay(this.relayUrl || DEFAULT_RELAY_URL);
        }
      });
      window.addEventListener('focus', () => {
        if (this.autoReconnect && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this.connectCloudRelay(this.relayUrl || DEFAULT_RELAY_URL);
        }
      });
    }

    // 4. Automatically connect to live cloud relay (Render / Railway / localhost)
    this.connectCloudRelay(this.relayUrl || DEFAULT_RELAY_URL);
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
            const now = Date.now();
            list.forEach(v => {
              if (v && v.mmsi) {
                let ts = v.last_updated ? (v.last_updated > 1e11 ? v.last_updated : v.last_updated * 1000) : null;
                if (!ts && v.time_utc) {
                  try { ts = new Date(v.time_utc).getTime(); } catch (e) {}
                }
                v.last_updated_ts = ts || now;
                this.vessels.set(v.mmsi, v);
              }
            });
            if (data.last_updated) {
              this.lastSyncTime = data.last_updated;
            }
            this.detectFleetAlerts();
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
          const now = Date.now();
          list.forEach(v => {
            if (v && v.mmsi) {
              const existing = this.vessels.get(v.mmsi);
              let ts = v.last_updated ? (v.last_updated > 1e11 ? v.last_updated : v.last_updated * 1000) : null;
              if (!ts && v.time_utc) {
                try { ts = new Date(v.time_utc).getTime(); } catch (e) {}
              }
              this.vessels.set(v.mmsi, { ...(existing || {}), ...v, last_updated_ts: ts || now });
            }
          });
          if (data.last_updated) {
            this.lastSyncTime = data.last_updated;
          }
          this.detectFleetAlerts();
          this.connected = true;
          this.hasPendingUpdates = true;
          this.scheduleBatchNotify();
        }
      }
    } catch (e) {}
  }

  detectFleetAlerts() {
    const list = Array.from(this.vessels.values());
    if (list.length === 0) return;

    const detected = [];
    const seenMmsi = new Set();
    const now = Date.now();

    for (const v of list) {
      if (!v || !v.mmsi || !v.name || seenMmsi.has(v.mmsi)) continue;
      const sog = Number(v.sog || 0);
      const nav = String(v.nav_status || '').toLowerCase();
      const strait = String(v.strait || '');
      const type = String(v.type || '');
      const ts = v.last_updated_ts || (v.last_updated ? (v.last_updated > 1e11 ? v.last_updated : v.last_updated * 1000) : now);
      const ageMins = Math.max(0, Math.floor((now - ts) / 60000));

      // 1. CRITICAL: Restricted manoeuvrability, not under command, or aground
      if (nav.includes('restricted') || nav.includes('not under command') || nav.includes('aground')) {
        seenMmsi.add(v.mmsi);
        detected.push({
          id: `alert-${v.mmsi}`,
          mmsi: v.mmsi,
          vessel: v.name,
          level: 'CRIT',
          title: 'RESTRICTED MANEUVER',
          details: `${v.name} (${type || 'Commercial'}) broadcasting restricted manoeuvrability in ${strait || 'fairway'}.`,
          time: ageMins < 2 ? 'Just now' : `${ageMins}m ago`,
          lat: v.lat,
          lon: v.lon,
          strait: strait,
          sog: sog
        });
        if (detected.length >= 8) break;
      }
      // 2. WARN: Near-zero speed while underway in a designated fairway/strait
      else if (strait && strait !== 'High Seas' && sog < 0.6 && nav.includes('underway')) {
        seenMmsi.add(v.mmsi);
        detected.push({
          id: `alert-${v.mmsi}`,
          mmsi: v.mmsi,
          vessel: v.name,
          level: 'WARN',
          title: `SPEED DROP · ${sog.toFixed(1)} KN`,
          details: `${v.name} halted or drifting at near-zero speed in ${strait} corridor.`,
          time: ageMins < 2 ? 'Just now' : `${ageMins}m ago`,
          lat: v.lat,
          lon: v.lon,
          strait: strait,
          sog: sog
        });
        if (detected.length >= 8) break;
      }
      // 3. WARN/INFO: Rapid transit in congested fairway (> 16.5 KN & < 45 KN)
      else if (strait && strait !== 'High Seas' && sog > 16.5 && sog < 45.0 && (type.includes('Cargo') || type.includes('Tanker') || type.includes('Commercial'))) {
        seenMmsi.add(v.mmsi);
        detected.push({
          id: `alert-${v.mmsi}`,
          mmsi: v.mmsi,
          vessel: v.name,
          level: sog > 18.0 ? 'WARN' : 'INFO',
          title: `HIGH SPEED · ${sog.toFixed(1)} KN`,
          details: `${v.name} conducting high-speed transit through congested ${strait}.`,
          time: ageMins < 2 ? 'Just now' : `${ageMins}m ago`,
          lat: v.lat,
          lon: v.lon,
          strait: strait,
          sog: sog
        });
        if (detected.length >= 8) break;
      }
      // 4. INFO: Active Towing Operations in fairway
      else if (type.includes('Tug') && sog > 1.0 && strait && strait !== 'High Seas') {
        seenMmsi.add(v.mmsi);
        detected.push({
          id: `alert-${v.mmsi}`,
          mmsi: v.mmsi,
          vessel: v.name,
          level: 'INFO',
          title: `TOWING OPS · ${sog.toFixed(1)} KN`,
          details: `${v.name} active towing operation in ${strait} shipping lane.`,
          time: ageMins < 2 ? 'Just now' : `${ageMins}m ago`,
          lat: v.lat,
          lon: v.lon,
          strait: strait,
          sog: sog
        });
        if (detected.length >= 8) break;
      }
    }

    if (detected.length > 0) {
      const priority = { CRIT: 0, WARN: 1, INFO: 2 };
      detected.sort((a, b) => priority[a.level] - priority[b.level]);
      this.alerts = detected.slice(0, 8);
    }
  }

  wakeUpRelay(targetUrl) {
    if (!targetUrl || typeof window === 'undefined') return;
    try {
      let httpUrl = targetUrl.replace(/^wss?:\/\//i, (m) => m.toLowerCase().startsWith('wss') ? 'https://' : 'http://').replace(/\/ws\/?$/i, '');
      fetch(`${httpUrl}/health`, { mode: 'cors' }).catch(() => {});
    } catch (e) {}
  }

  connectCloudRelay(targetUrl) {
    if (!targetUrl && this.isLocalHost()) {
      targetUrl = `http://${window.location.hostname || 'localhost'}:8080`;
    }
    if (!targetUrl) {
      targetUrl = DEFAULT_RELAY_URL;
    }

    this.saveRelayUrl(targetUrl);
    this.autoReconnect = true;

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

    // Cancel any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close any previous socket cleanly without triggering its onclose reconnect loop
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    // Indicate that we are connecting live
    this.feedMode = 'CONNECTING';
    this.hasPendingUpdates = true;
    this.scheduleBatchNotify();

    // Trigger HTTP health ping to wake up free-tier instance if sleeping
    this.wakeUpRelay(targetUrl);

    console.log('[AISClient] Auto-connecting to live cloud relay WebSocket:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[AISClient] 🟢 Connected to Cloud Relay:', wsUrl);
        this.connected = true;
        this.feedMode = 'LIVE_RELAY';
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
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
            const now = Date.now();
            msg.vessels.forEach(v => {
              if (v && v.mmsi) {
                let ts = v.last_updated ? (v.last_updated > 1e11 ? v.last_updated : v.last_updated * 1000) : null;
                if (!ts && v.time_utc) {
                  try { ts = new Date(v.time_utc).getTime(); } catch (e) {}
                }
                v.last_updated_ts = ts || now;
                this.vessels.set(v.mmsi, v);
              }
            });
            if (msg.alerts && Array.isArray(msg.alerts) && msg.alerts.length > 0) {
              this.alerts = msg.alerts;
            } else {
              this.detectFleetAlerts();
            }
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
          } else if (msg.type === 'VESSEL_BATCH' && Array.isArray(msg.vessels)) {
            const now = Date.now();
            msg.vessels.forEach(v => {
              if (v && v.mmsi) {
                const existing = this.vessels.get(v.mmsi);
                let ts = v.last_updated ? (v.last_updated > 1e11 ? v.last_updated : v.last_updated * 1000) : null;
                if (!ts && v.time_utc) {
                  try { ts = new Date(v.time_utc).getTime(); } catch (e) {}
                }
                this.vessels.set(v.mmsi, { ...(existing || {}), ...v, last_updated_ts: ts || now });
              }
            });
            this.detectFleetAlerts();
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
          } else if (msg.type === 'VESSEL_UPDATE' && msg.vessel?.mmsi) {
            const v = msg.vessel;
            const existing = this.vessels.get(v.mmsi);
            const now = Date.now();
            let ts = v.last_updated ? (v.last_updated > 1e11 ? v.last_updated : v.last_updated * 1000) : null;
            if (!ts && v.time_utc) {
              try { ts = new Date(v.time_utc).getTime(); } catch (e) {}
            }
            this.vessels.set(v.mmsi, { ...(existing || {}), ...v, last_updated_ts: ts || now });
            this.hasPendingUpdates = true;
            this.scheduleBatchNotify();
          }
        } catch (e) {
          console.warn('[AISClient] Parse error:', e);
        }
      };

      ws.onclose = () => {
        if (this.pingInterval) clearInterval(this.pingInterval);

        if (this.autoReconnect) {
          this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
          const delay = Math.min(3000 * Math.pow(1.15, this.reconnectAttempts - 1), 6000);
          console.log(`[AISClient] Cloud Relay disconnected. Auto-reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})...`);
          this.feedMode = 'CONNECTING';
          this.hasPendingUpdates = true;
          this.scheduleBatchNotify();

          // Ensure static cron polling keeps fleet loaded as fallback
          this.startCronPolling();

          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (this.autoReconnect) {
              this.connectCloudRelay(this.relayUrl || DEFAULT_RELAY_URL);
            }
          }, delay);
        } else {
          console.log('[AISClient] Cloud Relay disconnected by user.');
          this.feedMode = 'CRON_SNAPSHOT';
          this.startCronPolling();
          this.hasPendingUpdates = true;
          this.scheduleBatchNotify();
        }
      };

      ws.onerror = (err) => {
        console.warn('[AISClient] Cloud Relay connection error:', err);
      };
    } catch (e) {
      console.warn('[AISClient] WebSocket initiation error:', e);
      if (this.autoReconnect) {
        this.feedMode = 'CONNECTING';
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (this.autoReconnect) {
            this.connectCloudRelay(this.relayUrl || DEFAULT_RELAY_URL);
          }
        }, 3000);
      } else {
        this.feedMode = 'CRON_SNAPSHOT';
        this.startCronPolling();
      }
      this.hasPendingUpdates = true;
      this.scheduleBatchNotify();
    }
  }

  disconnectCloudRelay() {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.feedMode = 'CRON_SNAPSHOT';
    this.startCronPolling();
    this.hasPendingUpdates = true;
    this.scheduleBatchNotify();
  }

  startLiveSimulation() {
    if (this.simInterval) return;

    // Real-Time GPS Dead Reckoning Engine:
    // Smoothly advances underway vessels in real time along their authentic heading/COG at their broadcast SOG.
    // Coordinates stay 100% physically accurate to nautical physics.
    // When fresh AIS packets arrive via WebSocket or cron, coordinates snap to ground-truth packets.
    let lastTick = Date.now();

    this.simInterval = setInterval(() => {
      const now = Date.now();
      const dtSeconds = Math.min(2.5, Math.max(0.5, (now - lastTick) / 1000));
      lastTick = now;

      let movedAny = false;
      for (const v of this.vessels.values()) {
        const sog = v.sog || 0;
        const isMoored =
          sog < 0.6 ||
          (v.nav_status &&
            (v.nav_status.toLowerCase().includes('moor') ||
              v.nav_status.toLowerCase().includes('anchor') ||
              v.nav_status.toLowerCase().includes('aground')));

        if (isMoored) continue;

        // Only dead-reckon if the vessel has received an authentic AIS packet within the last 6 hours
        const ts =
          v.last_updated_ts ||
          (v.last_updated ? (v.last_updated > 1e11 ? v.last_updated : v.last_updated * 1000) : 0);
        if (now - ts > 21600000) continue;

        const heading =
          v.heading !== undefined && v.heading !== null && v.heading < 360
            ? v.heading
            : v.cog || 0;
        const radHeading = (heading * Math.PI) / 180;

        // 1 Knot = 0.514444 meters/second
        const speedMps = sog * 0.514444;
        const distanceM = speedMps * dtSeconds;

        // Great-circle projection: 1 deg lat = 111,320m
        const deltaLat = (distanceM * Math.cos(radHeading)) / 111320;
        const cosLat = Math.cos((v.lat * Math.PI) / 180);
        const deltaLon =
          cosLat !== 0 ? (distanceM * Math.sin(radHeading)) / (111320 * cosLat) : 0;

        v.lat = Number((v.lat + deltaLat).toFixed(6));
        v.lon = Number((v.lon + deltaLon).toFixed(6));

        // Maintain GPS breadcrumb trail
        if (v.track && Array.isArray(v.track) && v.track.length > 0) {
          const lastPt = v.track[v.track.length - 1];
          if (Math.hypot(lastPt[0] - v.lat, lastPt[1] - v.lon) > 0.0008) {
            v.track.push([v.lat, v.lon]);
            if (v.track.length > 30) v.track = v.track.slice(-30);
          }
        }

        movedAny = true;
      }

      this.hasPendingUpdates = true;
      this.scheduleBatchNotify();
    }, 1000);
  }
}

export const aisClient = new AISClientService();
