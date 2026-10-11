import React from 'react';

export default function TargetInspector({ vessel }) {
  const v = vessel || {
    name: 'MV ORION IMO',
    imo: 9384722,
    flag: 'MALTA',
    type: 'CRUDE TANKER',
    sog: 9.4,
    heading: 11,
    draft: 14.2,
    cargo: 'CRUDE OIL',
    last_port: 'CONSTANTA',
    eta: 'N-GATE 15:10',
    ais_status: 'GAP 18M',
    score: 74
  };

  return (
    <div className="relative flex-1 bg-[#f4f5f7]/95 border-r border-tactical-border p-3.5 flex flex-col justify-between font-mono text-xs select-none backdrop-blur-sm">
      {/* Corner crosshairs indicator */}
      <div className="absolute top-1.5 left-2 text-[10px] text-tactical-dim font-bold">+</div>
      <div className="absolute bottom-1.5 left-2 text-[10px] text-tactical-dim font-bold">+</div>

      {/* Header */}
      <div className="flex items-center justify-between pl-3 border-b border-tactical-border/60 pb-1.5">
        <span className="text-[11px] font-bold tracking-wider text-tactical-text uppercase">
          TARGET INSPECTOR
        </span>
        <span className="text-[9px] text-tactical-dim">MMSI: {v.mmsi || '938472200'}</span>
      </div>

      {/* Vessel Architectural Deck Plan / Blueprint Schematic (Matching Screenshot) */}
      <div className="w-full my-2 flex items-center justify-center bg-white/70 rounded border border-tactical-border/60 py-2 px-3 shadow-inner">
        <svg className="w-full h-11 overflow-visible" viewBox="0 0 320 40" preserveAspectRatio="xMidYMid meet">
          {/* Hull outline contour */}
          <path
            d="M 15 20 C 15 8, 35 6, 260 6 C 290 6, 310 16, 315 20 C 310 24, 290 34, 260 34 C 35 34, 15 32, 15 20 Z"
            fill="#f8f9fa"
            stroke="#4a5568"
            strokeWidth="1.2"
          />

          {/* Stern Superstructure / Bridge Box (Orange highlight in screenshot) */}
          <rect
            x="22"
            y="9"
            width="32"
            height="22"
            rx="2"
            fill="#fff0eb"
            stroke="#ff4d15"
            strokeWidth="1.5"
          />
          {/* Bridge internal structure */}
          <rect x="28" y="14" width="20" height="12" fill="none" stroke="#ff4d15" strokeWidth="1" strokeDasharray="2,2" />
          <circle cx="38" cy="20" r="2.5" fill="#ff4d15" />

          {/* Deck Cargo Compartments / Tanks Grid */}
          {[64, 94, 124, 154, 184, 214, 244].map((xPos, idx) => {
            const isInspected = idx === 3 || idx === 4; // Orange active inspection zones
            return (
              <g key={idx}>
                <rect
                  x={xPos}
                  y="9"
                  width="24"
                  height="22"
                  rx="1"
                  fill={isInspected ? '#fff0eb' : '#ffffff'}
                  stroke={isInspected ? '#ff4d15' : '#718096'}
                  strokeWidth={isInspected ? '1.5' : '1'}
                />
                <line
                  x1={xPos + 12}
                  y1="9"
                  x2={xPos + 12}
                  y2="31"
                  stroke={isInspected ? '#ff4d15' : '#cbd5e0'}
                  strokeWidth="0.8"
                />
              </g>
            );
          })}

          {/* Bow Thruster and Bulbous marker */}
          <line x1="280" y1="12" x2="280" y2="28" stroke="#a0aec0" strokeWidth="1" strokeDasharray="1,2" />
        </svg>
      </div>

      {/* Two-Column Technical Specifications Grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pl-3 text-[11px] pt-1">
        {/* Left Column */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-tactical-dim">VESSEL</span>
            <span className="font-bold text-tactical-text">{v.name || 'MV ORION IMO'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tactical-dim">IMO</span>
            <span className="font-semibold text-tactical-text">{v.imo || '9384722'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tactical-dim">FLAG</span>
            <span className="font-semibold text-tactical-text">{v.flag || 'MALTA'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tactical-dim">TYPE</span>
            <span className="font-semibold text-tactical-text">{v.type || 'CRUDE TANKER'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tactical-dim">SPEED</span>
            <span className="font-bold text-tactical-text">{v.sog || 9.4} KN</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tactical-dim">HDG</span>
            <span className="font-bold text-tactical-text">{String(Math.round(v.heading || 11)).padStart(3, '0')}°T</span>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-tactical-dim">DRAFT</span>
            <span className="font-semibold text-tactical-text">{v.draft || 14.2} M</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tactical-dim">CARGO</span>
            <span className="font-semibold text-tactical-text">{v.cargo || 'CRUDE OIL'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tactical-dim">LAST PORT</span>
            <span className="font-semibold text-tactical-text">{v.last_port || 'CONSTANTA'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tactical-dim">ETA</span>
            <span className="font-semibold text-tactical-text">{v.eta || 'N-GATE 15:10'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-tactical-dim">AIS</span>
            <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
              String(v.ais_status || '').includes('GAP')
                ? 'bg-tactical-orangeSoft text-tactical-orange border border-tactical-orangeBorder'
                : 'bg-emerald-50 text-emerald-700'
            }`}>
              {v.ais_status || 'LIVE'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-tactical-dim">SCORE</span>
            <span className="font-bold text-tactical-orange">
              {v.score || 74} <span className="text-tactical-dim font-normal">/ 100</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
