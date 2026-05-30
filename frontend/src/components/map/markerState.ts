import { DroneState, type AqiBandKey, type DroneState as DroneStateValue } from '@climence/shared';

export interface MarkerStateSensor {
  band: AqiBandKey;
  droneState: DroneStateValue;
  serverTimestamp: string;
  status?: 'offline' | 'mission' | 'idle';
}

export function markerFillVar(band: AqiBandKey) {
  return `var(--aqi-${band})`;
}

export function markerStateClass(droneState: DroneStateValue, status?: 'offline' | 'mission' | 'idle') {
  const classes: string[] = [];
  if (droneState === DroneState.OFFLINE || status === 'offline') {
    classes.push('is-status-offline');
  } else if (status === 'mission') {
    classes.push('is-status-mission');
  } else if (status === 'idle') {
    classes.push('is-status-idle');
  }

  if (droneState === DroneState.LOW_BATTERY) {
    classes.push('is-low-battery');
  }
  if (droneState === DroneState.GATHERING_DATA) {
    classes.push('is-gathering-data');
  }
  return classes.join(' ');
}

export function describeDroneState({ droneState, serverTimestamp }: Pick<MarkerStateSensor, 'droneState' | 'serverTimestamp'>) {
  switch (droneState) {
    case DroneState.OFFLINE:
      return `Offline since ${serverTimestamp || '--'}`;
    case DroneState.LOW_BATTERY:
      return 'Low battery';
    case DroneState.GATHERING_DATA:
      return 'Gathering data';
    case DroneState.EN_ROUTE:
      return 'En route';
    case DroneState.INVESTIGATING_HAZARD:
      return 'Investigating hazard';
    case DroneState.IDLE:
      return 'Idle';
    default:
      return droneState;
  }
}

export function buildSensorMarkerHtml(sensor: MarkerStateSensor) {
  const classes = ['map-sensor-marker'];
  const stateClass = markerStateClass(sensor.droneState, sensor.status);
  if (stateClass) {
    classes.push(stateClass);
  }

  const batteryOverlay =
    sensor.droneState === DroneState.LOW_BATTERY
      ? `
        <span class="map-sensor-battery" aria-hidden="true">
          <span class="map-sensor-battery-cell"></span>
          <span class="map-sensor-battery-tip"></span>
        </span>
      `
      : '';

  return `
    <div class="${classes.join(' ')}" style="--marker-fill: ${markerFillVar(sensor.band)};">
      <span class="map-sensor-core"></span>
      <span class="map-sensor-ring"></span>
      ${batteryOverlay}
    </div>
  `;
}
