import React, { useState } from 'react';
import { User, ShieldAlert, Cpu, Sparkles, Smartphone, EyeOff } from 'lucide-react';
import { DriverStyle } from '../../../shared/types.js';

interface InfotainmentConsoleProps {
  driverStyle: DriverStyle;
  setDriverStyle: (style: DriverStyle) => void;
  isDistracted: boolean;
  setIsDistracted: (val: boolean) => void;
  simulatedLatency: number;
  packetDropRate: number;
  rsuStatus: any;
  onConfigChange: (latency: number, dropRate: number) => void;
}

export const InfotainmentConsole: React.FC<InfotainmentConsoleProps> = ({
  driverStyle,
  setDriverStyle,
  isDistracted,
  setIsDistracted,
  simulatedLatency,
  packetDropRate,
  rsuStatus,
  onConfigChange,
}) => {
  const [latencyVal, setLatencyVal] = useState<number>(simulatedLatency);
  const [dropVal, setDropVal] = useState<number>(packetDropRate);

  const handleLatencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLatencyVal(val);
    onConfigChange(val, dropVal);
  };

  const handleDropChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setDropVal(val);
    onConfigChange(latencyVal, val);
  };

  const getGlosaAdvisory = () => {
    if (!rsuStatus) return 'Scanning Roadside RSUs...';

    const { currentPhase, timeToChange } = rsuStatus;
    if (currentPhase === 'GREEN') {
      if (timeToChange < 3) return 'Prepare to slow down: light changing soon';
      return `Speed Lock: Cruise at 45 km/h to pass green phase.`;
    }
    if (currentPhase === 'RED') {
      return `Light Red. Coast to stop. Green in ${timeToChange}s.`;
    }
    return 'Slow down: Intersection clearing...';
  };

  return (
    <div className="glass-panel infotainment-container" style={{ padding: '20px' }}>
      {/* Tab Header */}
      <div className="infotainment-header">
        <h3 className="flex-align-center flex-gap-2 font-display" style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: '#fff', letterSpacing: '0.02em' }}>
          <Cpu className="text-cyan-400" size={16} />
          Personalized Cockpit Settings
        </h3>
        <p style={{ fontSize: '10px', color: '#4b586e', fontFamily: 'monospace', marginTop: '2px' }}>
          Local adaptive ADAS engine control
        </p>
      </div>

      {/* Driver Persona Configuration */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label className="console-label">
          <User size={13} className="text-cyan-400" />
          ACTIVE DRIVER PROFILE
        </label>
        <div className="profile-button-grid">
          {(['NOVICE', 'COMMUTER', 'PRO'] as DriverStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => setDriverStyle(style)}
              className={`profile-btn ${driverStyle === style ? 'active' : ''}`}
            >
              {style === 'NOVICE' && '🐣 NOVICE'}
              {style === 'COMMUTER' && '🚗 COMMUTER'}
              {style === 'PRO' && '⚡ RACER PRO'}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '9px', color: '#4b586e', fontFamily: 'monospace', fontStyle: 'italic', marginTop: '2px' }}>
          {driverStyle === 'NOVICE' && '* NOV: Trigger warnings 40% earlier due to delayed response.'}
          {driverStyle === 'COMMUTER' && '* COM: Normal warning parameters. Optimizes infotainment warnings.'}
          {driverStyle === 'PRO' && '* PRO: Suppress early warnings. Focuses strictly on critical alerts.'}
        </p>
      </div>

      {/* Driver Attention / Distraction simulation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label className="console-label">
          <Smartphone size={13} className="text-cyan-400" />
          COGNITIVE DISTRACTION SIMULATOR
        </label>
        <button
          onClick={() => setIsDistracted(!isDistracted)}
          className="profile-btn"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '11px',
            border: isDistracted ? '1px solid rgba(255, 23, 68, 0.3)' : '1px solid var(--panel-border)',
            background: isDistracted ? 'rgba(255, 23, 68, 0.08)' : 'rgba(15, 23, 42, 0.4)',
            color: isDistracted ? '#ff1744' : 'var(--text-muted)'
          }}
        >
          <span className="flex-align-center flex-gap-2">
            <EyeOff size={13} className={isDistracted ? 'text-red-400 animate-pulse' : 'text-slate-400'} />
            Driver Cellphone Interaction
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: '9px', fontWeight: 'bold' }}>
            {isDistracted ? 'DISTRACTED (+60% DELAY)' : 'ATTENTIVE'}
          </span>
        </button>
      </div>

      {/* Network Sim Parameters */}
      <div className="slider-group">
        <label className="console-label">
          <ShieldAlert size={13} className="text-cyan-400" />
          5G C-V2X NET DEGRADATION
        </label>
        
        <div className="slider-row">
          <div className="slider-info">
            <span style={{ color: '#8493a8' }}>MEC Sidelink Delay</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>{latencyVal} ms</span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            step="10"
            value={latencyVal}
            onChange={handleLatencyChange}
            className="custom-range-slider"
          />
        </div>

        <div className="slider-row">
          <div className="slider-info">
            <span style={{ color: '#8493a8' }}>Packet Loss Ratio</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>{dropVal} %</span>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            step="1"
            value={dropVal}
            onChange={handleDropChange}
            className="custom-range-slider"
          />
        </div>
      </div>

      {/* GLOSA (V2I) HUD Panel */}
      <div className="glosa-card">
        <div className="glosa-inner">
          <div className="flex-align-center flex-gap-2" style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-primary)', letterSpacing: '0.05em', fontFamily: 'monospace' }}>
            <Sparkles size={11} />
            GLOSA ADVISORY (V2I)
          </div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px', lineHeight: 1.4 }}>
            {getGlosaAdvisory()}
          </p>
        </div>
      </div>
    </div>
  );
};
