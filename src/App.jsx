import React, { useState, useEffect } from 'react';
import { aisClient } from './services/aisClient';
import TopBar from './components/hud/TopBar';
import LiveFleetSidebar from './components/hud/LiveFleetSidebar';
import VesselDetailDrawer from './components/hud/VesselDetailDrawer';
import TopographicalView from './components/viewport/TopographicalView';
import GlobalMapView from './components/viewport/GlobalMapView';

export default function App() {
  const [currentView, setCurrentView] = useState('map'); // 'map' | 'topo'
  const [vessels, setVessels] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [showDrawer, setShowDrawer] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [latency, setLatency] = useState(82);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState('CRON_SNAPSHOT');
  const [relayUrl, setRelayUrl] = useState(null);

  const [layers, setLayers] = useState({
    tracks: true,
    anchorage: true,
    aisDark: false,
    bathymetry: false,
    weather: false
  });

  // Connect to AIS client and subscribe to stream
  useEffect(() => {
    aisClient.connect();
    aisClient.fetchInitialSnapshot();

    const unsubscribe = aisClient.subscribe((data) => {
      setVessels(data.vessels);
      if (data.alerts) {
        setAlerts(data.alerts);
      }
      if (data.latency) {
        setLatency(data.latency);
      }
      if (data.feedMode) {
        setFeedMode(data.feedMode);
      }
      if (data.relayUrl !== undefined) {
        setRelayUrl(data.relayUrl);
      }

      // If no selected vessel yet, default to SAM LAUD
      setSelectedVessel((prev) => {
        if (prev) {
          const updated = data.vessels.find((v) => v.mmsi === prev.mmsi);
          return updated || prev;
        }
        const samLaud = data.vessels.find((v) => v.name?.includes('SAM LAUD'));
        return samLaud || data.vessels[0] || null;
      });
    });

    return () => unsubscribe();
  }, []);

  const handleSelectVessel = (vessel) => {
    setSelectedVessel(vessel);
    setShowDrawer(true);
  };

  const handleSwitchToTopographical = () => {
    setCurrentView('topo');
    setShowDrawer(false); // Close drawer so 3D fairway and Live Mini GPS screen are front & center
  };

  return (
    <div className={`w-screen h-screen flex flex-col overflow-hidden font-mono ${
      layers.aisDark ? 'bg-[#14171d] text-[#e0e4ec]' : 'bg-[#e9eaec] text-[#111317]'
    }`}>
      {/* 1. Top Bar */}
      <TopBar
        currentView={currentView}
        onToggleView={(view) => {
          setCurrentView(view);
          if (view === 'topo') {
            setShowDrawer(false);
          }
        }}
        selectedVessel={selectedVessel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        allVessels={vessels}
        onSelectVessel={handleSelectVessel}
        alerts={alerts}
        latency={latency}
        feedMode={feedMode}
        relayUrl={relayUrl}
      />

      {/* 2. Main Fullscreen Workspace Layout */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
        {/* Real Live Fleet Directory Sidebar */}
        <LiveFleetSidebar
          vessels={vessels}
          selectedVessel={selectedVessel}
          onSelectVessel={handleSelectVessel}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Center: Full-Height Viewport */}
        <main className="flex-1 h-full min-h-0 relative overflow-hidden">
          {currentView === 'map' ? (
            <GlobalMapView
              vessels={vessels}
              selectedVessel={selectedVessel}
              onSelectVessel={handleSelectVessel}
              onSwitchToTopographical={handleSwitchToTopographical}
              layers={layers}
            />
          ) : (
            <TopographicalView
              vessel={selectedVessel}
              allVessels={vessels}
              onReturnToGlobe={() => setCurrentView('map')}
              onToggleDrawer={() => setShowDrawer(prev => !prev)}
              showDrawer={showDrawer}
              layers={layers}
            />
          )}

          {/* Right Side: Real Vessel Details Drawer */}
          {showDrawer && selectedVessel && (
            <VesselDetailDrawer
              vessel={selectedVessel}
              onClose={() => setShowDrawer(false)}
              onSwitchToTopographical={handleSwitchToTopographical}
              onCenterMap={handleSelectVessel}
            />
          )}
        </main>
      </div>
    </div>
  );
}
