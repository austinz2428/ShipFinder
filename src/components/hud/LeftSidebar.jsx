import React from 'react';
import { ChevronRight, Check } from 'lucide-react';

export default function LeftSidebar({
  layers,
  onToggleLayer,
  activeTab = 'VESSELS',
  onSelectTab,
  selectedVessel
}) {
  const tabs = ['QUEUE', 'VESSELS', 'ALERTS', 'REPLAY'];

  return (
    <aside className="w-56 h-full bg-[#f4f5f7]/95 border-r border-tactical-border flex flex-col justify-between font-mono text-xs select-none z-30 shadow-sm backdrop-blur-sm">
      {/* Top Section */}
      <div className="flex flex-col">
        {/* Header Title with Orange accent */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-tactical-border">
          <div className="flex items-center gap-2">
            <span className="font-bold text-tactical-text tracking-wider text-sm">[STRAIT]</span>
          </div>
          <span className="w-3.5 h-3.5 bg-tactical-orange/20 text-tactical-orange rounded flex items-center justify-center font-bold text-[10px]">
            ◀
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="py-2">
          {tabs.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                onClick={() => onSelectTab && onSelectTab(tab)}
                className={`w-full text-left px-4 py-1.5 flex items-center justify-between text-[11px] tracking-wider font-semibold transition-colors ${
                  isActive
                    ? 'text-tactical-orange bg-tactical-orangeSoft border-l-2 border-tactical-orange font-bold'
                    : 'text-tactical-muted hover:text-tactical-text hover:bg-black/5'
                }`}
              >
                <span>{tab}</span>
              </button>
            );
          })}
        </nav>

        {/* Hatched Pattern Divider */}
        <div className="w-full h-3 hatched-pattern border-y border-tactical-border/60 my-1" />

        {/* LAYERS Section */}
        <div className="px-4 py-2 flex flex-col gap-2.5">
          <div className="text-[10px] text-tactical-dim uppercase tracking-wider font-semibold">
            LAYERS
          </div>

          <div className="flex flex-col gap-2">
            {[
              { id: 'tracks', label: 'TRACKS' },
              { id: 'anchorage', label: 'ANCHORAGE' },
              { id: 'aisDark', label: 'AIS-DARK' },
              { id: 'bathymetry', label: 'BATHYMETRY' },
              { id: 'weather', label: 'WEATHER' }
            ].map(({ id, label }) => {
              const isChecked = !!layers[id];
              return (
                <label
                  key={id}
                  onClick={() => onToggleLayer(id)}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border transition-all ${
                      isChecked
                        ? 'bg-tactical-orange border-tactical-orange text-white'
                        : 'border-tactical-borderDark/80 bg-white group-hover:border-tactical-orange'
                    }`}
                  >
                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span
                    className={`text-[11px] tracking-wide transition-colors ${
                      isChecked
                        ? 'text-tactical-text font-semibold'
                        : 'text-tactical-muted group-hover:text-tactical-text'
                    }`}
                  >
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Hatched Pattern Divider */}
        <div className="w-full h-3 hatched-pattern border-y border-tactical-border/60 my-1" />
      </div>

      {/* Bottom Section: TRANSIT Card */}
      <div className="p-3 border-t border-tactical-border flex flex-col gap-2 bg-[#eceef2]">
        {/* Transit Header with Gates & Distance */}
        <div className="flex items-start justify-between text-[9px] text-tactical-muted">
          <span className="font-bold text-[10px] text-tactical-text uppercase">TRANSIT</span>
          <div className="text-right leading-tight">
            <div>N-GATE <span className="text-tactical-text font-semibold">KM 0.0</span></div>
            <div>MID-CH <span className="text-tactical-text font-semibold">KM 14.2</span></div>
            <div>S-GATE <span className="text-tactical-text font-semibold">KM 31.0</span></div>
          </div>
        </div>

        {/* Vessel Badge */}
        <div className="flex items-center gap-2 bg-white p-1.5 rounded border border-tactical-border">
          <div className="w-7 h-7 bg-tactical-orangeSoft border border-tactical-orange text-tactical-orange font-bold text-xs flex items-center justify-center rounded">
            OR
          </div>
          <div className="flex flex-col text-[10px] leading-tight">
            <span className="font-bold text-tactical-text">
              {selectedVessel?.name?.replace('MV ', '') || 'ORION'} - {selectedVessel?.type?.split(' ')[0] || 'TANKER'}
            </span>
            <span className="text-tactical-dim text-[9px]">SOG: {selectedVessel?.sog || 9.4} KN</span>
          </div>
        </div>

        {/* Speed vs Normal Profile Step Graph */}
        <div className="bg-white p-2 rounded border border-tactical-border flex flex-col gap-1">
          {/* Gate Column Markers A, B, C, D, E */}
          <div className="flex justify-between text-[9px] text-tactical-dim font-bold border-b border-gray-100 pb-0.5">
            <span>A</span>
            <span>B</span>
            <span>C</span>
            <span>D</span>
            <span>E</span>
          </div>

          {/* SVG Step Chart */}
          <div className="relative h-16 w-full">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 160 60" preserveAspectRatio="none">
              {/* Vertical sector zones */}
              <rect x="0" y="0" width="32" height="60" fill="rgba(0,0,0,0.02)" />
              <rect x="32" y="0" width="32" height="60" fill="rgba(0,0,0,0.05)" />
              <rect x="64" y="0" width="32" height="60" fill="rgba(0,0,0,0.02)" />
              <rect x="96" y="0" width="32" height="60" fill="rgba(0,0,0,0.05)" />
              <rect x="128" y="0" width="32" height="60" fill="rgba(0,0,0,0.02)" />

              {/* Grid line */}
              <line x1="0" y1="30" x2="160" y2="30" stroke="#e0e3e8" strokeDasharray="2,2" />

              {/* Normal Baseline Step (Dark Gray) */}
              <polyline
                fill="none"
                stroke="#4a5568"
                strokeWidth="1.5"
                points="0,45 15,18 45,18 55,48 115,48 125,42 160,42"
              />

              {/* Live Vessel Actual Speed Profile (Orange Highlight at Choke point) */}
              <polyline
                fill="none"
                stroke="#ff4d15"
                strokeWidth="2"
                points="65,52 110,52"
              />
            </svg>
          </div>

          <div className="flex justify-between items-center text-[8px] text-tactical-dim pt-0.5">
            <span>SPEED vs NORMAL</span>
            <span className="text-tactical-orange font-bold">● LIVE</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
