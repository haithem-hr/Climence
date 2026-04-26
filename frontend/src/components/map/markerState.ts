import { DroneState, type AqiBandKey, type DroneState as DroneStateValue } from '@climence/shared';

export interface MarkerStateSensor {
  band: AqiBandKey;
  droneState: DroneStateValue;
  serverTimestamp: string;
}

export function markerFillVar(band: AqiBandKey) {
  return `var(--aqi-${band})`;
}

export function markerStateClass(droneState: DroneStateValue) {
  switch (droneState) {
    case DroneState.OFFLINE:
      return 'is-offline';
    case DroneState.LOW_BATTERY:
      return 'is-low-battery';
    case DroneState.GATHERING_DATA:
      return 'is-gathering-data';
    default:
      return '';
  }
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
  const stateClass = markerStateClass(sensor.droneState);
  if (stateClass) classes.push(stateClass);

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
