import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { RoadsideUnit } from './rsu.js';
import { logIncident, logTelemetry, getIncidents } from './db.js';
import { NetworkConfig } from '../../shared/types.js';

const PORT_EXPRESS = 8081;
const PORT_WS = 8080;

const app = express();
app.use(cors());
app.use(express.json());

let networkConfig: NetworkConfig = {
  simulatedLatency: 20, // default 20ms
  packetDropRate: 0,    // default 0%
};

// REST API routes
app.get('/api/incidents', (_req, res) => {
  const incidents = getIncidents();
  res.json(incidents);
});

app.post('/api/incidents', (req, res) => {
  const { id, timestamp, eventType, severity, driverStyle, reactionTimeMs, wasCollision, description } = req.body;
  logIncident({ id, timestamp, eventType, severity, driverStyle, reactionTimeMs, wasCollision, description });
  res.json({ success: true });
});

app.get('/api/config', (_req, res) => {
  res.json(networkConfig);
});

app.post('/api/config', (req, res) => {
  const { simulatedLatency, packetDropRate } = req.body;
  if (typeof simulatedLatency === 'number') networkConfig.simulatedLatency = simulatedLatency;
  if (typeof packetDropRate === 'number') networkConfig.packetDropRate = packetDropRate;
  console.log(`[MEC Config Updated] Latency: ${networkConfig.simulatedLatency}ms, Loss: ${networkConfig.packetDropRate}%`);
  
  // Broadcast config update to all connected vehicles
  broadcastToAll({
    type: 'NETWORK_CONFIG_UPDATE',
    config: networkConfig
  });
  
  res.json({ success: true, config: networkConfig });
});

app.listen(PORT_EXPRESS, () => {
  console.log(`[V2X Central Cloud] REST API listening on http://localhost:${PORT_EXPRESS}`);
});

// Setup WebSocket MEC Broker
const wss = new WebSocketServer({ port: PORT_WS }, () => {
  console.log(`[MEC Edge Server] WebSocket Broker running on ws://localhost:${PORT_WS}`);
});

interface ConnectedVehicle {
  ws: WebSocket;
  id: string;
  x: number;
  y: number;
  lastSeen: number;
}

const activeVehicles = new Map<string, ConnectedVehicle>();

// Start Roadside Unit (RSU) at main intersection
const mainRSU = new RoadsideUnit('Intersection_Main', (spatMessage) => {
  broadcastToAll(spatMessage);
});
mainRSU.start();

wss.on('connection', (ws) => {
  let vehicleId: string | null = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Simulate packet drop
      if (networkConfig.packetDropRate > 0) {
        if (Math.random() * 100 < networkConfig.packetDropRate) {
          return; // Drop packet
        }
      }

      // Simulate network latency
      if (networkConfig.simulatedLatency > 0) {
        setTimeout(() => {
          handleIncomingMessage(ws, message);
        }, networkConfig.simulatedLatency);
      } else {
        handleIncomingMessage(ws, message);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (vehicleId) {
      console.log(`[MEC] Vehicle disconnected: ${vehicleId}`);
      activeVehicles.delete(vehicleId);
      // Notify other vehicles
      broadcastToAll({
        type: 'VEHICLE_DISCONNECTED',
        vehicleId
      });
    }
  });

  function handleIncomingMessage(socket: WebSocket, message: any) {
    switch (message.type) {
      case 'REGISTER':
        vehicleId = message.vehicleId;
        activeVehicles.set(vehicleId!, {
          ws: socket,
          id: vehicleId!,
          x: message.x || 0,
          y: message.y || 0,
          lastSeen: Date.now()
        });
        console.log(`[MEC] Vehicle registered: ${vehicleId}`);
        socket.send(JSON.stringify({
          type: 'REGISTER_ACK',
          config: networkConfig,
          rsuStatus: mainRSU.getStatus()
        }));
        break;

      case 'CAM':
      case 'BSM':
        if (message.vehicleId) {
          const vId = message.vehicleId;
          vehicleId = vId;
          const vehicle = activeVehicles.get(vId);
          if (vehicle) {
            vehicle.x = message.position.x;
            vehicle.y = message.position.y;
            vehicle.lastSeen = Date.now();
          } else {
            activeVehicles.set(vId, {
              ws: socket,
              id: vId,
              x: message.position.x,
              y: message.position.y,
              lastSeen: Date.now()
            });
          }

          // Log player/vehicle updates to sqlite telemetry table
          logTelemetry({
            timestamp: message.timestamp,
            vehicleId: vId,
            speed: message.speed,
            x: message.position.x,
            y: message.position.y,
            brakeApplied: message.brakes.brakeApplied
          });

          // Spatial Routing: Broadcast positions only to vehicles within 350px range
          broadcastToRange(message, vId, 350);
        }
        break;

      case 'DENM':
        // Broadcast safety alert immediately to nearby vehicles
        broadcastToRange(message, message.vehicleId, message.radiusOfImpact || 350);
        break;

      default:
        break;
    }
  }
});

// Broadcasts messages to all connected vehicles
function broadcastToAll(message: any) {
  const payload = JSON.stringify(message);
  activeVehicles.forEach((vehicle) => {
    if (vehicle.ws.readyState === WebSocket.OPEN) {
      vehicle.ws.send(payload);
    }
  });
}

// Geocasting: Broadcast message only to vehicles within range
function broadcastToRange(message: any, senderId: string | undefined, maxRange: number) {
  if (!senderId) {
    broadcastToAll(message);
    return;
  }

  const sender = activeVehicles.get(senderId);
  if (!sender) return;

  const payload = JSON.stringify(message);

  activeVehicles.forEach((recipient) => {
    if (recipient.id === senderId) return;

    const distance = Math.hypot(recipient.x - sender.x, recipient.y - sender.y);
    if (distance <= maxRange) {
      if (recipient.ws.readyState === WebSocket.OPEN) {
        recipient.ws.send(payload);
      }
    }
  });
}

// Stale connection cleanup
setInterval(() => {
  const now = Date.now();
  activeVehicles.forEach((vehicle, id) => {
    if (now - vehicle.lastSeen > 8000) {
      console.log(`[MEC] Cleaning up stale vehicle: ${id}`);
      vehicle.ws.close();
      activeVehicles.delete(id);
      broadcastToAll({
        type: 'VEHICLE_DISCONNECTED',
        vehicleId: id
      });
    }
  });
}, 4000);
