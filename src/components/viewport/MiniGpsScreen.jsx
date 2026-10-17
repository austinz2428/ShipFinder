import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Maximize2, Minimize2, MapPin, Compass, Layers } from 'lucide-react';

export default function MiniGpsScreen({
  vessel,
  onExpandToFullMap
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const trackLineRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [tileMode, setTileMode] = useState('osm'); // 'osm' | 'satellite'

  const lat = vessel?.lat ?? 44.62;
  const lon = vessel?.lon ?? -86.85;
  const heading = vessel?.heading ?? vessel?.cog ?? 0;
  const name = vessel?.name || 'VESSEL';
  const sog = vessel?.sog ?? 0;

  // Initialize Mini Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lon],
      zoom: 8,
      minZoom: 3,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    mapInstanceRef.current = map;

    // Tile Layer
    const tileUrl = tileMode === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tileLayer = L.tileLayer(tileUrl, { maxZoom: 18 }).addTo(map);

    // Zoom controls top-left
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Custom Tactical Boat Marker HTML
    const createMarkerIcon = (hdg) => {
      return L.divIcon({
        className: 'custom-mini-gps-marker',
        html: `
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 28px; height: 28px; border: 1.5px dashed #ff4d15; border-radius: 50%; opacity: 0.75;"></div>
            <div style="transform: rotate(${hdg}deg); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 16px solid #ff4d15; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
    };

    const marker = L.marker([lat, lon], { icon: createMarkerIcon(heading) }).addTo(map);
    markerRef.current = marker;

    // Track breadcrumbs
    if (vessel?.track && vessel.track.length > 1) {
      const line = L.polyline(vessel.track, {
        color: '#ff4d15',
        weight: 2.5,
        opacity: 0.8,
        dashArray: '3, 4'
      }).addTo(map);
      trackLineRef.current = line;
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when tileMode toggled
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const tileUrl = tileMode === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    L.tileLayer(tileUrl, { maxZoom: 18 }).addTo(mapInstanceRef.current);
  }, [tileMode]);

  // Invalidate size when un-minimized
  useEffect(() => {
    if (!isMinimized && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isMinimized]);

  // Update marker position & heading smoothly
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;

    markerRef.current.setLatLng([lat, lon]);

    // Update marker icon rotation
    const icon = L.divIcon({
      className: 'custom-mini-gps-marker',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 28px; height: 28px; border: 1.5px dashed #ff4d15; border-radius: 50%; opacity: 0.75;"></div>
          <div style="transform: rotate(${heading}deg); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 16px solid #ff4d15; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    markerRef.current.setIcon(icon);

    // Pan map to follow vessel if it moves
    mapInstanceRef.current.panTo([lat, lon], { animate: true, duration: 0.6 });

    // Update track
    if (vessel?.track && vessel.track.length > 1) {
      if (trackLineRef.current) {
        trackLineRef.current.setLatLngs(vessel.track);
      } else {
        trackLineRef.current = L.polyline(vessel.track, {
          color: '#ff4d15',
          weight: 2.5,
          opacity: 0.8,
          dashArray: '3, 4'
        }).addTo(mapInstanceRef.current);
      }
    }
  }, [lat, lon, heading, vessel?.track]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lon], 8, { animate: true });
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="absolute top-16 right-6 z-30 bg-white/95 backdrop-blur-md border border-tactical-border px-3 py-1.5 rounded shadow-lg flex items-center gap-2 font-mono text-xs text-tactical-text hover:bg-tactical-orange hover:text-white transition-all"
        title="Open Live GPS Screen"
      >
        <MapPin className="w-3.5 h-3.5 text-tactical-orange" />
        <span className="font-bold">LIVE GPS MAP</span>
      </button>
    );
  }

  return (
    <div className="absolute top-14 sm:top-16 right-2 sm:right-6 z-30 w-56 sm:w-80 max-w-[calc(100vw-1rem)] bg-white/95 backdrop-blur-md border border-tactical-border rounded-lg shadow-2xl overflow-hidden flex flex-col font-mono text-xs select-none">
      {/* Header Bar */}
      <div className="p-2 border-b border-tactical-border flex items-center justify-between bg-gray-50/80">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="font-bold text-[10px] text-tactical-text uppercase truncate">
            LIVE GPS // {name}
          </span>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTileMode(tileMode === 'osm' ? 'satellite' : 'osm')}
            className={`p-1 rounded text-[9px] font-bold border transition-colors ${
              tileMode === 'satellite'
                ? 'bg-tactical-orange text-white border-tactical-orange'
                : 'bg-white text-tactical-muted hover:text-tactical-text border-gray-200'
            }`}
            title="Toggle Satellite Imagery"
          >
            <Layers className="w-3 h-3" />
          </button>

          <button
            onClick={handleRecenter}
            className="p-1 rounded hover:bg-gray-200 text-tactical-muted hover:text-tactical-text border border-transparent hover:border-gray-200"
            title="Re-center on Vessel"
          >
            <Navigation className="w-3 h-3" />
          </button>

          <button
            onClick={onExpandToFullMap}
            className="p-1 rounded hover:bg-gray-200 text-tactical-muted hover:text-tactical-text border border-transparent hover:border-gray-200"
            title="Expand to Full Global Map"
          >
            <Maximize2 className="w-3 h-3" />
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded hover:bg-gray-200 text-tactical-muted hover:text-tactical-text"
            title="Minimize"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Map Viewport */}
      <div className="relative w-full h-32 sm:h-52 bg-[#bdd7ee]">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Reticle Guideline in center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-8 h-8 border border-tactical-orange/40 rounded-full z-10" />
      </div>

      {/* Telemetry Footer */}
      <div className="p-2 border-t border-tactical-border bg-white flex flex-col gap-1">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-tactical-dim font-bold">REAL GPS COORDS:</span>
          <span className="font-bold text-tactical-text">
            {lat.toFixed(4)}° N, {Math.abs(lon).toFixed(4)}° {lon >= 0 ? 'E' : 'W'}
          </span>
        </div>
        <div className="flex justify-between items-center text-[9px] text-tactical-muted">
          <span>SPEED: <strong className="text-tactical-text">{sog} KN</strong></span>
          <span>HEADING: <strong className="text-tactical-text">{Math.round(heading)}°T</strong></span>
          <span className="text-emerald-600 font-bold">● ACTIVE FIX</span>
        </div>
      </div>
    </div>
  );
}
