import React, { useState, useEffect, useRef } from 'react';
import { Shield, Activity, Radio, AlertOctagon } from 'lucide-react';
import { useV2XWebSocket } from './hooks/useV2XWebSocket.js';
import { MapSimulation } from './components/MapSimulation.js';
import { HUDAlerts } from './components/HUDAlerts.js';
import { InfotainmentConsole } from './components/InfotainmentConsole.js';
import { PacketMonitor } from './components/PacketMonitor.js';
import { DriverStyle, SafetyAlert } from '../../shared/types.js';

const App: React.FC = () => {
  const vehicleId = 'OBU_PLAYER_01';

  // State Management
  const [driverStyle, setDriverStyle] = useState<DriverStyle>('COMMUTER');
  const [isDistracted, setIsDistracted] = useState<boolean>(false);
  const [activeWarning, setActiveWarning] = useState<SafetyAlert | null>(null);
  const [historicalIncidents, setHistoricalIncidents] = useState<any[]>([]);

  // Local hook for C-V2X websocket telemetry
  const {
    connected,
    rsuStatus,
    otherVehicles,
    networkConfig,
    actualRTT,
    packetCount,
    sendCAM,
    sendDENM
  } = useV2XWebSocket({
    vehicleId,
    onAlertReceived: (denm) => {
      // Trigger warning from other vehicles or RSUs
      setActiveWarning({
        id: denm.eventId,
        type: denm.eventType === 'PEDESTRIAN_IN_ROAD' ? 'PEDESTRIAN' : 'COLLISION',
        severity: denm.severity,
        message: denm.description,
        timestamp: Date.now()
      });
    }
  });

  // Track warning triggers to measure driver reaction time
  const alertTriggerTimeRef = useRef<number | null>(null);
  const isBrakingLoggedRef = useRef<boolean>(false);

  useEffect(() => {
    if (activeWarning) {
      if (alertTriggerTimeRef.current === null) {
        alertTriggerTimeRef.current = Date.now();
        isBrakingLoggedRef.current = false;
      }
    } else {
      alertTriggerTimeRef.current = null;
      isBrakingLoggedRef.current = false;
    }
  }, [activeWarning]);

  // Monitor safety warnings
  const handleHUDWarning = (warning: SafetyAlert | null) => {
    setActiveWarning(warning);
  };

  // Sync network presets with Node.js backend REST API
  const handleConfigChange = async (latency: number, dropRate: number) => {
    try {
      await fetch('http://localhost:8081/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulatedLatency: latency, packetDropRate: dropRate })
      });
    } catch (e) {
      console.warn('Backend REST API unreachable. Working in fallback mode.');
    }
  };

  // Log incident reaction logs when driver reacts
  const handleDriverReaction = async (brakeApplied: boolean, currentSpeed: number) => {
    if (brakeApplied && activeWarning && alertTriggerTimeRef.current && !isBrakingLoggedRef.current) {
      isBrakingLoggedRef.current = true;
      const reactionTimeMs = Date.now() - alertTriggerTimeRef.current;
      const wasCollision = currentSpeed > 5 && reactionTimeMs > 2500; // simulated collision test

      const logPayload = {
        id: `inc_${Date.now()}`,
        timestamp: Date.now(),
        eventType: activeWarning.type,
        severity: activeWarning.severity,
        driverStyle,
        reactionTimeMs,
        wasCollision,
        description: `Brakes applied. Alert: ${activeWarning.message}. Speed: ${Math.round(currentSpeed * 1.5)}km/h.`
      };

      try {
        const response = await fetch('http://localhost:8081/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload)
        });
        if (response.ok) {
          fetchIncidentsHistory();
        }
      } catch (err) {
        // Fallback: log to state directly
        setHistoricalIncidents(prev => [logPayload, ...prev]);
      }
    }
  };

  const fetchIncidentsHistory = async () => {
    try {
      const response = await fetch('http://localhost:8081/api/incidents');
      if (response.ok) {
        const data = await response.json();
        setHistoricalIncidents(data);
      }
    } catch (e) {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchIncidentsHistory();
    const interval = setInterval(fetchIncidentsHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      {/* Top Cockpit Header */}
      <header className="cockpit-header glass-panel">
        <div className="flex-align-center flex-gap-3">
          <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
            <Shield className="text-cyan-400" size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-wider font-display">
              V2X Active Safety Cockpit
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">
              Vehicle OBU Node: {vehicleId} | Host MEC Region: US-EAST-EDGE
            </p>
          </div>
        </div>

        <div className="flex-align-center flex-gap-4 font-mono text-[11px]">
          <div className="flex-align-center flex-gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <Radio size={14} className={connected ? 'text-cyan-400' : 'text-red-500'} />
            <span className="text-slate-500">MEC Sidelink:</span>
            <span className={connected ? 'text-cyan-400 font-bold' : 'text-red-500 font-bold'}>
              {connected ? 'STABLE' : 'OFFLINE'}
            </span>
          </div>

          <div className="flex-align-center flex-gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            <Activity size={14} className="text-cyan-400" />
            <span className="text-slate-500">Transit RTT:</span>
            <span className="text-white font-bold">{actualRTT} ms</span>
          </div>
        </div>
      </header>

      {/* Main Cockpit Workspace */}
      <main className="workspace-grid">
        
        {/* Left Side: V2X Map Physics simulation */}
        <section className="map-column">
          <MapSimulation
            connected={connected}
            otherVehicles={otherVehicles}
            rsuStatus={rsuStatus}
            sendCAM={(pos, speed, heading, braking) => {
              sendCAM(pos, speed, heading, braking);
              handleDriverReaction(braking, speed);
            }}
            sendDENM={sendDENM}
            driverStyle={driverStyle}
            isDistracted={isDistracted}
            onHUDWarning={handleHUDWarning}
          />
        </section>

        {/* Right Side: Driver HUD & Infotainment UI */}
        <section className="cockpit-column">
          {/* Transparent Head-Up Display */}
          <HUDAlerts
            activeWarning={activeWarning}
            networkLatency={actualRTT}
            simulatedLatency={networkConfig.simulatedLatency}
            packetDropRate={networkConfig.packetDropRate}
          />

          {/* Infotainment Console Controller */}
          <div className="flex-grow min-h-0 flex flex-col">
            <InfotainmentConsole
              driverStyle={driverStyle}
              setDriverStyle={setDriverStyle}
              isDistracted={isDistracted}
              setIsDistracted={setIsDistracted}
              simulatedLatency={networkConfig.simulatedLatency}
              packetDropRate={networkConfig.packetDropRate}
              rsuStatus={rsuStatus}
              onConfigChange={handleConfigChange}
            />
          </div>
        </section>
      </main>

      {/* Bottom Area: Packet Decryption Terminal & Black Box Logs */}
      <footer className="footer-grid">
        
        {/* Decrypted Packet Terminal Log */}
        <div className="terminal-wrapper">
          <PacketMonitor 
            packetCount={packetCount} 
          />
        </div>

        {/* SQLite Incident Logger DB Display */}
        <div className="sqlite-wrapper glass-panel p-4 flex flex-col min-h-0">
          <div className="flex-align-center flex-gap-2 border-b border-slate-800 pb-2 mb-2">
            <AlertOctagon className="text-cyan-400" size={16} />
            <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">
              SQLite EDR Incident History (Black Box)
            </h4>
          </div>
          <div className="blackbox-list">
            {historicalIncidents.map((inc: any, i) => (
              <div key={inc.id || i} className="blackbox-row">
                <div>
                  <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600, textTransform: 'uppercase' }}>
                    {inc.event_type || inc.eventType} Alert
                  </span>
                  <span style={{ color: '#8493a8', display: 'block', fontSize: '9px', marginTop: '2px' }}>
                    {inc.description}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="text-cyan-400 font-bold" style={{ display: 'block' }}>
                    {(inc.reaction_time_ms || inc.reactionTimeMs).toFixed(0)} ms
                  </span>
                  <span className="text-slate-600" style={{ fontSize: '8px' }}>
                    {inc.driver_style || inc.driverStyle}
                  </span>
                </div>
              </div>
            ))}
            {historicalIncidents.length === 0 && (
              <div style={{ color: '#4b586e', fontStyle: 'italic', fontSize: '10px', padding: '8px' }}>
                No active black box incident reports registered.
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
