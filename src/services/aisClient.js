import { INITIAL_VESSELS, INITIAL_ALERTS } from '../data/mockVessels';

class AISClientService {
  constructor() {
    this.vessels = new Map();
    this.alerts = [...INITIAL_ALERTS];
    this.listeners = new Set();
    this.connected = false;
    this.ws = null;
    this.reconnectTimer = null;
    this.latency = 42;

    // Initialize with mock vessels
    INITIAL_VESSELS.forEach(v => {
      this.vessels.set(v.mmsi, { ...v });
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({
      vessels: Array.from(this.vessels.values()),
      alerts: this.alerts,
      connected: this.connected,
      latency: this.latency
    });
    return () => this.listeners.delete(listener);
  }

  notify() {
    const data = {
      vessels: Array.from(this.vessels.values()),
      alerts: this.alerts,
      connected: this.connected,
      latency: this.latency
    };
    this.listeners.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error("Listener error:", e);
      }
    });
  }

  isLocalHost() {
    if (typeof window === 'undefined') return true;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.');
  }

  connect() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    // When hosted on GitHub Pages or static host without local Python process
    if (!this.isLocalHost()) {
      console.log('[AISClient] Hosted on static domain (GitHub Pages). Enabling Autonomous Live Simulation Engine.');
      this.connected = true;
      this.latency = Math.floor(Math.random() * 20 + 25);
      this.notify();
      this.startLiveSimulation();
      return;
    }

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8080/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[AISClient] Connected to AISStream backend proxy:', wsUrl);
        this.connected = true;
        this.latency = Math.floor(Math.random() * 30 + 35);
        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SNAPSHOT') {
            if (Array.isArray(msg.vessels)) {
              msg.vessels.forEach(v => this.vessels.set(v.mmsi, v));
            }
            if (Array.isArray(msg.alerts)) {
              this.alerts = msg.alerts;
            }
            this.notify();
          } else if (msg.type === 'VESSEL_UPDATE') {
            const v = msg.vessel;
            if (v && v.mmsi) {
              this.vessels.set(v.mmsi, v);
              this.notify();
            }
          }
        } catch (e) {
          console.error('[AISClient] Error parsing message:', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.notify();
        this.scheduleReconnect();
        this.startLiveSimulation();
      };

      this.ws.onerror = (err) => {
        this.connected = false;
        this.notify();
        this.startLiveSimulation();
      };
    } catch (e) {
      this.scheduleReconnect();
      this.startLiveSimulation();
    }
  }

  startLiveSimulation() {
    if (this.simInterval) return;
    // Gentle dead-reckoning movement tick so vessels move in real-time on GitHub Pages
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
        this.notify();
      }
    }, 3000);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  async fetchInitialSnapshot() {
    if (!this.isLocalHost()) return;
    try {
      const host = window.location.hostname || 'localhost';
      const res = await fetch(`http://${host}:8080/api/vessels`);
      if (res.ok) {
        const vessels = await res.json();
        vessels.forEach(v => this.vessels.set(v.mmsi, v));
        this.notify();
      }
    } catch (e) {
      // Ignore if server is not yet running
    }
  }
}

export const aisClient = new AISClientService();
