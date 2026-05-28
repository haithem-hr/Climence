import { useEffect, useMemo } from 'react';
import { divIcon } from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { RIYADH_BOUNDS, RIYADH_CENTER, type AqiBandKey, type DroneState } from '@climence/shared';
import '../../lib/leaflet-icons';
import { HeatmapLayer, type HeatmapPoint } from './HeatmapLayer';
import { buildSensorMarkerHtml, describeDroneState } from './markerState';
import { useOpenMeteoAirQuality } from '../../hooks/useOpenMeteoAirQuality';

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
  co2: number;
  no2: number;
  temperature: number;
  humidity: number;
  battery: number;
  band: AqiBandKey;
  droneState: DroneState;
  status: 'online' | 'offline';
  serverTimestamp: string;
}

export interface RiyadhMapCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  radiusMeters: number;
  avgPm25: number;
  maxPm25: number;
  minBattery: number;
}

interface Props {
  mode: RiyadhMapMode;
  sensors: RiyadhMapSensor[];
  hotspots?: RiyadhMapHotspot[];
  clusters?: RiyadhMapCluster[];
  heatmapPoints?: HeatmapPoint[];
  zoomPreset?: RiyadhZoomPreset;
  focusTarget?: { lat: number; lng: number; zoom?: number; nonce: number; uuid?: string } | null;
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
  clusters = [],
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

        {clusters.map(cluster => {
          const severityBand: AqiBandKey =
            cluster.maxPm25 >= 150
              ? 'haz'
              : cluster.maxPm25 >= 110
                ? 'unh'
                : cluster.maxPm25 >= 75
                  ? 'usg'
                  : 'mod';
          const clusterColor = BAND_COLOR[severityBand];

          return (
            <Circle
              key={`cluster-area-${cluster.id}`}
              center={[cluster.lat, cluster.lng]}
              radius={Math.max(300, cluster.radiusMeters)}
              pathOptions={{
                color: clusterColor,
                fillColor: clusterColor,
                fillOpacity: 0.09,
                weight: 1.5,
                opacity: 0.58,
                dashArray: '5 6',
              }}
            >
              <Popup>
                <strong>Cluster · {cluster.count} sensors</strong>
                <div>Avg PM2.5 {cluster.avgPm25.toFixed(1)}</div>
                <div>Peak PM2.5 {cluster.maxPm25.toFixed(1)}</div>
                <div>Min battery {Math.round(cluster.minBattery)}%</div>
              </Popup>
            </Circle>
          );
        })}

        {clusters.map(cluster => (
          <Marker
            key={`cluster-count-${cluster.id}`}
            position={[cluster.lat, cluster.lng]}
            icon={divIcon({
              className: 'map-cluster-icon-wrap',
              html: `<div class="map-cluster-marker"><span class="map-cluster-count">${cluster.count}</span></div>`,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            })}
            zIndexOffset={900 + cluster.count}
          >
            <Popup>
              <strong>Cluster · {cluster.count} sensors</strong>
              <div>Avg PM2.5 {cluster.avgPm25.toFixed(1)}</div>
              <div>Peak PM2.5 {cluster.maxPm25.toFixed(1)}</div>
            </Popup>
          </Marker>
        ))}

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
              ref={(ref) => {
                if (ref && focusTarget?.uuid === sensor.uuid) {
                  // Only open if not already open to prevent infinite re-rendering loops
                  if (!ref.isPopupOpen()) {
                    ref.openPopup();
                  }
                }
              }}
            >
              <Tooltip className="map-sensor-tooltip" direction="top" offset={[0, -14]} opacity={1}>
                <div className="map-sensor-tooltip-title">{sensor.label}</div>
                <div className="map-sensor-tooltip-meta">{describeDroneState(sensor)}</div>
              </Tooltip>
              <Popup>
                <SensorPopupContent sensor={sensor} />
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

function SensorPopupContent({ sensor }: { sensor: RiyadhMapSensor }) {
  const { data: omData } = useOpenMeteoAirQuality(sensor.lat, sensor.lng);

  return (
    <div style={{ minWidth: 200 }}>
      <strong style={{ fontSize: 14 }}>{sensor.label}</strong>
      <div style={{ marginTop: 4, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontWeight: 600 }}>AQI {Math.round(sensor.aqi)} · PM2.5 {sensor.pm25.toFixed(1)} µg/m³</div>
        <div style={{ color: 'var(--ink-3)' }}>{describeDroneState(sensor)}</div>
      </div>

      {omData?.current ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
          <div>PM10: {omData.current.pm10}</div>
          <div>O3: {omData.current.ozone}</div>
          <div>SO2: {omData.current.sulphur_dioxide}</div>
          <div>Dust: {omData.current.dust}</div>
          <div>NO2: {omData.current.nitrogen_dioxide}</div>
          <div>CO: {omData.current.carbon_monoxide}</div>
          <div>UV: {omData.current.uv_index}</div>
          <div>EU AQI: {omData.current.european_aqi}</div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Loading atmospheric data...</div>
      )}
    </div>
  );
}
