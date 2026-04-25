import { useEffect, useMemo } from 'react';
import { divIcon } from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { RIYADH_BOUNDS, RIYADH_CENTER, type AqiBandKey, type DroneState } from '@climence/shared';
import '../../lib/leaflet-icons';
import { HeatmapLayer, type HeatmapPoint } from './HeatmapLayer';
import { buildSensorMarkerHtml, describeDroneState } from './markerState';

export type RiyadhMapMode = 'hardware' | 'heatmap';
export type RiyadhZoomPreset = 'city' | 'sector' | 'zone';

export interface RiyadhMapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface RiyadhMapHotspot {
  id: string;
  lat: number;
  lng: number;
  aqi: number;
  band: AqiBandKey;
  radiusKm?: number;
  label?: string;
  valueLabel?: string;
}

export interface RiyadhMapSensor {
  uuid: string;
  label: string;
  lat: number;
  lng: number;
  aqi: number;
  pm25: number;
  battery: number;
  band: AqiBandKey;
  droneState: DroneState;
  status: 'online' | 'offline';
  serverTimestamp: string;
}

interface Props {
  mode: RiyadhMapMode;
  sensors: RiyadhMapSensor[];
  hotspots?: RiyadhMapHotspot[];
  heatmapPoints?: HeatmapPoint[];
  zoomPreset?: RiyadhZoomPreset;
  focusTarget?: { lat: number; lng: number; zoom?: number; nonce: number } | null;
  onViewportChange?: (viewport: { bounds: RiyadhMapBounds; zoom: number }) => void;
  onPickSensor: (sensor: RiyadhMapSensor) => void;
}

const BAND_COLOR: Record<AqiBandKey, string> = {
  good: '#2f9f6b',
  mod: '#c8a93f',
  usg: '#d1873f',
  unh: '#cf5f4a',
  vunh: '#8b5ea5',
  haz: '#7f3c2f',
};

const PRESET_ZOOM: Record<RiyadhZoomPreset, number> = {
  city: 11,
  sector: 12,
  zone: 14,
};

function ViewportReporter({ onViewportChange }: Pick<Props, 'onViewportChange'>) {
  const map = useMapEvents({
    moveend: emitViewport,
    zoomend: emitViewport,
  });

  function emitViewport() {
    if (!onViewportChange) return;
    const bounds = map.getBounds();
    onViewportChange({
      zoom: map.getZoom(),
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
    });
  }

  useEffect(() => {
    emitViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onViewportChange]);

  return null;
}

function ViewController({ zoomPreset = 'city', focusTarget }: Pick<Props, 'zoomPreset' | 'focusTarget'>) {
  const map = useMap();

  useEffect(() => {
    map.setZoom(PRESET_ZOOM[zoomPreset]);
  }, [map, zoomPreset]);

  useEffect(() => {
    if (!focusTarget) return;
    map.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom ?? 14, {
      animate: true,
      duration: 0.55,
    });
  }, [focusTarget, map]);

  return null;
}

export function RiyadhGoogleMap({
  mode,
  sensors,
  hotspots = [],
  heatmapPoints = [],
  zoomPreset = 'city',
  focusTarget = null,
  onViewportChange,
  onPickSensor,
}: Props) {
  const sortedSensors = useMemo(
    () => [...sensors].sort((a, b) => (b.aqi - aqiFallback(b)) - (a.aqi - aqiFallback(a))),
    [sensors],
  );
  const sensorIcons = useMemo(
    () =>
      new Map(
        sortedSensors.map(sensor => [
          sensor.uuid,
          divIcon({
            className: 'map-sensor-icon-wrap',
            html: buildSensorMarkerHtml(sensor),
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -14],
            tooltipAnchor: [0, -14],
          }),
        ]),
      ),
    [sortedSensors],
  );

  return (
    <div className="map">
      <MapContainer
        className="map-canvas"
        center={[RIYADH_CENTER.lat, RIYADH_CENTER.lng]}
        zoom={PRESET_ZOOM[zoomPreset]}
        minZoom={10}
        maxZoom={14}
        zoomControl={false}
        attributionControl={true}
        maxBounds={[
          [RIYADH_BOUNDS.minLat, RIYADH_BOUNDS.minLng],
          [RIYADH_BOUNDS.maxLat, RIYADH_BOUNDS.maxLng],
        ]}
        maxBoundsViscosity={0.85}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <ViewportReporter onViewportChange={onViewportChange} />
        <ViewController zoomPreset={zoomPreset} focusTarget={focusTarget} />
        {mode === 'heatmap' && heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}

        {hotspots.map(hotspot => {
          const hotspotColor = BAND_COLOR[hotspot.band];
          return (
            <Circle
              key={hotspot.id}
              center={[hotspot.lat, hotspot.lng]}
              radius={Math.max(500, (hotspot.radiusKm ?? 0.5) * 1000)}
              pathOptions={{
                color: hotspotColor,
                fillColor: hotspotColor,
                fillOpacity: 0.08,
                weight: 1.2,
                opacity: 0.46,
              }}
            >
              <Popup>
                <strong>{hotspot.label ?? hotspot.id}</strong>
                <div>{hotspot.valueLabel ?? `AQI ${Math.round(hotspot.aqi)}`}</div>
              </Popup>
            </Circle>
          );
        })}

        {sortedSensors.map(sensor => {
          const icon = sensorIcons.get(sensor.uuid);
          if (!icon) return null;

          return (
            <Marker
              key={sensor.uuid}
              position={[sensor.lat, sensor.lng]}
              icon={icon}
              zIndexOffset={sensor.status === 'offline' ? 0 : sensor.aqi}
              eventHandlers={{ click: () => onPickSensor(sensor) }}
            >
              <Tooltip className="map-sensor-tooltip" direction="top" offset={[0, -14]} opacity={1}>
                <div className="map-sensor-tooltip-title">{sensor.label}</div>
                <div className="map-sensor-tooltip-meta">{describeDroneState(sensor)}</div>
              </Tooltip>
              <Popup>
                <strong>{sensor.label}</strong>
                <div>
                  AQI {Math.round(sensor.aqi)} · PM2.5 {sensor.pm25.toFixed(1)}
                </div>
                <div>{describeDroneState(sensor)}</div>
              </Popup>
            </Marker>
          );
        })}

      </MapContainer>
    </div>
  );
}

function aqiFallback(sensor: RiyadhMapSensor) {
  return sensor.status === 'offline' ? 30 : 0;
}
