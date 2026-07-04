import React from 'react';
import { ShieldAlert, AlertTriangle, Radio } from 'lucide-react';
import { SafetyAlert } from '../../../shared/types.js';

interface HUDAlertsProps {
  activeWarning: SafetyAlert | null;
  networkLatency: number;
  simulatedLatency: number;
  packetDropRate: number;
}

export const HUDAlerts: React.FC<HUDAlertsProps> = ({
  activeWarning,
  networkLatency,
  simulatedLatency,
  packetDropRate,
}) => {
  const isConnectionDegraded = simulatedLatency >= 100 || packetDropRate > 5;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', flexShrink: 0, width: '100%', position: 'relative', overflow: 'hidden', padding: '16px' }}>
      {/* Background HUD Grid Scan lines */}
      <div className="absolute inset-0 scanlines opacity-20 pointer-events-none" />

      {/* Top Banner: Network Status Warning */}
      {isConnectionDegraded && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '4px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontFamily: 'monospace', color: '#ffab00', background: 'rgba(255, 171, 0, 0.1)', borderBottom: '1px solid rgba(255, 171, 0, 0.2)', zIndex: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Radio size={11} className="animate-spin" />
            MEC LATENCY CRITICAL (DEGRADED SIDE-LINK)
          </span>
          <span>RTT: {networkLatency}ms | Loss: {packetDropRate}%</span>
        </div>
      )}

      {/* Main Alert Layout */}
      {activeWarning ? (
        <div 
          className={activeWarning.severity === 'CRITICAL' ? 'animate-shake' : ''}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            textAlign: 'center',
            padding: '12px 24px',
            borderRadius: '12px',
            maxWidth: '380px',
            border: activeWarning.severity === 'CRITICAL' ? '1.5px solid #ff1744' : '1px solid #ffab00',
            background: activeWarning.severity === 'CRITICAL' ? 'rgba(255, 23, 68, 0.08)' : 'rgba(255, 171, 0, 0.05)',
            boxShadow: activeWarning.severity === 'CRITICAL' ? '0 0 15px rgba(255, 23, 68, 0.15)' : '0 0 10px rgba(255, 171, 0, 0.1)',
            zIndex: 5
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {activeWarning.severity === 'CRITICAL' ? (
              <ShieldAlert size={20} className="text-red-500 animate-bounce" />
            ) : (
              <AlertTriangle size={18} className="text-amber-400" />
            )}
            <h3 className="font-display" style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: activeWarning.severity === 'CRITICAL' ? '#ff1744' : '#ffab00' }}>
              {activeWarning.severity === 'CRITICAL' ? 'COLLISION HAZARD' : 'TRAFFIC WARNING'}
            </h3>
          </div>

          <p style={{ fontSize: '11px', fontWeight: 600, color: '#f3f4f6', marginBottom: '8px' }}>
            {activeWarning.message}
          </p>

          <div style={{ display: 'flex', gap: '16px', fontFamily: 'monospace', fontSize: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', width: '100%', justifyContent: 'center' }}>
            {activeWarning.distanceToTarget !== undefined && (
              <div>
                <span style={{ color: '#8493a8' }}>DIST: </span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{activeWarning.distanceToTarget}m</span>
              </div>
            )}
            {activeWarning.timeToCollision !== undefined && (
              <div>
                <span style={{ color: '#8493a8' }}>TTC: </span>
                <span style={{ color: activeWarning.timeToCollision < 1.0 ? '#ff1744' : '#fff', fontWeight: 'bold' }}>
                  {activeWarning.timeToCollision}s
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Safe Idle Cockpit State
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', opacity: 0.6 }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #4b586e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', color: '#00e5ff', background: 'rgba(15, 23, 42, 0.3)' }}>
            <Radio size={18} className="animate-pulse" />
          </div>
          <h4 className="font-display" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#8493a8', letterSpacing: '0.05em' }}>
            V2X Target Scanning
          </h4>
          <p style={{ fontSize: '9px', color: '#4b586e', fontFamily: 'monospace', marginTop: '2px' }}>
            Active cellular RTT: <span style={{ color: '#00e5ff' }}>{networkLatency} ms</span>
          </p>
        </div>
      )}

      {/* Decorative Outer HUD Ring Graphic */}
      <div style={{ position: 'absolute', bottom: '-100px', width: '220px', height: '220px', border: '1px solid rgba(75, 88, 110, 0.15)', borderRadius: '50%', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '160px', height: '160px', border: '1px dashed rgba(75, 88, 110, 0.08)', borderRadius: '50%' }} />
      </div>
    </div>
  );
};
