import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CHOKEPOINTS } from '../../data/mockVessels';

const MAP_STYLES = {
  nautical: {
    name: 'OpenStreetMap (Live US & Globe)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  satellite: {
    name: 'Satellite World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; USGS, NOAA'
  },
  ocean: {
    name: 'Nautical World Ocean',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; GEBCO, NOAA'
  },
  topo: {
    name: 'World Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; National Geographic'
  }
};

const SHIP_COLORS = {
  cargo: '#eab308',      // Amber Yellow (Cargo)
  tanker: '#f97316',     // Orange (Tanker)
  pleasure: '#d946ef',   // Magenta / Pink (Pleasure Craft / Yachts)
  tug: '#0284c7',        // Blue / Cyan (Tug / Special craft)
  fishing: '#16a34a',    // Green (Fishing)
  passenger: '#3b82f6',  // Deep Blue (Passenger)
  other: '#94a3b8'       // Slate Gray (Other / High speed)
};

function getShipColor(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('cargo') || t.includes('carrier') || t.includes('container') || t.includes('freighter')) return SHIP_COLORS.cargo;
  if (t.includes('tanker') || t.includes('crude') || t.includes('oil') || t.includes('chemical')) return SHIP_COLORS.tanker;
  if (t.includes('pleasure') || t.includes('yacht') || t.includes('sailing')) return SHIP_COLORS.pleasure;
  if (t.includes('tug') || t.includes('tow') || t.includes('pilot') || t.includes('dredger') || t.includes('special')) return SHIP_COLORS.tug;
  if (t.includes('fish') || t.includes('trawler')) return SHIP_COLORS.fishing;
  if (t.includes('passenger') || t.includes('ferry') || t.includes('cruise')) return SHIP_COLORS.passenger;
  return SHIP_COLORS.other;
}

function getPingAge(v) {
  if (!v) return { label: 'LIVE', isRecent: true };
  const now = Date.now();
  let ts = v.last_updated_ts;
  if (!ts && v.last_updated) {
    ts = v.last_updated > 1e11 ? v.last_updated : v.last_updated * 1000;
  }
  if (!ts && v.time_utc) {
    try { ts = new Date(v.time_utc).getTime(); } catch (e) {}
  }
  if (!ts) return { label: 'LIVE AIS', isRecent: true };
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) return { label: `${diffSec}s ago`, isRecent: true };
  if (diffSec < 3600) return { label: `${Math.floor(diffSec / 60)}m ago`, isRecent: diffSec < 900 };
  if (diffSec < 86400) return { label: `${Math.floor(diffSec / 3600)}h ago`, isRecent: false };
  return { label: `${Math.floor(diffSec / 86400)}d ago`, isRecent: false };
}

function formatLocationPingMessage(v) {
  if (!v) return { title: 'Location: Just now', subtitle: 'Live AIS transponder ping', dot: '🟢', isRecent: true };
  const now = Date.now();
  let ts = v.last_updated_ts;
  if (!ts && v.last_updated) {
    ts = v.last_updated > 1e11 ? v.last_updated : v.last_updated * 1000;
  }
  if (!ts && v.time_utc) {
    try { ts = new Date(v.time_utc).getTime(); } catch (e) {}
  }
  if (!ts) return { title: 'Location: Just now', subtitle: 'Live GPS transponder', dot: '🟢', isRecent: true };

  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  const sog = v.sog || 0;
  const status = v.nav_status || (sog >= 0.5 ? `${sog} KN` : 'Moored');

  if (diffSec < 45) {
    return {
      title: `Location: Just now (${diffSec}s ago)`,
      subtitle: `${status} · Real-time GPS`,
      dot: '🟢',
      isRecent: true
    };
  }
  if (diffSec < 90) {
    return {
      title: `Location: 1 minute ago`,
      subtitle: `${status} · Live AIS transponder`,
      dot: '🟢',
      isRecent: true
    };
  }
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return {
      title: `Location: ${mins} minute${mins === 1 ? '' : 's'} ago`,
      subtitle: `${status} · Real AIS ping`,
      dot: mins <= 15 ? '🟢' : '🟡',
      isRecent: mins <= 15
    };
  }
  if (diffSec < 7200) {
    return {
      title: `Location: 1 hour ago`,
      subtitle: `${status} · Stored AIS ping`,
      dot: '⚪',
      isRecent: false
    };
  }
  if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    return {
      title: `Location: ${hrs} hours ago`,
      subtitle: `${status} · Transponder fix`,
      dot: '⚪',
      isRecent: false
    };
  }
  const days = Math.floor(diffSec / 86400);
  return {
    title: `Location: ${days} day${days === 1 ? '' : 's'} ago`,
    subtitle: `${status} · Historical fix`,
    dot: '⚪',
    isRecent: false
  };
}

