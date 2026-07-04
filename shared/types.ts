export interface Position {
  x: number;
  y: number;
}

export type AlertSeverity = 'INFORMATIONAL' | 'WARNING' | 'CRITICAL';

export interface BrakesStatus {
  brakeApplied: boolean;
  absActive: boolean;
  tractionControlActive: boolean;
}

// BSM / CAM: Basic Safety Message / Cooperative Awareness Message
export interface BasicSafetyMessage {
  type: 'CAM' | 'BSM';
  vehicleId: string;
  timestamp: number;
  position: Position;
  speed: number;       // m/s
  heading: number;     // degrees 0-360
  brakes: BrakesStatus;
  size: {
    width: number;
    length: number;
  };
  isPlayer?: boolean;  // Flags if this is the user's vehicle
}

// SPaT: Signal Phase and Timing
export interface SPaTMessage {
  type: 'SPAT';
  intersectionId: string;
  timestamp: number;
  currentPhase: 'RED' | 'YELLOW' | 'GREEN';
  timeToChange: number; // seconds remaining
  nextPhase: 'RED' | 'YELLOW' | 'GREEN';
}

// DENM: Decentralized Environmental Notification Message
export interface DENMessage {
  type: 'DENM';
  eventId: string;
  timestamp: number;
  eventType: 'PEDESTRIAN_IN_ROAD' | 'ROADWORKS' | 'EMERGENCY_VEHICLE' | 'HAZARDOUS_WEATHER' | 'STATIONARY_VEHICLE';
  position: Position;
  radiusOfImpact: number; // relative distance in pixels/meters
  severity: AlertSeverity;
  description: string;
}

export type DriverStyle = 'NOVICE' | 'COMMUTER' | 'PRO';

export interface DriverPersona {
  style: DriverStyle;
  name: string;
  reactionTime: number;      // base reaction time in seconds (e.g. 1.5, 0.8, 0.5)
  warningSensitivity: number; // sensitivity multiplier for alerts
  allowedDistraction: number; // threshold of distraction actions before critical trigger
}

export interface NetworkConfig {
  simulatedLatency: number; // ms
  packetDropRate: number;   // percentage (0-100)
}

export interface SafetyAlert {
  id: string;
  type: 'COLLISION' | 'V2V_BRAKING' | 'SPAT_RED_LIGHT' | 'PEDESTRIAN' | 'EMERGENCY_VEHICLE' | 'DEGRADED_V2X';
  severity: AlertSeverity;
  message: string;
  distanceToTarget?: number; // meters
  timeToCollision?: number;  // seconds
  timestamp: number;
}
