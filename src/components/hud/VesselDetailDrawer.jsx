import React, { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import {
  X, Mountain, Navigation, Copy, Check, MapPin, Compass, Ship, Anchor, Clock
} from 'lucide-react';

export default function VesselDetailDrawer({
  vessel,
  onClose,
  onSwitchToTopographical,
  onCenterMap
}) {
  const drawerRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Isolate scroll and click events from underlying map
  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return;

    if (L && L.DomEvent) {
      L.DomEvent.disableScrollPropagation(el);
      L.DomEvent.disableClickPropagation(el);
    }
  }, []);

  if (!vessel) return null;

  // Safe data accessors
  const lat = typeof vessel.lat === 'number' ? vessel.lat : 44.62;
  const lon = typeof vessel.lon === 'number' ? vessel.lon : -86.85;
  const sog = typeof vessel.sog === 'number' ? vessel.sog : 0;
  const heading = typeof vessel.heading === 'number' && vessel.heading !== 511
    ? vessel.heading
    : (typeof vessel.cog === 'number' ? vessel.cog : 0);
  const lengthM = vessel.length || 198;
  const widthM = vessel.width || 24;
  const draftM = vessel.draft || 9.5;
  const lengthFt = Math.round(lengthM * 3.28084);
  const widthFt = Math.round(widthM * 3.28084);
  const draftFt = (draftM * 3.28084).toFixed(1);

  const isMoored = sog < 0.6;
  const statusText = isMoored ? 'MOORED / AT ANCHOR' : 'UNDERWAY USING ENGINE';
  const statusColor = isMoored ? 'text-amber-500' : 'text-emerald-500';
  const statusBg = isMoored ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30';

  const toDMS = (coord, isLat) => {
    if (typeof coord !== 'number' || isNaN(coord)) {
      return isLat ? "00° 00' 00\" N" : "00° 00' 00\" W";
    }
    const dir = isLat ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
    const abs = Math.abs(coord);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60);
    return `${deg}° ${min}' ${sec}" ${dir}`;
  };

  const handleCopyTelemetry = () => {
    const text = `Vessel: ${vessel.name || 'VESSEL'}\nType: ${vessel.type || 'Commercial'}\nMMSI: ${vessel.mmsi}\nIMO: ${vessel.imo || 'N/A'}\nDimensions: ${lengthFt.toLocaleString()} ft × ${widthFt} ft\nDraught: ${draftFt} ft\nPosition: ${lat.toFixed(5)}, ${lon.toFixed(5)}\nSpeed: ${sog} KN\nHeading: ${Math.round(heading)}°T\nDestination: ${vessel.destination || 'N/A'}\nStatus: ${statusText}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={drawerRef}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute inset-y-0 right-0 w-[420px] max-w-[95vw] bg-[#f8f9fa] border-l border-tactical-border shadow-2xl flex flex-col font-mono text-xs z-50 overflow-hidden select-none"
    >
      {/* 1. TOP HEADER (Fixed at top) */}
      <div className="p-3 border-b border-tactical-border flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-tactical-orange animate-ping-slow flex-shrink-0" />
          <span className="text-[11px] font-bold text-tactical-text uppercase tracking-wider truncate">
            VESSEL INFORMATION // {vessel.mmsi}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 text-tactical-muted hover:text-tactical-text transition-colors flex-shrink-0"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. SIMPLE, ESSENTIAL SCROLLABLE CONTENT */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3.5 overscroll-contain"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent'
        }}
      >
        {/* Vessel Name & Flag Card */}
        <div className="bg-white p-3 rounded-lg border border-tactical-border shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-0.5 truncate">
            <h2 className="text-lg font-bold text-tactical-text tracking-wide truncate">
              {vessel.name || 'VESSEL'}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-tactical-muted">
              <span className="font-semibold text-tactical-text">{vessel.type || 'Commercial Vessel'}</span>
              <span>·</span>
              <span>MMSI: {vessel.mmsi}</span>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-tactical-orangeSoft border border-tactical-orangeBorder text-tactical-orange flex-shrink-0">
            {vessel.flag || 'USA'}
          </span>
        </div>

        {/* Live Navigation Telemetry Card */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-3.5 rounded-lg border border-slate-700/80 shadow-md flex flex-col gap-3 font-mono">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isMoored ? 'bg-amber-400' : 'bg-emerald-400'} animate-ping`} />
              <span className={`text-[10px] font-bold tracking-wider ${isMoored ? 'text-amber-400' : 'text-emerald-400'}`}>
                {statusText}
              </span>
            </div>
            <span className="text-[9px] text-slate-400">
              LIVE AIS STREAM
            </span>
          </div>

          {/* Coordinates Grid */}
          <div className="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded border border-white/5">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold tracking-wider">LATITUDE</span>
              <span className="text-sm font-bold text-white tracking-wide">
                {lat.toFixed(5)}° N
              </span>
              <span className="text-[9px] text-slate-500">
                {toDMS(lat, true)}
              </span>
            </div>
            <div className="flex flex-col border-l border-white/10 pl-2.5">
              <span className="text-[9px] text-slate-400 font-bold tracking-wider">LONGITUDE</span>
              <span className="text-sm font-bold text-white tracking-wide">
                {Math.abs(lon).toFixed(5)}° {lon >= 0 ? 'E' : 'W'}
              </span>
              <span className="text-[9px] text-slate-500">
                {toDMS(lon, false)}
              </span>
            </div>
          </div>

          {/* Heading & Speed Readout */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full border border-slate-600 bg-slate-950 flex items-center justify-center">
                <span className="absolute top-0 text-[7px] text-slate-400 font-bold">N</span>
                <div
                  className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[12px] border-b-tactical-orange transition-transform duration-300"
                  style={{ transform: `rotate(${heading}deg)` }}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold">HEADING</span>
                <span className="text-xs font-bold text-slate-100">
                  {String(Math.round(heading)).padStart(3, '0')}° TRUE
                </span>
              </div>
            </div>

            <div className="text-right flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold">SPEED</span>
              <span className="text-sm font-bold text-emerald-400">
                {sog} KN <span className="text-[9px] text-slate-400 font-normal">({(sog * 1.852).toFixed(1)} km/h)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Voyage & Destination (Essential Basics) */}
        <div className="bg-white rounded-lg border border-tactical-border p-3.5 shadow-sm flex flex-col gap-2.5">
          <div className="text-[10px] text-tactical-dim font-bold uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-tactical-orange rounded-sm" />
              VOYAGE & DESTINATION
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-2 text-[11px]">
            <div className="text-tactical-dim">Destination Port</div>
            <div className="font-bold text-tactical-text text-right truncate">
              {vessel.destination || vessel.eta || 'CLEVELAND'}
            </div>

            <div className="text-tactical-dim">Estimated Arrival (ETA)</div>
            <div className="font-semibold text-tactical-text text-right">
              {vessel.eta || '18:00 UTC'}
            </div>

            <div className="text-tactical-dim">Current Draught</div>
            <div className="font-semibold text-tactical-text text-right">
              {draftFt} FT
            </div>

            <div className="text-tactical-dim">Waterway Sector</div>
            <div className="font-semibold text-tactical-text text-right truncate">
              {vessel.strait || 'Great Lakes TSS'}
            </div>
          </div>
        </div>

        {/* Vessel Specifications (Essential Basics) */}
        <div className="bg-white rounded-lg border border-tactical-border p-3.5 shadow-sm flex flex-col gap-2.5">
          <div className="text-[10px] text-tactical-dim font-bold uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-tactical-orange rounded-sm" />
              VESSEL SPECIFICATIONS
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-2 text-[11px]">
            <div className="text-tactical-dim">MMSI</div>
            <div className="font-semibold text-tactical-text text-right">{vessel.mmsi}</div>

            <div className="text-tactical-dim">IMO Number</div>
            <div className="font-semibold text-tactical-text text-right">{vessel.imo || '7390208'}</div>

            <div className="text-tactical-dim">Radio Call Sign</div>
            <div className="font-semibold text-tactical-text text-right">{vessel.call_sign || 'WDB8841'}</div>

            <div className="text-tactical-dim">Ship Dimensions</div>
            <div className="font-semibold text-tactical-text text-right">
              {lengthFt.toLocaleString()} ft × {widthFt} ft
            </div>

            <div className="text-tactical-dim">Length Overall (LOA)</div>
            <div className="font-semibold text-tactical-text text-right">
              {lengthFt.toLocaleString()} ft
            </div>

            <div className="text-tactical-dim">Beam (Width)</div>
            <div className="font-semibold text-tactical-text text-right">
              {widthFt} ft
            </div>

            <div className="text-tactical-dim">Vessel Classification</div>
            <div className="font-semibold text-emerald-700 text-right">Class A SOLAS</div>
          </div>
        </div>
      </div>

      {/* 3. ACTION FOOTER BUTTONS (Fixed at bottom) */}
      <div className="p-3 border-t border-tactical-border bg-white flex flex-col gap-2 shrink-0 z-10 shadow-lg">
        <button
          onClick={onSwitchToTopographical}
          className="w-full flex items-center justify-center gap-2 bg-tactical-orange hover:bg-[#e03d07] text-white py-2 px-3 rounded font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-tactical-orange/20 active:scale-95"
        >
          <Mountain className="w-3.5 h-3.5" />
          <span>ENTER 3D TOPOGRAPHICAL VIEW</span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleCopyTelemetry}
            className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-tactical-text py-1.5 px-2 rounded text-[10px] font-semibold border border-tactical-border transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'COPIED!' : 'COPY INFO'}</span>
          </button>

          {onCenterMap && (
            <button
              onClick={() => onCenterMap(vessel)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-tactical-text py-1.5 px-2 rounded text-[10px] font-semibold border border-tactical-border transition-colors"
            >
              <Navigation className="w-3 h-3" />
              <span>CENTER ON MAP</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
