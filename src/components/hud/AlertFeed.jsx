import React from 'react';

export default function AlertFeed({ alerts = [], onSelectVesselByName }) {
  const defaultAlerts = [
    {
      id: "1",
      time: "14:12",
      title: "AIS GAP · 18M",
      vessel: "MV ORION",
      level: "CRIT"
    },
    {
      id: "2",
      time: "14:05",
      title: "OFF-LANE · 0.4 NM",
      vessel: "MV KARA",
      level: "WARN"
    },
    {
      id: "3",
      time: "13:58",
      title: "SPEED DROP · -3.1 KN",
      vessel: "MV MIRA",
      level: "INFO"
    },
    {
      id: "4",
      time: "13:41",
      title: "QUEUE +2",
      vessel: "N-GATE",
      level: "INFO"
    }
  ];

  const displayAlerts = alerts.length > 0 ? alerts : defaultAlerts;

  return (
    <div className="relative flex-1 bg-[#f4f5f7]/95 p-3.5 flex flex-col justify-between font-mono text-xs select-none backdrop-blur-sm">
      {/* Corner crosshairs indicator */}
      <div className="absolute top-1.5 right-2 text-[10px] text-tactical-dim font-bold">+</div>
      <div className="absolute bottom-1.5 right-2 text-[10px] text-tactical-dim font-bold">+</div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-tactical-border/60 pb-1.5">
        <span className="text-[11px] font-bold tracking-wider text-tactical-text uppercase">
          ALERT FEED
        </span>
        <span className="text-[9px] text-tactical-dim">
          <span className="font-semibold text-tactical-text">3 ACTIVE</span> ·{' '}
          <span className="font-bold text-tactical-orange">1 CRIT</span>
        </span>
      </div>

      {/* AIS Signal Oscilloscope Waveform (Matching Screenshot) */}
      <div className="flex flex-col gap-1 my-1">
        <div className="flex justify-between items-center text-[8px] text-tactical-dim">
          <span>| AIS SIGNAL · MV ORION</span>
          <span className="text-tactical-orange font-semibold">| LAST PING 14:12</span>
        </div>

        <div className="relative h-10 w-full bg-white/70 rounded border border-tactical-border/60 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 240 36" preserveAspectRatio="none">
            {/* Active Signal Waveform (Zigzag Pulse) */}
            <polyline
              fill="none"
              stroke="#4a5568"
              strokeWidth="1.2"
              points="
                0,18 10,18 15,10 20,26 25,18 35,18 40,8 45,28 50,18 
                60,18 65,12 70,24 75,18 85,18 90,6 95,30 100,18 
                110,18 115,14 120,22 125,18 135,18 140,8 145,28 150,18 
                160,18 165,11 170,25 175,18 185,18 190,18
              "
            />

            {/* Orange Gap Zone (Flatlined / Signal Drop) */}
            <rect x="190" y="0" width="50" height="36" fill="rgba(255, 77, 21, 0.12)" />
            <line x1="190" y1="0" x2="190" y2="36" stroke="#ff4d15" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="190" y1="18" x2="240" y2="18" stroke="#ff4d15" strokeWidth="1.5" strokeDasharray="3,3" />
          </svg>

          {/* Badge over gap */}
          <div className="absolute right-2 top-1 text-[8px] text-tactical-orange font-bold uppercase tracking-wider">
            GAP 18M
          </div>
        </div>
      </div>

      {/* Alert Feed List */}
      <div className="flex flex-col gap-1.5 overflow-hidden">
        {displayAlerts.map((alert) => {
          const isCrit = alert.level === 'CRIT';
          const isWarn = alert.level === 'WARN';

          return (
            <div
              key={alert.id}
              onClick={() => onSelectVesselByName && onSelectVesselByName(alert.vessel)}
              className={`px-2.5 py-1.5 rounded flex items-center justify-between cursor-pointer transition-all ${
                isCrit
                  ? 'bg-tactical-orangeSoft border border-tactical-orangeBorder text-tactical-orange font-bold'
                  : 'bg-white/80 border border-tactical-border text-tactical-text hover:bg-gray-100'
              }`}
            >
              {/* Timestamp & Alert Title */}
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-tactical-dim font-normal">{alert.time}</span>
                <span className="font-semibold">{alert.title}</span>
                <span className="text-[9px] text-tactical-dim">
                  {alert.vessel}
                </span>
              </div>

              {/* Tag Pill */}
              <span
                className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wider ${
                  isCrit
                    ? 'bg-tactical-orange text-white'
                    : isWarn
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                {alert.level}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