export default function GlobalMapView({
  vessels = [],
  selectedVessel,
  onSelectVessel,
  onSwitchToTopographical,
  onOpenDrawer,
  layers = { tracks: true, anchorage: true },
  alerts = []
}) {
  const mapContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Keep references to prevent stale closures in event listeners
  const vesselsRef = useRef(vessels);
  const selectedVesselRef = useRef(selectedVessel);
  const onSelectVesselRef = useRef(onSelectVessel);
  const alertsRef = useRef(alerts);

  useEffect(() => { vesselsRef.current = vessels; }, [vessels]);
  useEffect(() => { selectedVesselRef.current = selectedVessel; }, [selectedVessel]);
  useEffect(() => { onSelectVesselRef.current = onSelectVessel; }, [onSelectVessel]);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);

  const [mapStyleKey, setMapStyleKey] = useState('nautical');
  const [hoveredVessel, setHoveredVessel] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [filterType, setFilterType] = useState('ALL');

  // Render Canvas Vessels Overlay
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const map = mapInstanceRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    const bounds = map.getBounds();
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const zoom = map.getZoom();
    const scaleFactor = Math.max(0.65, Math.min(1.5, zoom / 5));
    const currentVessels = vesselsRef.current || [];
    const currentSelected = selectedVesselRef.current;

    // Draw Vessels
    currentVessels.forEach(v => {
      // Filter if applied
      if (filterType !== 'ALL') {
        const c = getShipColor(v.type);
        if (filterType === 'CARGO' && c !== SHIP_COLORS.cargo) return;
        if (filterType === 'TANKER' && c !== SHIP_COLORS.tanker) return;
        if (filterType === 'PLEASURE' && c !== SHIP_COLORS.pleasure) return;
        if (filterType === 'TUG' && c !== SHIP_COLORS.tug) return;
        if (filterType === 'FISHING' && c !== SHIP_COLORS.fishing) return;
      }

      // Check bounds before projection
      if (!bounds.contains([v.lat, v.lon])) return;

      const point = map.latLngToContainerPoint([v.lat, v.lon]);
      if (point.x < -30 || point.x > width + 30 || point.y < -30 || point.y > height + 30) return;

      const isSelected = currentSelected && currentSelected.mmsi === v.mmsi;
      const color = getShipColor(v.type);
      const isMoored = !v.sog || v.sog < 0.6;
      const heading = (v.heading || v.cog || 0);

      if (isMoored) {
        // Moored / At Anchor Circle
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4.2 * scaleFactor, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      } else {
        // Moving Directional Chevron
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate((heading * Math.PI) / 180);

        const w = 5.8 * scaleFactor;
        const len = 9.5 * scaleFactor;

        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.lineTo(w, len * 0.75);
        ctx.lineTo(0, len * 0.35);
        ctx.lineTo(-w, len * 0.75);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        ctx.restore();
      }

      // If Selected: Draw Tactical Targeting Brackets & Label
      if (isSelected) {
        const boxSize = 14 * scaleFactor;

        // Red/Orange Corner Reticle Brackets [ ]
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.0;

        // Top-Left Corner
        ctx.beginPath();
        ctx.moveTo(point.x - boxSize, point.y - boxSize + 6);
        ctx.lineTo(point.x - boxSize, point.y - boxSize);
        ctx.lineTo(point.x - boxSize + 6, point.y - boxSize);
        ctx.stroke();

        // Top-Right Corner
        ctx.beginPath();
        ctx.moveTo(point.x + boxSize - 6, point.y - boxSize);
        ctx.lineTo(point.x + boxSize, point.y - boxSize);
        ctx.lineTo(point.x + boxSize, point.y - boxSize + 6);
        ctx.stroke();

        // Bottom-Left Corner
        ctx.beginPath();
        ctx.moveTo(point.x - boxSize, point.y + boxSize - 6);
        ctx.lineTo(point.x - boxSize, point.y + boxSize);
        ctx.lineTo(point.x - boxSize + 6, point.y + boxSize);
        ctx.stroke();

        // Bottom-Right Corner
        ctx.beginPath();
        ctx.moveTo(point.x + boxSize - 6, point.y + boxSize);
        ctx.lineTo(point.x + boxSize, point.y + boxSize);
        ctx.lineTo(point.x + boxSize, point.y + boxSize - 6);
        ctx.stroke();

        // Check if this vessel has an active maritime alert
        const activeAlert = (alertsRef.current || []).find(
          (a) => a.mmsi === v.mmsi || (a.mmsi && String(a.mmsi) === String(v.mmsi)) || a.vessel === v.name
        );

        // Speech Bubble Callout directly ABOVE the vessel marker
        const pingMsg = formatLocationPingMessage(v);
        const nameText = v.name || 'VESSEL';
        let line1 = `${pingMsg.dot} ${pingMsg.title}`;
        let line2 = `${nameText} · ${pingMsg.subtitle}`;
        let borderColor = pingMsg.isRecent ? '#10b981' : '#f59e0b';
        let line1Color = pingMsg.isRecent ? '#34d399' : '#fbbf24';

        if (activeAlert) {
          line1 = `🚨 ${activeAlert.level} · ${activeAlert.title}`;
          line2 = `${nameText} · ${activeAlert.details}`;
          borderColor = activeAlert.level === 'CRIT' ? '#ef4444' : '#f59e0b';
          line1Color = activeAlert.level === 'CRIT' ? '#f87171' : '#fbbf24';
        }

        ctx.font = 'bold 11px JetBrains Mono, monospace';
        const w1 = ctx.measureText(line1).width;
        ctx.font = '10px JetBrains Mono, monospace';
        const w2 = ctx.measureText(line2).width;

        const padX = 12;
        const boxW = Math.max(w1, w2) + padX * 2;
        const boxH = 40;
        const arrowH = 8;

        // Horizontally center directly above the vessel point.x
        let boxX = Math.round(point.x - boxW / 2);
        boxX = Math.max(8, Math.min(width - boxW - 8, boxX));

        // Place directly ABOVE the reticle and ship marker
        let boxY = Math.round(point.y - boxSize - boxH - arrowH - 4);
        let arrowPointsDown = true;

        // If too close to top edge of viewport, flip below
        if (boxY < 12) {
          boxY = Math.round(point.y + boxSize + arrowH + 4);
          arrowPointsDown = false;
        }

        // Draw Callout Box with soft shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;

        ctx.fillStyle = '#0f172a'; // Deep Navy Slate
        ctx.beginPath();
        const r = 6;
        ctx.moveTo(boxX + r, boxY);
        ctx.lineTo(boxX + boxW - r, boxY);
        ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
        ctx.lineTo(boxX + boxW, boxY + boxH - r);
        ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
        ctx.lineTo(boxX + r, boxY + boxH);
        ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
        ctx.lineTo(boxX, boxY + r);
        ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
        ctx.closePath();
        ctx.fill();

        // Speech bubble triangular pointer pointing directly at the ship marker
        ctx.beginPath();
        if (arrowPointsDown) {
          ctx.moveTo(point.x - 7, boxY + boxH);
          ctx.lineTo(point.x, boxY + boxH + arrowH);
          ctx.lineTo(point.x + 7, boxY + boxH);
        } else {
          ctx.moveTo(point.x - 7, boxY);
          ctx.lineTo(point.x, boxY - arrowH);
          ctx.lineTo(point.x + 7, boxY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Border around callout
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = activeAlert ? 2.0 : 1.5;
        ctx.stroke();

        // Text Line 1:
        ctx.fillStyle = line1Color;
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(line1, boxX + padX, boxY + 16);

        // Text Line 2:
        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(line2, boxX + padX, boxY + 31);
      }
    });
  }, [filterType]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Full interactive map with dragging, wheel zoom, double-click zoom enabled
    const map = L.map(mapContainerRef.current, {
      center: [38.0, -78.0],
      zoom: 4,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      boxZoom: true,
      keyboard: true
    });

    mapInstanceRef.current = map;

    // Base Tile Layer
    const tileUrl = MAP_STYLES[mapStyleKey].url;
    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Zoom controls at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Canvas resize & render handler
    const updateCanvasSize = () => {
      const container = mapContainerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      renderCanvas();
    };

    updateCanvasSize();

    map.on('move', renderCanvas);
    map.on('zoom', renderCanvas);
    map.on('resize', updateCanvasSize);

    // Mouse Move & Hover detection directly on the Map (Native Leaflet events)
    map.on('mousemove', (e) => {
      const mouseX = e.containerPoint.x;
      const mouseY = e.containerPoint.y;
      let closest = null;
      let minDist = 16;
      const list = vesselsRef.current || [];

      for (const v of list) {
        const pt = map.latLngToContainerPoint([v.lat, v.lon]);
        const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
        if (dist < minDist) {
          minDist = dist;
          closest = v;
        }
      }

      if (closest) {
        setHoveredVessel(closest);
        setTooltipPos({ x: mouseX, y: mouseY });
        map.getContainer().style.cursor = 'pointer';
      } else {
        setHoveredVessel(null);
        map.getContainer().style.cursor = '';
      }
    });

    // Click or Tap on Map to Select Vessel (Optimized for Mobile Fingers & Desktop Clicks)
    map.on('click', (e) => {
      const mouseX = e.containerPoint.x;
      const mouseY = e.containerPoint.y;
      let clicked = null;
      const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
      let minDist = isMobile ? 36 : 22;
      const list = vesselsRef.current || [];

      for (const v of list) {
        const pt = map.latLngToContainerPoint([v.lat, v.lon]);
        const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
        if (dist < minDist) {
          minDist = dist;
          clicked = v;
        }
      }

      if (clicked && onSelectVesselRef.current) {
        onSelectVesselRef.current(clicked);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update canvas whenever vessels or selectedVessel changes
  useEffect(() => {
    renderCanvas();
  }, [vessels, selectedVessel, renderCanvas]);

  // Handle Tile Style changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(MAP_STYLES[mapStyleKey].url, {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(mapInstanceRef.current);
  }, [mapStyleKey]);

  // Center and zoom to selected vessel smoothly
  useEffect(() => {
    if (selectedVessel && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const currentZoom = map.getZoom();
      const targetZoom = Math.max(currentZoom, 11);
      map.flyTo([selectedVessel.lat, selectedVessel.lon], targetZoom, {
        duration: 1.0,
        easeLinearity: 0.25
      });
    }
  }, [selectedVessel?.mmsi, selectedVessel?._focusTs]);

  // Jump to Pre-defined Strategic Maritime Corridors
  const handleJumpToSector = (sector) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([sector.lat, sector.lon], sector.zoom || 7, { duration: 1.2 });
    const match = vessels.find(v => v.strait?.toLowerCase().includes(sector.name.toLowerCase()) || v.name.includes("SAM LAUD") || v.name.includes("ORION"));
    if (match && onSelectVessel) {
      onSelectVessel(match);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#bdd7ee]">
      {/* Leaflet Map Div (Native Dragging, Panning, and Wheel Zooming) */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* HTML5 Canvas Overlay (pointer-events-none so all drag/zoom gestures go to Leaflet!) */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
      />

      {/* Top Left: Map Style Selector & Strategic Chokepoint Pills */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
        {/* Style Selector Tabs */}
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-md border border-tactical-border shadow-md">
          {Object.entries(MAP_STYLES).map(([key, item]) => (
            <button
              key={key}
              onClick={() => setMapStyleKey(key)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-all ${
                mapStyleKey === key
                  ? 'bg-tactical-orange text-white shadow-sm'
                  : 'text-tactical-muted hover:text-tactical-text hover:bg-gray-100'
              }`}
            >
              {key === 'nautical' ? 'LIVE MAP (OSM)' : key === 'satellite' ? 'SATELLITE (ESRI)' : key === 'ocean' ? 'OCEAN BASE' : 'TOPOGRAPHIC'}
            </button>
          ))}
        </div>

        {/* Strategic Region Pills (Desktop) */}
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap max-w-xl">
          {CHOKEPOINTS.slice(0, 5).map(cp => (
            <button
              key={cp.id}
              onClick={() => handleJumpToSector(cp)}
              className="bg-white/90 hover:bg-[#ff4d15] hover:text-white text-tactical-text border border-tactical-border px-2 py-0.5 rounded text-[10px] font-mono font-medium shadow-sm transition-colors"
            >
              {cp.name.split('/')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Top Right: Ship Type Legend & Filter Bar (Desktop) */}
      <div className="hidden md:flex absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-md p-2 rounded-md border border-tactical-border shadow-md items-center gap-3 text-[10px] font-mono">
        <span className="text-tactical-dim font-bold uppercase">FLEET:</span>
        <button
          onClick={() => setFilterType(filterType === 'CARGO' ? 'ALL' : 'CARGO')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${filterType === 'CARGO' ? 'bg-amber-100 ring-1 ring-amber-400 font-bold' : ''}`}
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-[#eab308]" />
          <span>Cargo</span>
        </button>
        <button
          onClick={() => setFilterType(filterType === 'TANKER' ? 'ALL' : 'TANKER')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${filterType === 'TANKER' ? 'bg-orange-100 ring-1 ring-orange-400 font-bold' : ''}`}
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f97316]" />
          <span>Tanker</span>
        </button>
        <button
          onClick={() => setFilterType(filterType === 'PLEASURE' ? 'ALL' : 'PLEASURE')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${filterType === 'PLEASURE' ? 'bg-pink-100 ring-1 ring-pink-400 font-bold' : ''}`}
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-[#d946ef]" />
          <span>Pleasure/Yacht</span>
        </button>
        <button
          onClick={() => setFilterType(filterType === 'TUG' ? 'ALL' : 'TUG')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${filterType === 'TUG' ? 'bg-sky-100 ring-1 ring-sky-400 font-bold' : ''}`}
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-[#0284c7]" />
          <span>Tug/Special</span>
        </button>
        <button
          onClick={() => setFilterType(filterType === 'FISHING' ? 'ALL' : 'FISHING')}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${filterType === 'FISHING' ? 'bg-emerald-100 ring-1 ring-emerald-400 font-bold' : ''}`}
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-[#16a34a]" />
          <span>Fishing</span>
        </button>
      </div>

      {/* Hover Tooltip */}
      {hoveredVessel && (
        <div
          className="absolute z-30 pointer-events-none bg-[#111620]/95 backdrop-blur-md border border-tactical-orange text-white p-2.5 rounded shadow-xl flex flex-col gap-1 min-w-[210px]"
          style={{
            left: `${tooltipPos.x + 15}px`,
            top: `${tooltipPos.y - 45}px`
          }}
        >
          <div className="flex items-center justify-between border-b border-[#2d3748] pb-1">
            <span className="font-bold text-xs text-white">{hoveredVessel.name}</span>
            <span
              className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase"
              style={{ color: getShipColor(hoveredVessel.type) }}
            >
              {hoveredVessel.type}
            </span>
          </div>
          <div className="grid grid-cols-2 text-[10px] gap-x-2 gap-y-0.5 text-gray-300 font-mono">
            <div>SOG: <span className="text-white font-semibold">{hoveredVessel.sog || 0} KN</span></div>
            <div>HDG: <span className="text-white font-semibold">{hoveredVessel.heading || hoveredVessel.cog || 0}°T</span></div>
            <div>FLAG: <span className="text-white">{hoveredVessel.flag || 'USA'}</span></div>
            <div>STATUS: <span className={(hoveredVessel.sog || 0) >= 0.5 ? 'text-emerald-400' : 'text-amber-400'}>{hoveredVessel.nav_status || ((hoveredVessel.sog || 0) >= 0.5 ? 'Underway' : 'Moored')}</span></div>
            <div className="col-span-2 text-[9px] pt-0.5 border-t border-[#2d3748]/60 flex items-center justify-between">
              <span className="text-gray-400">LAST PING:</span>
              <span className={getPingAge(hoveredVessel).isRecent ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {getPingAge(hoveredVessel).isRecent ? '🟢' : '🟡'} {getPingAge(hoveredVessel).label}
              </span>
            </div>
            <div className="col-span-2 text-[9px] text-gray-400 truncate">
              POS: {hoveredVessel.lat?.toFixed(5)}°, {hoveredVessel.lon?.toFixed(5)}°
            </div>
          </div>
          <div className="mt-1 pt-1 border-t border-[#2d3748] text-[9px] text-tactical-orange font-semibold flex items-center justify-between">
            <span>CLICK TO LOCK // 3D TOPO</span>
            <span>▶</span>
          </div>
        </div>
      )}

      {/* Bottom Target Card (When Vessel Selected) */}
      {selectedVessel && (
        <div className="absolute bottom-2 sm:bottom-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-20 bg-white/95 backdrop-blur-md border border-tactical-orange text-tactical-text p-2.5 sm:px-5 sm:py-2.5 rounded-lg shadow-xl flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-5 max-w-[calc(100vw-1rem)]">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center font-bold text-xs shrink-0"
              style={{ backgroundColor: `${getShipColor(selectedVessel.type)}20`, color: getShipColor(selectedVessel.type) }}
            >
              ▲
            </div>
            <div className="flex flex-col truncate">
              <div className="flex items-center gap-2">
                <span className="text-[8px] sm:text-[9px] text-tactical-dim font-bold uppercase tracking-wider">TARGET ACQUIRED</span>
                <span className="text-[9px] text-emerald-700 font-semibold font-mono">
                  {getPingAge(selectedVessel).isRecent ? '🟢' : '🟡'} {getPingAge(selectedVessel).label}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-bold text-tactical-text truncate">{selectedVessel.name}</span>
              <span className="text-[9px] sm:text-[10px] text-tactical-muted truncate">
                {selectedVessel.type} · {selectedVessel.sog || 0} KN · HDG {selectedVessel.heading || selectedVessel.cog || 0}°T · {selectedVessel.lat?.toFixed(4)}°, {selectedVessel.lon?.toFixed(4)}°
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {onOpenDrawer && (
              <button
                onClick={onOpenDrawer}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-tactical-text border border-tactical-border px-3 py-1.5 sm:py-2 rounded font-semibold text-[11px] sm:text-xs font-mono uppercase transition-all active:scale-95 shrink-0"
              >
                <span>DETAILS</span>
                <span>📋</span>
              </button>
            )}

            <button
              onClick={onSwitchToTopographical}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-tactical-orange hover:bg-[#e03d07] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded font-semibold text-[11px] sm:text-xs font-mono tracking-wider uppercase transition-all shadow-md active:scale-95 shrink-0"
            >
              <span>3D VIEW</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
