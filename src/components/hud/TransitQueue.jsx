import React from 'react';

export default function TransitQueue() {
  return (
    <div className="relative flex-1 bg-[#f4f5f7]/95 border-r border-tactical-border p-3.5 flex flex-col justify-between font-mono text-xs select-none backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-tactical-border/60 pb-1.5">
        <span className="text-[11px] font-bold tracking-wider text-tactical-text uppercase">
          TRANSIT QUEUE
        </span>
        <span className="text-[9px] text-tactical-dim">CHOKEPOINT FLOW: BOSPHORUS</span>
      </div>

      {/* KPI Stats Row (14 VSL WAIT, 6 HRS DWELL, 3 HRS CLEAR, +2 HRS DELTA) */}
      <div className="grid grid-cols-4 gap-2 py-1.5 text-center">
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-bold text-tactical-text leading-none">14</span>
            <span className="text-[9px] text-tactical-dim uppercase">VSL</span>
          </div>
          <span className="text-[9px] text-tactical-dim uppercase font-semibold mt-0.5">WAIT</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-bold text-tactical-text leading-none">6</span>
            <span className="text-[9px] text-tactical-dim uppercase">HRS</span>
          </div>
          <span className="text-[9px] text-tactical-dim uppercase font-semibold mt-0.5">DWELL</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-bold text-tactical-text leading-none">3</span>
            <span className="text-[9px] text-tactical-dim uppercase">HRS</span>
          </div>
          <span className="text-[9px] text-tactical-dim uppercase font-semibold mt-0.5">CLEAR</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-bold text-tactical-orange leading-none">+2</span>
            <span className="text-[9px] text-tactical-dim uppercase">HRS</span>
          </div>
          <span className="text-[9px] text-tactical-dim uppercase font-semibold mt-0.5">DELTA</span>
        </div>
      </div>

      {/* Strait Transit Conveyor Pipeline Graphic (Matching Screenshot) */}
      <div className="bg-white/70 p-2 rounded border border-tactical-border/60 flex flex-col gap-1">
        <div className="flex justify-between items-center text-[8px] text-tactical-dim">
          <span>14 VSL IN QUEUE</span>
          <span className="text-tactical-orange font-bold">S-GATE / ACTIVE PASS</span>
        </div>

        {/* Pipeline Conveyor Bar with Ship Icons */}
        <div className="relative h-7 flex items-center justify-between border-b border-tactical-border/50 pb-1">
          {/* Track line */}
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-tactical-border -translate-y-1/2 z-0" />

          {/* Ship icons */}
          <div className="relative z-10 w-full flex items-center justify-between px-1">
            {[...Array(12)].map((_, i) => {
              const isPassing = i >= 8; // Highlighted passing through gate
              return (
                <div
                  key={i}
                  className={`w-3.5 h-2.5 rounded-sm flex items-center justify-center text-[7px] border transition-all ${
                    isPassing
                      ? 'bg-tactical-orangeSoft border-tactical-orange text-tactical-orange font-bold'
                      : 'bg-white border-tactical-borderDark text-tactical-dim'
                  }`}
                >
                  ▶
                </div>
              );
            })}
          </div>

          {/* S-Gate Bracket overlay */}
          <div className="absolute right-0 top-0 h-full w-14 border border-tactical-orange border-dashed rounded bg-tactical-orange/5 pointer-events-none" />
        </div>
      </div>

      {/* Timeline Throughput Area Chart */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between items-center text-[8px] text-tactical-dim">
          <span>HISTORICAL QUEUE DENSITY</span>
          <span className="text-tactical-orange font-bold">| NORMAL 8</span>
        </div>

        <div className="relative h-10 w-full">
          <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
            {/* Threshold reference line */}
            <line x1="0" y1="20" x2="200" y2="20" stroke="#cbd5e0" strokeDasharray="3,3" />

            {/* Area fill */}
            <polygon
              fill="rgba(180, 185, 195, 0.25)"
              points="0,40 0,32 30,30 60,35 90,26 120,28 150,22 175,12 185,10 195,14 200,16 200,40"
            />
            {/* Outline path */}
            <polyline
              fill="none"
              stroke="#718096"
              strokeWidth="1.2"
              points="0,32 30,30 60,35 90,26 120,28 150,22 175,12 185,10 195,14 200,16"
            />
            {/* Peak alert point */}
            <circle cx="185" cy="10" r="2.5" fill="#ff4d15" />
          </svg>
        </div>

        {/* Time Axis Labels (12 AM, 6 AM, 6 PM) */}
        <div className="flex justify-between text-[8px] text-tactical-dim px-1 font-mono">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>6 PM</span>
        </div>
      </div>
    </div>
  );
}
