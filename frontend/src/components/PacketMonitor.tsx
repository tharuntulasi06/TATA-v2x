import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Shield } from 'lucide-react';

interface PacketMonitorProps {
  packetCount: number;
}

interface PacketLog {
  id: string;
  time: string;
  type: 'CAM' | 'BSM' | 'SPAT' | 'DENM' | 'SYS';
  sender: string;
  details: string;
}

export const PacketMonitor: React.FC<PacketMonitorProps> = ({ packetCount }) => {
  const [logs, setLogs] = useState<PacketLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

        let sender = 'MEC Edge';
        let details = '';

        if (message.type === 'BSM' || message.type === 'CAM') {
          sender = message.vehicleId || 'vehicle';
          details = `Speed: ${(message.speed * 1.5).toFixed(0)}km/h | brakes: ${message.brakes.brakeApplied ? 'ON' : 'OFF'} | x: ${Math.round(message.position.x)}, y: ${Math.round(message.position.y)}`;
        } else if (message.type === 'SPAT') {
          sender = message.intersectionId || 'RSU';
          details = `Phase: ${message.currentPhase} | Change in: ${message.timeToChange}s | next: ${message.nextPhase}`;
        } else if (message.type === 'DENM') {
          sender = message.vehicleId || 'MEC';
          details = `Event: ${message.eventType} | Severity: ${message.severity} | ${message.description}`;
        } else if (message.type === 'NETWORK_CONFIG_UPDATE') {
          sender = 'MEC Admin';
          details = `Config updated: Latency ${message.config.simulatedLatency}ms | Loss ${message.config.packetDropRate}%`;
        }

        const newLog: PacketLog = {
          id: `${message.type}_${Date.now()}_${Math.random()}`,
          time: timeStr,
          type: message.type,
          sender,
          details
        };

        setLogs((prev) => [...prev.slice(-30), newLog]);
      } catch (err) {
        // ignore malformed
      }
    };

    ws.onopen = () => {
      setLogs((prev) => [
        ...prev,
        {
          id: `SYS_${Date.now()}`,
          time: new Date().toTimeString().split(' ')[0],
          type: 'SYS',
          sender: 'SYSTEM',
          details: 'V2X network logging tap attached.'
        }
      ]);
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getTypeColor = (type: PacketLog['type']) => {
    switch (type) {
      case 'DENM': return 'text-red-400 font-bold';
      case 'SPAT': return 'text-green-400';
      case 'BSM':
      case 'CAM': return 'text-cyan-400';
      case 'SYS': return 'text-purple-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="glass-panel packet-monitor-container" style={{ padding: '16px' }}>
      {/* Header */}
      <div className="flex-between" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginBottom: '12px', flexShrink: 0 }}>
        <div className="flex-align-center flex-gap-2">
          <Terminal className="text-cyan-400" size={15} />
          <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            C-V2X Packet Decryption Monitor
          </h4>
        </div>
        <div className="flex-align-center flex-gap-4" style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4b586e' }}>
          <span className="flex-align-center flex-gap-1">
            <Shield size={10} className="text-cyan-400" />
            J2735 Standard ASN.1
          </span>
          <span>Rx Packets: <strong style={{ color: '#fff' }}>{packetCount}</strong></span>
        </div>
      </div>

      {/* Logger Terminal */}
      <div className="terminal-log-output">
        {logs.map((log) => (
          <div key={log.id} className="log-row">
            <span style={{ color: '#4b586e', flexShrink: 0 }}>{log.time}</span>
            <span className={`uppercase ${getTypeColor(log.type)}`} style={{ flexShrink: 0, padding: '0 4px', borderRadius: '3px', background: '#0b0f19' }}>
              {log.type}
            </span>
            <span style={{ color: '#8493a8', fontWeight: 600, flexShrink: 0 }}>[{log.sender}]:</span>
            <span style={{ color: '#f3f4f6' }}>{log.details}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div style={{ color: '#4b586e', fontStyle: 'italic' }}>No packet telemetry captured...</div>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
