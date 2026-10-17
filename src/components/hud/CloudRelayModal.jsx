import React, { useState, useEffect } from 'react';
import { X, Server, Wifi, WifiOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { aisClient } from '../../services/aisClient';

export default function CloudRelayModal({ isOpen, onClose, feedMode, latency, relayUrl }) {
  const [urlInput, setUrlInput] = useState('');
  const [testState, setTestState] = useState(null); // 'testing' | 'success' | 'error' | null
  const [testDetails, setTestDetails] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrlInput(relayUrl || window.localStorage.getItem('shipfinder_relay_url') || 'https://shipfinder-relay.onrender.com');
      setTestState(null);
      setTestDetails('');
    }
  }, [isOpen, relayUrl]);

  if (!isOpen) return null;

  const isLive = feedMode === 'LIVE_RELAY';
  const isConnecting = feedMode === 'CONNECTING';

  const handleTestConnection = async () => {
    if (!urlInput.trim()) {
      setTestState('error');
      setTestDetails('Please enter a valid URL (e.g. https://shipfinder-relay.onrender.com or localhost:8080)');
      return;
    }

    setTestState('testing');
    setTestDetails('Testing connection to cloud relay...');

    let httpUrl = urlInput.trim();
    if (httpUrl.startsWith('ws://')) httpUrl = httpUrl.replace('ws://', 'http://');
    if (httpUrl.startsWith('wss://')) httpUrl = httpUrl.replace('wss://', 'https://');
    if (!httpUrl.startsWith('http://') && !httpUrl.startsWith('https://')) {
      httpUrl = `https://${httpUrl}`;
    }
    httpUrl = httpUrl.replace(/\/ws\/?$/, '').replace(/\/+$/, '');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${httpUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setTestState('success');
        setTestDetails(`Online! Tracked Fleet: ${data.tracked_vessels?.toLocaleString() || 'Active'} | Uptime: ${data.uptime_seconds || 0}s`);
      } else {
        setTestState('error');
        setTestDetails(`Server returned HTTP ${res.status}. Ensure server.py is running.`);
      }
    } catch (err) {
      setTestState('error');
      setTestDetails(`Could not reach ${httpUrl}. (If using Render free tier, the first wake-up request may take ~45s)`);
    }
  };

  const handleApply = () => {
    if (!urlInput.trim()) {
      aisClient.disconnectCloudRelay();
      onClose();
      return;
    }
    aisClient.connectCloudRelay(urlInput.trim());
    onClose();
  };

  const handleDisconnect = () => {
    aisClient.disconnectCloudRelay();
    setUrlInput('');
    setTestState(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs font-mono text-xs p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#1a1e27] text-[#e0e4ec] border border-tactical-borderDark/80 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#14171f] px-4 py-3 border-b border-tactical-borderDark/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-tactical-orange" />
            <span className="font-bold tracking-wider text-sm text-white">24/7 LIVE CLOUD RELAY</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {/* Status Banner */}
          <div className={`p-3 rounded border flex items-center justify-between ${
            isLive
              ? 'bg-green-950/40 border-green-500/40 text-green-300'
              : isConnecting
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              : 'bg-gray-800/40 border-gray-600/40 text-gray-300'
          }`}>
            <div className="flex items-center gap-2.5">
              {isLive ? (
                <Wifi className="w-4 h-4 text-green-400 animate-pulse" />
              ) : isConnecting ? (
                <Wifi className="w-4 h-4 text-amber-400 animate-ping" />
              ) : (
                <WifiOff className="w-4 h-4 text-gray-400" />
              )}
              <div>
                <div className="font-bold text-xs">
                  {isLive
                    ? '🟢 LIVE WEBSOCKET STREAM ACTIVE'
                    : isConnecting
                    ? '🟡 AUTO-CONNECTING TO LIVE STREAM...'
                    : '⚪ STATIC BATCH (15M CRON FEED)'}
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  {isLive
                    ? `Connected to ${relayUrl || 'cloud relay'} · Latency: ${latency}ms`
                    : isConnecting
                    ? `Connecting to ${relayUrl || 'https://shipfinder-relay.onrender.com'}. Auto-handshake in progress...`
                    : 'Serving GitHub Actions periodic static snapshots'}
                </div>
              </div>
            </div>
            {isLive ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-300">
                0s DELAY
              </span>
            ) : isConnecting ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 animate-pulse">
                AUTO-CONNECTING
              </span>
            ) : null}
          </div>

          {/* Configuration Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gray-300 flex items-center justify-between">
              <span>CLOUD RELAY URL (RENDER / RAILWAY / LOCALHOST)</span>
              <span className="text-[10px] text-gray-400">HTTPS or WSS</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://shipfinder-relay.onrender.com or localhost:8080"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 bg-[#101218] border border-gray-700 rounded px-3 py-1.5 text-xs text-white placeholder:text-gray-500 outline-none focus:border-tactical-orange font-mono"
              />
              <button
                onClick={handleTestConnection}
                disabled={testState === 'testing'}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded font-semibold text-[11px] border border-gray-600 transition-colors cursor-pointer"
              >
                {testState === 'testing' ? 'Testing...' : 'Test'}
              </button>
            </div>

            {/* Test feedback */}
            {testState === 'success' && (
              <div className="flex items-center gap-1.5 text-green-400 text-[11px] mt-1 bg-green-950/20 p-2 rounded border border-green-800/40">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{testDetails}</span>
              </div>
            )}
            {testState === 'error' && (
              <div className="flex items-center gap-1.5 text-red-400 text-[11px] mt-1 bg-red-950/20 p-2 rounded border border-red-800/40">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{testDetails}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#14171f] px-4 py-3 border-t border-tactical-borderDark/60 flex items-center justify-between">
          {isLive ? (
            <button
              onClick={handleDisconnect}
              className="text-red-400 hover:text-red-300 text-[11px] font-semibold cursor-pointer"
            >
              Disconnect (Revert to Cron)
            </button>
          ) : (
            <span className="text-[10px] text-gray-500">Static fallback is active</span>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-[11px] text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 rounded text-[11px] font-bold text-white bg-tactical-orange hover:bg-[#e03d07] shadow-sm transition-all cursor-pointer"
            >
              {isLive ? 'Save & Reconnect' : isConnecting ? 'Connecting Live...' : 'Connect Live Stream'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
