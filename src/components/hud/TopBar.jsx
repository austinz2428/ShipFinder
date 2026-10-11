import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Mountain, Map as MapIcon, X, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { INITIAL_ALERTS } from '../../data/mockVessels';

export default function TopBar({
  currentView = 'map', // 'map' | 'topo'
  onToggleView,
  selectedVessel,
  searchQuery,
  onSearchChange,
  allVessels = [],
  onSelectVessel,
  alerts = INITIAL_ALERTS,
  alertsCount,
  latency = 82
}) {
  const [utcTime, setUtcTime] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const alertsDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (alertsDropdownRef.current && !alertsDropdownRef.current.contains(e.target)) {
        setShowAlertsDropdown(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAlertsDropdown(false);
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const displayAlerts = (alerts && alerts.length > 0) ? alerts : INITIAL_ALERTS;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${minutes}:${seconds} UTC+0`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredVessels = searchQuery.trim()
    ? allVessels.filter(v =>
        v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(v.mmsi).includes(searchQuery) ||
        String(v.imo || '').includes(searchQuery) ||
        v.type?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="h-10 bg-[#e9eaec] border-b border-tactical-border flex items-center justify-between px-3 text-tactical-text text-xs font-mono select-none z-40">
      {/* Left: Tactical Breadcrumbs */}
      <div className="flex items-center gap-3">

        {/* Tactical Breadcrumbs */}
        <div className="flex items-center gap-1 font-medium tracking-tight text-[11px] text-tactical-text">
          <span className="font-semibold text-tactical-orange">ShipFinder 3D Fairway</span>
          <span className="text-tactical-dim">/</span>
          <span className="text-tactical-muted">{selectedVessel?.strait || 'Waterway Sector'}</span>
          <span className="text-tactical-dim">/</span>
          <span className="font-semibold text-tactical-text">{selectedVessel?.name || 'SAM LAUD'}</span>
          {selectedVessel?.sog !== undefined && (
            <span className="ml-1 text-[10px] text-tactical-orange font-bold font-mono">
              ({selectedVessel.sog} KN LIVE)
            </span>
          )}
        </div>
      </div>

      {/* Center: View Mode Toggle (Two Clean Tabs: Live Map <-> 3D Topo Strait) */}
      <div className="flex items-center bg-[#dbdee3] p-0.5 rounded border border-tactical-borderDark/40">
        <button
          onClick={() => onToggleView('map')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] transition-all ${
            currentView === 'map'
              ? 'bg-[#111317] text-white shadow-sm font-semibold'
              : 'text-tactical-muted hover:text-tactical-text'
          }`}
        >
          <MapIcon className="w-3 h-3" />
          <span>LIVE MAP (US & GLOBE)</span>
        </button>
        <button
          onClick={() => onToggleView('topo')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] transition-all ${
            currentView === 'topo'
              ? 'bg-tactical-orange text-white shadow-sm font-semibold'
              : 'text-tactical-muted hover:text-tactical-text'
          }`}
        >
          <Mountain className="w-3 h-3" />
          <span>3D TOPO STRAIT</span>
        </button>
      </div>

      {/* Right: UTC Time, Latency, Search, and Alerts */}
      <div className="flex items-center gap-4">
        {/* UTC Clock */}
        <div className="text-[11px] text-tactical-muted tracking-wider">
          {utcTime || '14:30:07 UTC+0'}
        </div>

        {/* Latency Monitor */}
        <div className="flex items-center gap-1 text-[11px] text-tactical-dim">
          <span>Latency:</span>
          <span className="font-semibold text-tactical-text">{latency}ms</span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="flex items-center bg-[#dbdee3] border border-tactical-borderDark/50 rounded px-2 py-0.5 focus-within:border-tactical-orange">
            <Search className="w-3 h-3 text-tactical-dim mr-1.5" />
            <input
              type="text"
              placeholder="SEARCH..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="bg-transparent text-[11px] text-tactical-text outline-none placeholder:text-tactical-dim/70 w-28 focus:w-40 transition-all"
            />
          </div>

          {/* Search Results Dropdown */}
          {showSearchDropdown && filteredVessels.length > 0 && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-tactical-border shadow-xl rounded z-50 max-h-60 overflow-y-auto">
              {filteredVessels.slice(0, 8).map(v => (
                <div
                  key={v.mmsi}
                  onClick={() => {
                    onSelectVessel(v);
                    setShowSearchDropdown(false);
                    onSearchChange('');
                  }}
                  className="px-3 py-2 border-b border-gray-100 hover:bg-tactical-orangeSoft cursor-pointer flex flex-col gap-0.5 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xs text-tactical-text">{v.name}</span>
                    <span className="text-[10px] text-tactical-orange font-mono">{v.sog} KN</span>
                  </div>
                  <div className="text-[10px] text-tactical-muted flex justify-between">
                    <span>{v.type}</span>
                    <span>MMSI: {v.mmsi}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Alert Button & Dropdown */}
        <div className="relative" ref={alertsDropdownRef}>
          <button
            onClick={() => setShowAlertsDropdown((prev) => !prev)}
            className={`flex items-center px-2.5 py-1 rounded text-[11px] font-bold tracking-wider transition-all shadow-sm ${
              showAlertsDropdown
                ? 'bg-[#b91c1c] text-white ring-2 ring-red-400'
                : 'bg-tactical-orange hover:bg-[#e03d07] text-white active:scale-95'
            }`}
            title="Toggle Live Maritime Alerts Feed"
          >
            <Bell className="w-3.5 h-3.5 mr-1 fill-white" />
            <span>ALERTS</span>
            <span className="ml-1.5 bg-black/25 px-1.5 py-0.2 rounded text-[10px] font-mono">
              {displayAlerts.length}
            </span>
          </button>

          {/* Tactical Alerts Dropdown Panel */}
          {showAlertsDropdown && (
            <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-white border border-tactical-border shadow-2xl rounded-lg z-50 overflow-hidden font-mono text-xs flex flex-col animate-in fade-in zoom-in-95 duration-100">
              {/* Header */}
              <div className="bg-[#1e232d] text-white px-3 py-2 flex items-center justify-between border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="font-bold text-[11px] tracking-wider uppercase">
                    MARITIME ALERTS
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">
                    {displayAlerts.length} ACTIVE
                  </span>
                  <button
                    onClick={() => setShowAlertsDropdown(false)}
                    className="text-gray-400 hover:text-white p-0.5 rounded transition-colors"
                    title="Close Alerts"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Alert Feed List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 p-1">
                {displayAlerts.map((alert) => {
                  const isCrit = alert.level === 'CRIT';
                  const isWarn = alert.level === 'WARN';

                  return (
                    <div
                      key={alert.id}
                      onClick={() => {
                        const targetVessel = allVessels.find(
                          (v) =>
                            v.name === alert.vessel ||
                            v.name?.includes(alert.vessel) ||
                            String(v.mmsi) === String(alert.vessel)
                        );
                        if (targetVessel && onSelectVessel) {
                          onSelectVessel(targetVessel);
                        }
                        setShowAlertsDropdown(false);
                      }}
                      className="p-2.5 hover:bg-orange-50/70 cursor-pointer rounded transition-colors flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            isCrit
                              ? 'bg-red-100 text-red-700 border border-red-300'
                              : isWarn
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-blue-100 text-blue-700 border border-blue-300'
                          }`}
                        >
                          {alert.level} · {alert.title}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {alert.time}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <span className="font-bold text-[11px] text-gray-900">
                          {alert.vessel}
                        </span>
                        <span className="text-[10px] text-tactical-orange hover:underline font-semibold">
                          VIEW ON MAP →
                        </span>
                      </div>

                      {alert.details && (
                        <div className="text-[10px] text-gray-500 leading-snug">
                          {alert.details}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
