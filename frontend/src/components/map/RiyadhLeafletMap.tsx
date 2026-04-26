import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { RIYADH_CENTER, type AqiBandKey, type HotspotCluster } from '@climence/shared';

// Let's redefine types here to decouple from Google Maps file
export type LeafletMapMode = 'hardware' | 'heatmap' | 'normal';

export interface LeafletMapSensor {
  id: string;
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
  status: 'online' | 'offline';
}

interface Props {
  mode: LeafletMapMode;
  sensors: LeafletMapSensor[];
  clusters: HotspotCluster[];
  onPickSensor: (sensor: LeafletMapSensor) => void;
}

const BAND_COLOR: Record<AqiBandKey, string> = {
  good: '#2f9f6b',
  mod: '#c8a93f',
  usg: '#d1873f',
  unh: '#cf5f4a',
  vunh: '#8b5ea5',
  haz: '#7f3c2f',
};

// Component to handle heatmap layer
function HeatmapLayer({ sensors }: { sensors: LeafletMapSensor[] }) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;
    
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    const points = sensors.map(s => [s.lat, s.lng, Math.min(1.0, s.aqi / 200)]); // [lat, lng, intensity]
    
    heatLayerRef.current = (L as any).heatLayer(points, {
      radius: 40,
      blur: 25,
      maxZoom: 14,
      gradient: {
        0.2: '#2f9f6b',
        0.4: '#c8a93f',
        0.6: '#d1873f',
        0.8: '#cf5f4a',
        1.0: '#8b5ea5'
      }
    }).addTo(map);

    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, sensors]);

  return null;
}

function createCustomIcon(band: AqiBandKey, status: 'online' | 'offline') {
  const color = BAND_COLOR[band];
  const size = status === 'offline' ? 10 : 14;
  const opacity = status === 'offline' ? 0.4 : 0.9;
  
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div style="width: ${size}px; height: ${size}px; background-color: ${color}; opacity: ${opacity}; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

function aqiFallback(sensor: LeafletMapSensor) {
  return sensor.status === 'offline' ? 30 : 0;
}

export function RiyadhLeafletMap({ mode, sensors, clusters, onPickSensor }: Props) {
  const sortedSensors = useMemo(
    () =>
      [...sensors].sort(
        (a, b) => (b.aqi - aqiFallback(b)) - (a.aqi - aqiFallback(a)),
      ),
    [sensors],
  );

  return (
    <div className="map" style={{ height: '100%', width: '100%', position: 'absolute', zIndex: 1 }}>
      <MapContainer 
        center={[RIYADH_CENTER.lat, RIYADH_CENTER.lng]} 
        zoom={11} 
        minZoom={10} 
        maxZoom={14}
        zoomControl={false}
        style={{ height: '100%', width: '100%', background: '#efe9dd' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {mode === 'heatmap' && <HeatmapLayer sensors={sensors} />}

        {mode === 'hardware' && sortedSensors.map(sensor => (
          <Marker 
            key={sensor.uuid} 
            position={[sensor.lat, sensor.lng]} 
            icon={createCustomIcon(sensor.band, sensor.status)}
            eventHandlers={{
              click: () => onPickSensor(sensor),
            }}
          >
            <Popup>
              <div style={{ font: '500 12px Inter, sans-serif', color: '#2f2a23' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{sensor.label}</div>
                <div>AQI {Math.round(sensor.aqi)} · PM2.5 {sensor.pm25.toFixed(1)}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {clusters && clusters.map((cluster, i) => (
          <Circle
            key={`cluster-${i}`}
            center={[cluster.centroidLat, cluster.centroidLng]}
            radius={cluster.radiusKm * 1000}
            pathOptions={{
              fillColor: '#cf5f4a',
              fillOpacity: 0.15,
              color: '#cf5f4a',
              weight: 2,
              dashArray: '5, 5'
            }}
          />
        ))}

      </MapContainer>
    </div>
  );
}
