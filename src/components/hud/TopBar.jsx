import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Mountain, Map as MapIcon, X, AlertTriangle, AlertCircle, Info, Radio } from 'lucide-react';
import { INITIAL_ALERTS } from '../../data/mockVessels';
import CloudRelayModal from './CloudRelayModal';

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
  latency = 82,
  feedMode = 'CONNECTING',
  relayUrl = null
}) {
  const [utcTime, setUtcTime] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [showRelayModal, setShowRelayModal] = useState(false);
  const alertsDropdownRef = useRef(null);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (alertsDropdownRef.current && !alertsDropdownRef.current.contains(e.target)) {
        setShowAlertsDropdown(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAlertsDropdown(false);
        setShowSearchDropdown(false);
        setShowMobileSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const displayAlerts = alerts || [];

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
    ? allVessels.filter(v => {
        const q = searchQuery.toLowerCase();
        return (
          v.name?.toLowerCase().includes(q) ||
          String(v.mmsi).includes(q) ||
          String(v.imo || '').includes(q) ||
          v.type?.toLowerCase().includes(q) ||
          v.flag?.toLowerCase().includes(q) ||
          v.lake?.toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <header className="h-10 bg-[#e9eaec] border-b border-tactical-border flex items-center justify-between px-2 sm:px-3 text-tactical-text text-xs font-mono select-none z-40 gap-1.5 sm:gap-4 relative">
      {/* Left: Tactical Breadcrumbs / Title */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Mobile Brand */}
        <span className="md:hidden font-bold text-tactical-orange text-[11px]">
          ShipFinder
        </span>

        {/* Desktop Breadcrumbs */}
        <div className="hidden md:flex items-center gap-1 font-medium tracking-tight text-[11px] text-tactical-text">
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

      {/* Center: View Mode Toggle (Map <-> 3D) */}
      <div className="flex items-center bg-[#dbdee3] p-0.5 rounded border border-tactical-borderDark/40 shrink-0">
        <button
          onClick={() => onToggleView('map')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded text-[10px] sm:text-[11px] transition-all ${
            currentView === 'map'
              ? 'bg-[#111317] text-white shadow-sm font-semibold'
              : 'text-tactical-muted hover:text-tactical-text'
          }`}
        >
          <MapIcon className="w-3 h-3" />
          <span className="hidden sm:inline">LIVE MAP (US & GLOBE)</span>
          <span className="sm:hidden font-bold">MAP</span>
        </button>
        <button
          onClick={() => onToggleView('topo')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded text-[10px] sm:text-[11px] transition-all ${
            currentView === 'topo'
              ? 'bg-tactical-orange text-white shadow-sm font-semibold'
              : 'text-tactical-muted hover:text-tactical-text'
          }`}
        >
          <Mountain className="w-3 h-3" />
          <span className="hidden sm:inline">3D TOPO STRAIT</span>
          <span className="sm:hidden font-bold">3D</span>
        </button>
      </div>

      {/* Right: UTC Time, Latency, Live Relay, Search, and Alerts */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* UTC Clock (Desktop only) */}
        <div className="hidden lg:block text-[11px] text-tactical-muted tracking-wider">
          {utcTime || '14:30:07 UTC+0'}
        </div>

        {/* Latency Monitor (Desktop only) */}
        <div className="hidden md:flex items-center gap-1 text-[11px] text-tactical-dim">
          <span>Latency:</span>
          <span className="font-semibold text-tactical-text">{latency}ms</span>
        </div>

        {/* Live Cloud Relay Pill */}
        <button
          onClick={() => setShowRelayModal(true)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-tight transition-all cursor-pointer ${
            feedMode === 'LIVE_RELAY'
              ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/40 hover:bg-emerald-500/25'
              : feedMode === 'CONNECTING'
              ? 'bg-amber-500/15 text-amber-800 border border-amber-500/40 hover:bg-amber-500/25 animate-pulse'
              : 'bg-gray-500/15 text-gray-700 border border-gray-400/40 hover:bg-gray-500/25'
          }`}
          title={
            feedMode === 'LIVE_RELAY'
              ? '24/7 Live WebSocket Stream Active (0s delay)'
              : feedMode === 'CONNECTING'
              ? 'Auto-connecting to live AIS stream...'
              : 'Static snapshot mode (Click to connect live stream)'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              feedMode === 'LIVE_RELAY'
                ? 'bg-emerald-600 animate-pulse'
                : feedMode === 'CONNECTING'
                ? 'bg-amber-500 animate-ping'
                : 'bg-gray-400'
            }`}
          />
          <span className="hidden sm:inline">
            {feedMode === 'LIVE_RELAY'
              ? 'LIVE RELAY'
              : feedMode === 'CONNECTING'
              ? 'CONNECTING LIVE...'
              : 'CRON (15M)'}
          </span>
          <span className="sm:hidden">
            {feedMode === 'LIVE_RELAY'
              ? 'LIVE'
              : feedMode === 'CONNECTING'
              ? 'CONNECTING'
              : 'CRON'}
          </span>
        </button>

        {/* Desktop Search Bar */}
        <div className="relative hidden sm:block" ref={searchContainerRef}>
          <div className="flex items-center bg-[#dbdee3] border border-tactical-borderDark/50 rounded px-2 py-0.5 focus-within:border-tactical-orange">
            <Search className="w-3 h-3 text-tactical-dim mr-1.5 shrink-0" />
            <input
              type="text"
              placeholder="SEARCH..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="bg-transparent text-[11px] text-tactical-text outline-none placeholder:text-tactical-dim/70 w-28 sm:w-36 focus:w-48 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  onSearchChange('');
                  setShowSearchDropdown(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Desktop Search Results Dropdown */}
          {showSearchDropdown && filteredVessels.length > 0 && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-tactical-border shadow-xl rounded z-50 max-h-72 overflow-y-auto">
              <div className="px-3 py-1.5 bg-[#f4f5f7] border-b border-tactical-border text-[10px] text-tactical-dim font-bold flex justify-between">
                <span>FOUND {filteredVessels.length.toLocaleString()} VESSELS</span>
                <span>SHOWING {Math.min(25, filteredVessels.length)}</span>
              </div>
              {filteredVessels.slice(0, 25).map(v => (
                <div
                  key={v.mmsi}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (currentView !== 'map' && onToggleView) {
                      onToggleView('map');
                    }
                    onSelectVessel(v);
                    setShowSearchDropdown(false);
                    onSearchChange('');
                  }}
                  className="px-3 py-2 border-b border-gray-100 hover:bg-tactical-orangeSoft cursor-pointer flex flex-col gap-0.5 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xs text-tactical-text truncate max-w-[170px]">{v.name}</span>
                    <span className="text-[10px] text-tactical-orange font-mono font-bold">{v.sog} KN</span>
                  </div>
                  <div className="text-[10px] text-tactical-muted flex justify-between">
                    <span>{v.type}</span>
                    <span>{v.flag || v.lake || `MMSI: ${v.mmsi}`}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Search Button */}
        <button
          onClick={() => setShowMobileSearch(true)}
          className="sm:hidden flex items-center gap-1 bg-[#dbdee3] border border-tactical-borderDark/50 rounded px-2 py-0.5 text-[10px] font-bold text-tactical-text active:bg-gray-300 touch-manipulation"
          title="Search Vessels"
        >
          <Search className="w-3 h-3 text-tactical-dim shrink-0" />
          <span>SEARCH</span>
        </button>

        {/* Interactive Alert Button & Dropdown */}
        <div className="relative" ref={alertsDropdownRef}>
          <button
            onClick={() => setShowAlertsDropdown((prev) => !prev)}
            className={`flex items-center px-2 py-1 rounded text-[10px] sm:text-[11px] font-bold tracking-wider transition-all shadow-sm touch-manipulation ${
              showAlertsDropdown
                ? 'bg-[#b91c1c] text-white ring-2 ring-red-400'
                : displayAlerts.length > 0
                ? 'bg-tactical-orange hover:bg-[#e03d07] text-white active:scale-95'
                : 'bg-[#4b5563] text-gray-200 hover:bg-[#374151] active:scale-95'
            }`}
            title="Toggle Live Maritime Alerts Feed"
          >
            <Bell className="w-3 h-3 mr-0.5 sm:mr-1 fill-white shrink-0" />
            <span className="hidden sm:inline">ALERTS</span>
            <span className="ml-1 bg-black/25 px-1 py-0.2 rounded text-[9px] font-mono">
              {displayAlerts.length}
            </span>
          </button>

          {/* Mobile Backdrop for Alerts */}
          {showAlertsDropdown && (
            <div
              className="fixed inset-0 bg-black/50 z-40 sm:hidden backdrop-blur-xs"
              onClick={() => setShowAlertsDropdown(false)}
            />
          )}

          {/* Tactical Alerts Dropdown Panel */}
          {showAlertsDropdown && (
            <div className="fixed sm:absolute right-2 sm:right-0 top-12 sm:top-full mt-1 w-[calc(100vw-16px)] sm:w-96 max-w-[95vw] sm:max-w-none bg-white border border-tactical-border shadow-2xl rounded-lg z-50 overflow-hidden font-mono text-xs flex flex-col animate-in fade-in zoom-in-95 duration-100 max-h-[75vh] sm:max-h-96">
              {/* Header */}
              <div className="bg-[#1e232d] text-white px-3 py-2 flex items-center justify-between border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${displayAlerts.length > 0 ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
                  <span className="font-bold text-[11px] tracking-wider uppercase">
                    MARITIME SAFETY ALERTS
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">
                    {displayAlerts.length} ACTIVE
                  </span>
                  <button
                    onClick={() => setShowAlertsDropdown(false)}
                    className="text-gray-400 hover:text-white p-0.5 rounded transition-colors touch-manipulation"
                    title="Close Alerts"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Alert Feed List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 p-1 overscroll-contain">
                {displayAlerts.length === 0 ? (
                  <div className="p-4 text-center flex flex-col items-center justify-center gap-2 text-gray-600">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
                      ✓
                    </div>
                    <span className="font-bold text-xs text-gray-800">ALL FAIRWAYS CLEAR</span>
                    <span className="text-[10px] text-gray-500 max-w-[240px] leading-relaxed">
                      Zero critical navigational anomalies detected. All 25,000 vessels operating within safety standards.
                    </span>
                  </div>
                ) : (
                  displayAlerts.map((alert) => {
                    const isCrit = alert.level === 'CRIT';
                    const isWarn = alert.level === 'WARN';

                    return (
                      <div
                        key={alert.id}
                        onClick={() => {
                          const targetVessel = allVessels.find(
                            (v) =>
                              v.mmsi === alert.mmsi ||
                              (alert.mmsi && String(v.mmsi) === String(alert.mmsi)) ||
                              v.name?.toLowerCase() === alert.vessel?.toLowerCase() ||
                              v.name?.toLowerCase().includes(alert.vessel?.toLowerCase())
                          );
                          if (targetVessel && onSelectVessel) {
                            if (currentView !== 'map' && onToggleView) {
                              onToggleView('map');
                            }
                            onSelectVessel(targetVessel, true);
                          }
                          setShowAlertsDropdown(false);
                        }}
                        className="p-3 sm:p-2.5 hover:bg-orange-50/70 active:bg-orange-100 cursor-pointer rounded transition-colors flex flex-col gap-1 border-b border-gray-100 last:border-b-0 touch-manipulation"
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
                            {alert.time || 'Live'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                            <span className="font-bold text-[11px] text-gray-900 truncate">
                              {alert.vessel}
                            </span>
                            {alert.strait && alert.strait !== 'High Seas' && (
                              <span className="text-[9px] px-1 py-0.2 bg-gray-100 text-gray-600 rounded font-semibold shrink-0">
                                {alert.strait}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-tactical-orange hover:underline font-bold shrink-0">
                            LOCATE ON MAP →
                          </span>
                        </div>

                        {alert.details && (
                          <div className="text-[10px] text-gray-500 leading-snug">
                            {alert.details}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Full-Screen Search Modal */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col animate-in fade-in duration-100 sm:hidden">
          <div className="bg-white p-2.5 border-b border-gray-200 flex items-center gap-2 shadow-md">
            <Search className="w-4 h-4 text-tactical-orange shrink-0" />
            <input
              type="text"
              placeholder="Search by ship name or MMSI..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
              className="flex-1 bg-gray-100 rounded px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-tactical-orange font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                setShowMobileSearch(false);
                onSearchChange('');
              }}
              className="px-2 py-1 text-xs font-bold text-gray-600 hover:text-black"
            >
              Close
            </button>
          </div>

          {/* Search Results List */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-2 divide-y divide-gray-200 overscroll-contain">
            {filteredVessels.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                {searchQuery.trim()
                  ? `No vessels found matching "${searchQuery}"`
                  : 'Type a ship name (e.g. "Sam Laud", "Orion") or MMSI number...'}
              </div>
            ) : (
              filteredVessels.slice(0, 30).map((v) => (
                <div
                  key={v.mmsi}
                  onClick={() => {
                    if (currentView !== 'map' && onToggleView) {
                      onToggleView('map');
                    }
                    onSelectVessel(v);
                    setShowMobileSearch(false);
                    onSearchChange('');
                  }}
                  className="p-3 bg-white hover:bg-orange-50 active:bg-orange-100 cursor-pointer flex justify-between items-center transition-colors touch-manipulation rounded my-1 shadow-xs"
                >
                  <div className="flex flex-col gap-0.5 truncate pr-2">
                    <span className="font-bold text-xs text-gray-900 truncate">{v.name}</span>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                      <span>{v.type || 'Commercial'}</span>
                      <span>·</span>
                      <span>MMSI: {v.mmsi}</span>
                      {v.strait && v.strait !== 'High Seas' && (
                        <span className="px-1 py-0.2 bg-gray-100 text-gray-700 rounded text-[9px] font-semibold">
                          {v.strait}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-tactical-orange font-mono font-bold">{v.sog} KN</span>
                    <div className="text-[9px] text-tactical-orange font-semibold">LOCATE ➔</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Cloud Relay Configuration Modal */}
      <CloudRelayModal
        isOpen={showRelayModal}
        onClose={() => setShowRelayModal(false)}
        feedMode={feedMode}
        latency={latency}
        relayUrl={relayUrl}
      />
    </header>
  );
}
