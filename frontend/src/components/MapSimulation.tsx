import React, { useEffect, useRef, useState } from 'react';
import { User, AlertCircle, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import { BasicSafetyMessage, Position } from '../../../shared/types.js';

interface MapSimulationProps {
  connected: boolean;
  otherVehicles: Map<string, BasicSafetyMessage>;
  rsuStatus: any;
  sendCAM: (pos: Position, speed: number, heading: number, brakeApplied: boolean) => void;
  sendDENM: (type: any, pos: Position, severity: any, desc: string) => void;
  driverStyle: string;
  isDistracted: boolean;
  onHUDWarning: (alert: any) => void;
}

export const MapSimulation: React.FC<MapSimulationProps> = ({
  connected,
  otherVehicles,
  rsuStatus,
  sendCAM,
  sendDENM,
  driverStyle,
  isDistracted,
  onHUDWarning,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // References for map markers
  const playerMarkerRef = useRef<L.Marker | null>(null);
  const leadMarkerRef = useRef<L.Marker | null>(null);
  const pedMarkerRef = useRef<L.Marker | null>(null);
  const rsuMarkerRef = useRef<L.Marker | null>(null);
  const otherMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  // References for callbacks to prevent stale closures in the physics loop
  const sendCAMRef = useRef(sendCAM);
  const sendDENMRef = useRef(sendDENM);
  const onHUDWarningRef = useRef(onHUDWarning);

  useEffect(() => {
    sendCAMRef.current = sendCAM;
    sendDENMRef.current = sendDENM;
    onHUDWarningRef.current = onHUDWarning;
  }, [sendCAM, sendDENM, onHUDWarning]);

  // Player Vehicle Simulation State
  const [playerPos, setPlayerPos] = useState<Position>({ x: 50, y: 150 });
  const [playerSpeed, setPlayerSpeed] = useState<number>(30); // px/sec
  const [isBraking, setIsBraking] = useState<boolean>(false);
  const [isAutoDrive, setIsAutoDrive] = useState<boolean>(true);

  // Leading Vehicle State
  const [leadPos, setLeadPos] = useState<Position>({ x: 220, y: 150 });
  const [leadSpeed, setLeadSpeed] = useState<number>(30);
  const [leadBraking, setLeadBraking] = useState<boolean>(false);

  // Pedestrian State
  const [pedPos, setPedPos] = useState<Position | null>(null);
  const [pedActive, setPedActive] = useState<boolean>(false);

  // Coordinates translation: Canvas coordinate space -> San Francisco coordinates
  const getLatLngFromCoords = (x: number, y: number): [number, number] => {
    // Market Street diagonal path in San Francisco:
    // Start (x=0): Market & 5th St [37.7849, -122.4070]
    // Center (x=250): Market & 4th St [37.7858, -122.4057]
    // End (x=500): Market & 3rd St [37.7867, -122.4044]
    const startLat = 37.7849;
    const startLng = -122.4070;
    const endLat = 37.7867;
    const endLng = -122.4044;

    const t = x / 500;
    const lat = startLat + (endLat - startLat) * t;
    const lng = startLng + (endLng - startLng) * t;

    // Perpendicular vector for lateral offsets (e.g., pedestrian crossing the road)
    const dy = endLat - startLat;
    const dx = endLng - startLng;
    const len = Math.hypot(dx, dy);
    const px = -dy / len;
    const py = dx / len;

    // Corrected lateral offset scaling: 1px = 0.000008 degrees (matches road width)
    const offset = (150 - y) * 0.000008;

    return [lat + py * offset, lng + px * offset];
  };

  // Keyboard hooks override
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowDown') {
        setIsBraking(true);
        setIsAutoDrive(false);
      }
      if (e.key === 'ArrowUp') {
        setIsBraking(false);
        setIsAutoDrive(false);
        setPlayerSpeed(prev => Math.min(prev + 5, 80));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowDown') {
        setIsBraking(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center exactly on Market St / 4th St SF intersection
    const map = L.map(mapContainerRef.current, {
      center: [37.7858, -122.4057],
      zoom: 18,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    });
    mapRef.current = map;

    // Add OpenStreetMap tile layer (CSS filters style it as dark mode)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Initialize RSU Traffic Signal Light Marker (glowing traffic light symbol at intersection)
    rsuMarkerRef.current = L.marker([37.7858, -122.4057], {
      icon: L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="v2x-symbol rsu-light GREEN">🚦</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
    }).addTo(map).bindPopup('RSU Intersection Controller: Intersection_Main');

    // Initialize Player marker (cyan car symbol)
    const playerLatLng = getLatLngFromCoords(50, 150);
    playerMarkerRef.current = L.marker(playerLatLng, {
      icon: L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="v2x-symbol player-car">🚗</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    }).addTo(map).bindPopup('Player OBU: OBU_PLAYER_01');

    // Initialize Leading vehicle marker (blue car symbol)
    const leadLatLng = getLatLngFromCoords(220, 150);
    leadMarkerRef.current = L.marker(leadLatLng, {
      icon: L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="v2x-symbol lead-car">🚙</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
    }).addTo(map).bindPopup('Leading Vehicle OBU: OBU_MOCK_LEAD');

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Main Loop logic (Physics, warning evaluations, marker updates)
  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      // 1. Update Physics
      let currentBraking = isBraking;
      
      // Auto-drive safety control override
      if (isAutoDrive) {
        const distanceToLead = leadPos.x - playerPos.x;
        if (leadBraking && distanceToLead < 90 && distanceToLead > 0) {
          currentBraking = true;
        } else if (pedActive && pedPos && pedPos.y > 110 && pedPos.y < 190 && playerPos.x < 240 && playerPos.x > 140) {
          currentBraking = true;
        } else if (rsuStatus && rsuStatus.currentPhase === 'RED' && playerPos.x > 150 && playerPos.x < 225) {
          currentBraking = true;
        } else {
          currentBraking = false;
        }
      }

      // Speed transition
      let speed = playerSpeed;
      if (currentBraking) {
        speed = Math.max(0, speed - 1.5);
      } else if (isAutoDrive && speed < 30) {
        speed = Math.min(30, speed + 0.5);
      }
      setPlayerSpeed(speed);

      // Move player position
      let nextPlayerX = playerPos.x + (speed * 0.016);
      if (nextPlayerX > 520) {
        nextPlayerX = -20;
        setLeadPos({ x: 180, y: 150 });
        setLeadBraking(false);
        setLeadSpeed(30);
      }
      const nextPlayerPos = { x: nextPlayerX, y: playerPos.y };
      setPlayerPos(nextPlayerPos);

      // Move leading car
      let lSpeed = leadSpeed;
      if (leadBraking) {
        lSpeed = Math.max(0, lSpeed - 1.8);
      } else if (lSpeed < 30) {
        lSpeed = Math.min(30, lSpeed + 0.3);
      }
      setLeadSpeed(lSpeed);

      let nextLeadX = leadPos.x + (lSpeed * 0.016);
      if (nextLeadX > 520) nextLeadX = 150;
      setLeadPos({ x: nextLeadX, y: leadPos.y });

      // Move Pedestrian
      if (pedActive && pedPos) {
        let nextY = pedPos.y + 0.3;
        if (nextY > 240) {
          setPedActive(false);
          setPedPos(null);
        } else {
          setPedPos({ x: pedPos.x, y: nextY });
        }
      }

      // 2. Broadcast Player telemetry at 10Hz
      if (connected) {
        sendCAMRef.current(nextPlayerPos, speed, 90, currentBraking);
      }

      // 3. V2X Safety Threat Calculations (TTC)
      evaluateV2XAlerts(nextPlayerPos, speed, currentBraking);

      // 4. Update Leaflet Map Markers dynamically
      updateMapMarkers(nextPlayerPos, currentBraking);
      
      animationFrameId = requestAnimationFrame(tick);
    };

    const evaluateV2XAlerts = (pos: Position, speed: number, playerBraking: boolean) => {
      if (speed <= 0) {
        onHUDWarningRef.current(null);
        return;
      }

      let reactionFactor = 1.0;
      if (driverStyle === 'NOVICE') reactionFactor = 1.4;
      if (driverStyle === 'PRO') reactionFactor = 0.7;
      if (isDistracted) reactionFactor *= 1.6;

      const safeTimeSeconds = 2.5 * reactionFactor;

      // Warning A: Sudden Braking (V2V)
      const distanceToLead = leadPos.x - pos.x;
      if (leadBraking && distanceToLead > 0 && distanceToLead < 140) {
        const relativeSpeed = Math.max(1, speed - leadSpeed);
        const ttc = distanceToLead / relativeSpeed;
        
        if (ttc < safeTimeSeconds) {
          onHUDWarningRef.current({
            id: 'V2V_COLLISION',
            type: 'COLLISION',
            severity: ttc < 1.2 ? 'CRITICAL' : 'WARNING',
            message: 'VEHICLE AHEAD BRAKING CRITICALLY! (V2V ALERT)',
            distanceToTarget: Math.round(distanceToLead),
            timeToCollision: parseFloat(ttc.toFixed(1)),
            timestamp: Date.now()
          });
          return;
        }
      }

      // Warning B: Pedestrian Crossing (V2P)
      if (pedActive && pedPos) {
        const distToPed = pedPos.x - pos.x;
        if (distToPed > 0 && distToPed < 110 && pedPos.y > 120 && pedPos.y < 180) {
          const ttc = distToPed / speed;
          if (ttc < safeTimeSeconds) {
            onHUDWarningRef.current({
              id: 'V2P_CROSSING',
              type: 'PEDESTRIAN',
              severity: ttc < 1.2 ? 'CRITICAL' : 'WARNING',
              message: 'PEDESTRIAN DETECTED IN CROSSWALK! (V2P ALERT)',
              distanceToTarget: Math.round(distToPed),
              timeToCollision: parseFloat(ttc.toFixed(1)),
              timestamp: Date.now()
            });
            return;
          }
        }
      }

      // Warning C: RSU Traffic Signal Red Light (V2I)
      if (rsuStatus && rsuStatus.currentPhase === 'RED') {
        const intersectionX = 250;
        const distToIntersection = intersectionX - pos.x;
        
        if (distToIntersection > 10 && distToIntersection < 120) {
          const ttc = distToIntersection / speed;
          if (ttc < safeTimeSeconds && !playerBraking) {
            onHUDWarningRef.current({
              id: 'V2I_RED_LIGHT',
              type: 'SPAT_RED_LIGHT',
              severity: 'WARNING',
              message: 'RED LIGHT PHASE AHEAD (V2I SPaT ALERT)',
              distanceToTarget: Math.round(distToIntersection),
              timeToCollision: parseFloat(ttc.toFixed(1)),
              timestamp: Date.now()
            });
            return;
          }
        }
      }

      onHUDWarningRef.current(null);
    };

    const updateMapMarkers = (pPos: Position, pBraking: boolean) => {
      // Update Player position
      if (playerMarkerRef.current) {
        const latlng = getLatLngFromCoords(pPos.x, pPos.y);
        playerMarkerRef.current.setLatLng(latlng);
        playerMarkerRef.current.setIcon(
          L.divIcon({
            className: 'custom-leaflet-marker',
            html: `<div class="v2x-symbol player-car ${pBraking ? 'braking' : ''}">🚗</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        );
      }

      // Update Leading vehicle position
      if (leadMarkerRef.current) {
        const latlng = getLatLngFromCoords(leadPos.x, leadPos.y);
        leadMarkerRef.current.setLatLng(latlng);
        leadMarkerRef.current.setIcon(
          L.divIcon({
            className: 'custom-leaflet-marker',
            html: `<div class="v2x-symbol lead-car ${leadBraking ? 'braking' : ''}">🚙</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        );
      }

      // Update RSU Light Phase color
      if (rsuMarkerRef.current && rsuStatus) {
        rsuMarkerRef.current.setIcon(
          L.divIcon({
            className: 'custom-leaflet-marker',
            html: `<div class="v2x-symbol rsu-light ${rsuStatus.currentPhase}">🚦</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        );
      }

      // Update Pedestrian position
      if (pedMarkerRef.current) {
        if (pedActive && pedPos) {
          const latlng = getLatLngFromCoords(pedPos.x, pedPos.y);
          pedMarkerRef.current.setLatLng(latlng);
          const elem = pedMarkerRef.current.getElement();
          if (elem) elem.style.display = 'block';
        } else {
          const elem = pedMarkerRef.current.getElement();
          if (elem) elem.style.display = 'none';
        }
      } else if (pedActive && pedPos && mapRef.current) {
        const latlng = getLatLngFromCoords(pedPos.x, pedPos.y);
        pedMarkerRef.current = L.marker(latlng, {
          icon: L.divIcon({
            className: 'custom-leaflet-marker',
            html: `<div class="v2x-symbol pedestrian-marker">🚶</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        }).addTo(mapRef.current);
      }

      // Sync other connected vehicles markers
      otherVehicles.forEach((veh, id) => {
        const marker = otherMarkersRef.current.get(id);
        const latlng = getLatLngFromCoords(veh.position.x, veh.position.y);
        if (marker) {
          marker.setLatLng(latlng);
        } else if (mapRef.current) {
          const newMarker = L.marker(latlng, {
            icon: L.divIcon({
              className: 'custom-leaflet-marker',
              html: `<div class="v2x-symbol remote-car">🚗</div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            })
          }).addTo(mapRef.current).bindPopup(`Remote vehicle: ${id}`);
          otherMarkersRef.current.set(id, newMarker);
        }
      });

      // Cleanup disconnected markers
      otherMarkersRef.current.forEach((marker, id) => {
        if (!otherVehicles.has(id)) {
          marker.remove();
          otherMarkersRef.current.delete(id);
        }
      });
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [playerPos, playerSpeed, isBraking, leadPos, leadSpeed, leadBraking, pedPos, pedActive, connected, rsuStatus, otherVehicles, isAutoDrive, driverStyle, isDistracted]);

  const triggerLeadBrake = () => {
    setLeadBraking(true);
    sendDENM(
      'STATIONARY_VEHICLE',
      leadPos,
      'CRITICAL',
      'ALERT: Preceding vehicle activated emergency electronic brake lights!'
    );
  };

  const triggerPedestrian = () => {
    if (pedActive) return;
    setPedActive(true);
    setPedPos({ x: 250, y: 70 }); // Crossing center crosswalk on market
    sendDENM(
      'PEDESTRIAN_IN_ROAD',
      { x: 250, y: 150 },
      'WARNING',
      'V2P warning: Pedestrian detected walking in intersection.'
    );
  };

  const resetSimulation = () => {
    setPlayerPos({ x: 50, y: 150 });
    setPlayerSpeed(30);
    setIsBraking(false);
    setIsAutoDrive(true);
    setLeadPos({ x: 220, y: 150 });
    setLeadSpeed(30);
    setLeadBraking(false);
    setPedActive(false);
    setPedPos(null);
    onHUDWarningRef.current(null);
  };

  return (
    <div className="map-simulation-container">
      {/* OpenStreetMap Mount Div */}
      <div ref={mapContainerRef} id="v2x-map" />

      {/* Network Sidelink Status Label */}
      <div className="map-status-overlay glass-panel">
        <span className={`dot-status ${connected ? 'active' : 'inactive'}`}></span>
        {connected ? '5G C-V2X ACTIVE' : 'V2X TRANSCEIVER OFFLINE'}
      </div>

      {/* Simulation triggers */}
      <div className="map-action-triggers">
        <button onClick={triggerLeadBrake} className="btn-danger">
          <AlertCircle size={13} />
          Trigger V2V Brake
        </button>
        <button onClick={triggerPedestrian} className="btn-warning">
          <User size={13} />
          Spawn Pedestrian
        </button>
      </div>

      {/* Map simulation controls overlay in main grid structure */}
      <div className="map-controls-footer glass-panel">
        <div className="flex-align-center flex-gap-3">
          <button
            onClick={() => setIsAutoDrive(prev => !prev)}
            className="btn-primary"
          >
            {isAutoDrive ? 'Autopilot: ON' : 'Manual Mode'}
          </button>
          
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#8493a8' }}>
            Speed: <span style={{ color: '#fff', fontWeight: 'bold' }}>{(playerSpeed * 1.5).toFixed(0)} km/h</span> | 
            Throttle: <span className={isBraking ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>{isBraking ? ' BRAKING' : ' CRUISING'}</span>
          </div>
        </div>

        <button onClick={resetSimulation} className="btn-secondary">
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
};
