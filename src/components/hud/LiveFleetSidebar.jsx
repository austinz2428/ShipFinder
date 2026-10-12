import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Anchor, Navigation, Radio, Filter } from 'lucide-react';

const TYPE_COLORS = {
  cargo: '#eab308',
  tanker: '#f97316',
  pleasure: '#d946ef',
  tug: '#0284c7',
  fishing: '#16a34a',
  other: '#94a3b8'
};

function getVesselColor(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('cargo') || t.includes('carrier') || t.includes('container')) return TYPE_COLORS.cargo;
  if (t.includes('tanker') || t.includes('crude') || t.includes('oil')) return TYPE_COLORS.tanker;
  if (t.includes('pleasure') || t.includes('yacht')) return TYPE_COLORS.pleasure;
  if (t.includes('tug') || t.includes('tow')) return TYPE_COLORS.tug;
  if (t.includes('fish')) return TYPE_COLORS.fishing;
  return TYPE_COLORS.other;
}

export default function LiveFleetSidebar({
  vessels = [],
  selectedVessel,
  onSelectVessel,
  isCollapsed,
  onToggleCollapse
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');

  const isGreatLakes = (v) => {
    if (v.is_great_lakes || v.strait === 'Great Lakes' || v.lake) return true;
    const lat = v.lat;
    const lon = v.lon;
    return (
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      lat >= 41.0 &&
      lat <= 49.0 &&
      lon >= -92.5 &&
      lon <= -76.0
    );
  };

  const filteredVessels = useMemo(() => {
    let list = vessels;
    if (selectedType === 'GREAT_LAKES') {
      list = [...vessels]
        .filter(isGreatLakes)
        .sort((a, b) => (b.length || 0) - (a.length || 0));
    } else if (selectedType !== 'ALL') {
      list = vessels.filter((v) => {
        const t = (v.type || '').toLowerCase();
        if (selectedType === 'CARGO' && !t.includes('cargo') && !t.includes('carrier')) return false;
        if (selectedType === 'TANKER' && !t.includes('tanker')) return false;
        if (selectedType === 'TUG' && !t.includes('tug') && !t.includes('tow')) return false;
        if (selectedType === 'YACHT' && !t.includes('pleasure') && !t.includes('yacht')) return false;
        if (selectedType === 'FISHING' && !t.includes('fish') && !t.includes('trawl')) return false;
        return true;
      });
    }

    if (!filterQuery.trim()) return list;
    const q = filterQuery.toLowerCase();
    return list.filter((v) =>
      v.name?.toLowerCase().includes(q) ||
      String(v.mmsi).includes(q) ||
      String(v.imo || '').includes(q) ||
      v.type?.toLowerCase().includes(q) ||
      v.lake?.toLowerCase().includes(q)
    );
  }, [vessels, selectedType, filterQuery]);

  const displayLimit = selectedType === 'GREAT_LAKES' ? 20 : (filterQuery ? 350 : 200);
  const displayVessels = filteredVessels.slice(0, displayLimit);

  if (isCollapsed) {
    return (
      <div className="h-full bg-[#f4f5f7]/95 border-r border-tactical-border flex flex-col items-center py-3 z-30 select-none">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-gray-200 text-tactical-muted hover:text-tactical-text transition-colors"
          title="Expand Live Fleet Directory"
        >
          <ChevronRight className="w-4 h-4 text-tactical-orange" />
        </button>
        <div className="mt-8 [writing-mode:vertical-lr] text-[10px] font-bold text-tactical-muted uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>FLEET DIRECTORY ({vessels.length.toLocaleString()})</span>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-72 h-full bg-[#f4f5f7]/95 backdrop-blur-md border-r border-tactical-border flex flex-col justify-between font-mono text-xs select-none z-30 shadow-sm">
      {/* Top Header */}
      <div className="p-3 border-b border-tactical-border flex flex-col gap-2.5 bg-white/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-tactical-text text-xs uppercase tracking-wider">
              LIVE FLEET DIRECTORY
            </span>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-gray-200 text-tactical-muted hover:text-tactical-text transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Live Search */}
        <div className="flex items-center bg-[#e2e5ea] rounded px-2 py-1 border border-tactical-border/60 focus-within:border-tactical-orange">
          <Search className="w-3.5 h-3.5 text-tactical-dim mr-1.5" />
          <input
            type="text"
            placeholder={`SEARCH ${vessels.length.toLocaleString()} VESSELS...`}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="bg-transparent text-[11px] text-tactical-text outline-none placeholder:text-tactical-dim/70 w-full"
          />
        </div>

        {/* Category & Great Lakes Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[9px]">
          <button
            onClick={() => setSelectedType('ALL')}
            className={`px-2 py-0.5 rounded font-semibold whitespace-nowrap transition-all ${
              selectedType === 'ALL'
                ? 'bg-tactical-orange text-white'
                : 'bg-gray-200 text-tactical-muted hover:bg-gray-300'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => setSelectedType('GREAT_LAKES')}
            className={`px-2 py-0.5 rounded font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedType === 'GREAT_LAKES'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-100/90 text-amber-900 border border-amber-300 hover:bg-amber-200'
            }`}
            title="Top 20 Largest Great Lakes Freighters"
          >
            <span>⚓ TOP 20 GREAT LAKES</span>
          </button>
          {['CARGO', 'TANKER', 'TUG', 'YACHT', 'FISHING'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-2 py-0.5 rounded font-semibold whitespace-nowrap transition-all ${
                selectedType === type
                  ? 'bg-tactical-orange text-white'
                  : 'bg-gray-200 text-tactical-muted hover:bg-gray-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Informational Sub-banner for Great Lakes Mode */}
        {selectedType === 'GREAT_LAKES' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1 text-[9px] text-amber-900 flex items-center justify-between font-mono">
            <span className="font-bold">TOP 20 GREAT LAKES SUPER-CARRIERS</span>
            <span className="text-[8px] text-amber-700">SORTED BY LENGTH (FT)</span>
          </div>
        )}
      </div>

      {/* Real Tracked Vessels Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-200/60">
        {displayVessels.map((v, idx) => {
          const isSelected = selectedVessel && selectedVessel.mmsi === v.mmsi;
          const isUnderway = v.sog && v.sog >= 0.5;
          const color = getVesselColor(v.type);
          const lengthFt = Math.round((v.length || 0) * 3.28084);
          const widthFt = Math.round((v.width || 0) * 3.28084);

          return (
            <div
              key={v.mmsi}
              onClick={() => onSelectVessel(v)}
              className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-tactical-orangeSoft border-l-4 border-tactical-orange'
                  : 'hover:bg-black/5'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {/* Great Lakes Rank Badge or Vessel Dot */}
                {selectedType === 'GREAT_LAKES' ? (
                  <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-900 border border-amber-500/30 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                ) : (
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}

                <div className="flex flex-col overflow-hidden">
                  <span className="font-bold text-[11px] text-tactical-text truncate">
                    {v.name}
                  </span>
                  <div className="flex items-center gap-1.5 text-[9px] text-tactical-dim">
                    {selectedType === 'GREAT_LAKES' ? (
                      <>
                        <span className="font-semibold text-amber-800">{lengthFt.toLocaleString()} FT</span>
                        <span>·</span>
                        <span className="text-gray-500">{widthFt} FT BEAM</span>
                      </>
                    ) : (
                      <>
                        <span>{v.type?.split(' ')[0] || 'Vessel'}</span>
                        <span>·</span>
                        <span>{v.flag || 'USA'}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Speed & Status */}
              <div className="flex flex-col items-end flex-shrink-0 text-right">
                <span className={`font-bold text-[10px] ${isUnderway ? 'text-emerald-700 font-bold' : 'text-tactical-dim'}`}>
                  {v.sog || 0} KN
                </span>
                <span className="text-[8px] text-tactical-dim">
                  {v.lake || v.strait || `${v.heading || v.cog || 0}°T`}
                </span>
              </div>
            </div>
          );
        })}

        {filteredVessels.length === 0 && (
          <div className="p-4 text-center text-tactical-dim text-[11px]">
            No vessels match "{filterQuery}"
          </div>
        )}
      </div>

      {/* Bottom Status Footer */}
      <div className="p-2.5 border-t border-tactical-border bg-white/70 flex flex-col gap-1 text-[10px] text-tactical-dim">
        <div className="flex items-center justify-between">
          <span>TRACKING: <strong className="text-tactical-text font-bold text-xs">{vessels.length.toLocaleString()}</strong></span>
          <span className="text-emerald-600 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            AISSTREAM LIVE
          </span>
        </div>
        {filteredVessels.length > displayVessels.length && (
          <div className="text-[9px] text-tactical-muted">
            Showing {displayVessels.length} of {filteredVessels.length.toLocaleString()} (search to refine)
          </div>
        )}
      </div>
    </aside>
  );
}
