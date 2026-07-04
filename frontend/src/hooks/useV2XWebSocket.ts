import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  BasicSafetyMessage, 
  SPaTMessage, 
  DENMessage, 
  NetworkConfig, 
  Position 
} from '../../../shared/types.js';

interface UseV2XWebSocketOptions {
  vehicleId: string;
  onAlertReceived?: (alert: DENMessage) => void;
}

export function useV2XWebSocket({ vehicleId, onAlertReceived }: UseV2XWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [rsuStatus, setRsuStatus] = useState<SPaTMessage | null>(null);
  const [otherVehicles, setOtherVehicles] = useState<Map<string, BasicSafetyMessage>>(new Map());
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>({ simulatedLatency: 0, packetDropRate: 0 });
  const [actualRTT, setActualRTT] = useState<number>(0);
  const [packetCount, setPacketCount] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any | null>(null);
  const lastPingTimeRef = useRef<number>(0);

  // Store alert callback in mutable ref to prevent websocket reconnections on parent state updates
  const onAlertReceivedRef = useRef(onAlertReceived);
  useEffect(() => {
    onAlertReceivedRef.current = onAlertReceived;
  }, [onAlertReceived]);

  // Initialize socket connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log(`[V2X Link] Connected to MEC edge broker. Registering vehicle: ${vehicleId}`);
      
      // Register OBU on MEC network
      const registerMsg = {
        type: 'REGISTER',
        vehicleId,
        timestamp: Date.now(),
        x: 100, // Initial coordinate offsets
        y: 200
      };
      ws.send(JSON.stringify(registerMsg));
      
      // Periodically measure actual RTT (ping/pong)
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          lastPingTimeRef.current = performance.now();
          ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        }
      }, 2000);
    };

    ws.onmessage = (event) => {
      setPacketCount(prev => prev + 1);
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'REGISTER_ACK':
            if (message.config) setNetworkConfig(message.config);
            if (message.rsuStatus) setRsuStatus(message.rsuStatus);
            break;

          case 'NETWORK_CONFIG_UPDATE':
            if (message.config) {
              setNetworkConfig(message.config);
              console.log(`[MEC Broadcast] Network configuration changed:`, message.config);
            }
            break;

          case 'PING':
            // Pong response from server (ping echo)
            const rtt = performance.now() - lastPingTimeRef.current;
            setActualRTT(Math.round(rtt));
            break;

          case 'CAM':
          case 'BSM':
            if (message.vehicleId && message.vehicleId !== vehicleId) {
              setOtherVehicles(prev => {
                const copy = new Map(prev);
                copy.set(message.vehicleId, message);
                return copy;
              });
            }
            break;

          case 'SPAT':
            setRsuStatus(message);
            break;

          case 'DENM':
            console.log(`[V2X Safety Alert Received]`, message);
            if (onAlertReceivedRef.current) {
              onAlertReceivedRef.current(message);
            }
            break;

          case 'VEHICLE_DISCONNECTED':
            setOtherVehicles(prev => {
              const copy = new Map(prev);
              copy.delete(message.vehicleId);
              return copy;
            });
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket packet:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[V2X Link] Connection error:', err);
    };

    ws.onclose = () => {
      setConnected(false);
      console.warn('[V2X Link] Disconnected from MEC edge.');
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };

    return () => {
      ws.close();
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [vehicleId]);

  // Transmit CAM/BSM (10Hz periodic vehicle beacon)
  const sendCAM = useCallback((position: Position, speed: number, heading: number, brakeApplied: boolean) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const bsmPayload = {
      type: 'BSM',
      vehicleId,
      timestamp: Date.now(),
      position,
      speed,
      heading,
      brakes: {
        brakeApplied,
        absActive: brakeApplied && speed > 10, // simple triggers
        tractionControlActive: false
      },
      size: {
        width: 1.8,
        length: 4.5
      }
    };

    socketRef.current.send(JSON.stringify(bsmPayload));
  }, [vehicleId]);

  // Broadcast event-triggered safety warning (DENM)
  const sendDENM = useCallback((eventType: DENMessage['eventType'], position: Position, severity: DENMessage['severity'], description: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const denmPayload = {
      type: 'DENM',
      eventId: `${vehicleId}_${Date.now()}`,
      vehicleId,
      timestamp: Date.now(),
      eventType,
      position,
      radiusOfImpact: 350, // relative px distance
      severity,
      description
    };

    socketRef.current.send(JSON.stringify(denmPayload));
  }, [vehicleId]);

  return {
    connected,
    rsuStatus,
    otherVehicles,
    networkConfig,
    actualRTT,
    packetCount,
    sendCAM,
    sendDENM
  };
}
