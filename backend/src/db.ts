import Database from 'better-sqlite3';
import path from 'path';

// Store the SQLite DB in the root directory for persistent user access
const dbPath = path.resolve(process.cwd(), '../v2x_blackbox.db');
const db = new Database(dbPath);

// Initialize schemas
db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    driver_style TEXT NOT NULL,
    reaction_time_ms REAL,
    was_collision INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS telemetry_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    vehicle_id TEXT NOT NULL,
    speed REAL NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    brake_applied INTEGER NOT NULL
  );
`);

export function logIncident(incident: {
  id: string;
  timestamp: number;
  eventType: string;
  severity: string;
  driverStyle: string;
  reactionTimeMs?: number;
  wasCollision: boolean;
  description: string;
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO incidents (id, timestamp, event_type, severity, driver_style, reaction_time_ms, was_collision, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      incident.id,
      incident.timestamp,
      incident.eventType,
      incident.severity,
      incident.driverStyle,
      incident.reactionTimeMs !== undefined ? incident.reactionTimeMs : null,
      incident.wasCollision ? 1 : 0,
      incident.description
    );
  } catch (error) {
    console.error('Failed to log incident in SQLite:', error);
  }
}

export function getIncidents() {
  try {
    const stmt = db.prepare(`SELECT * FROM incidents ORDER BY timestamp DESC LIMIT 30`);
    return stmt.all();
  } catch (error) {
    console.error('Failed to query incidents:', error);
    return [];
  }
}

export function logTelemetry(telemetry: {
  timestamp: number;
  vehicleId: string;
  speed: number;
  x: number;
  y: number;
  brakeApplied: boolean;
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO telemetry_logs (timestamp, vehicle_id, speed, x, y, brake_applied)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      telemetry.timestamp,
      telemetry.vehicleId,
      telemetry.speed,
      telemetry.x,
      telemetry.y,
      telemetry.brakeApplied ? 1 : 0
    );
  } catch (error) {
    console.error('Failed to log telemetry:', error);
  }
}
