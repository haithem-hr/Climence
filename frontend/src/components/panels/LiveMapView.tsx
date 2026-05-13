import { useEffect, useMemo, useState } from 'react';
import { Filter, Pause, Play, Save, Trash2 } from 'lucide-react';
import type { HeatmapPoint } from '../map/HeatmapLayer';
import { DispatchDialog } from './DispatchDialog';
import {
  RiyadhGoogleMap,
  type RiyadhMapCluster,
  type RiyadhMapSensor,
  type RiyadhZoomPreset,
} from '../map/RiyadhGoogleMap';
import { heatIntensityForMetric } from '../../lib/mapMetrics';
import {
  clusterLiveMapSensors,
  filterLiveMapSensors,
  nextReplayHistory,
  parseSavedViewPresets,
  serializeSavedViewPresets,
  type LiveMapStatusFilter,
  type ReplayFrame,
  type SavedViewPreset,
} from '../../lib/liveMap';
import type { useDashboardData } from '../../hooks/useDashboardData';

const LIVE_MAP_PRESETS_KEY = 'climence.live-map.presets.v1';

type DashboardData = ReturnType<typeof useDashboardData>;

interface LiveMapViewProps {
  data: DashboardData;
}

function midpointFromBounds(bounds: DashboardData['mapBounds']) {
  if (!bounds) return null;
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

function makePresetName(existing: SavedViewPreset[]) {
  return `Preset ${existing.length + 1}`;
}

export function LiveMapView({ data }: LiveMapViewProps) {
  const [statusFilter, setStatusFilter] = useState<LiveMapStatusFilter>('all');
  const [minPm25, setMinPm25] = useState(0);
  const [lowBatteryOnly, setLowBatteryOnly] = useState(false);
  const [batteryThreshold, setBatteryThreshold] = useState(30);
  const [clusterEnabled, setClusterEnabled] = useState(true);

  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);

  const [savedPresets, setSavedPresets] = useState<SavedViewPreset[]>(() => {
    if (typeof window === 'undefined') return [];
    return parseSavedViewPresets(window.localStorage.getItem(LIVE_MAP_PRESETS_KEY));
  });
  const [localFocusTarget, setLocalFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; nonce: number } | null>(null);
  const [dispatchTarget, setDispatchTarget] = useState<{ id: string; name: string; lat: number; lng: number } | null>(null);

  useEffect(() => {
    const nextFrame: ReplayFrame = {
      emittedAt: data.liveAge ? `${Date.now()}-${data.liveAge}` : String(Date.now()),
      sensors: data.sensors,
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrames(prev => nextReplayHistory(prev, nextFrame, 180));
  }, [data.liveAge, data.sensors]);

  useEffect(() => {
    if (!playbackEnabled || !playbackPlaying || frames.length < 2) return;
    const timer = setInterval(() => {
      setPlaybackIndex(prev => {
        if (prev >= frames.length - 1) return 0;
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [frames.length, playbackEnabled, playbackPlaying]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LIVE_MAP_PRESETS_KEY, serializeSavedViewPresets(savedPresets));
  }, [savedPresets]);

  const replaySensors = playbackEnabled ? frames[playbackIndex]?.sensors ?? data.sensors : data.sensors;

  const filteredSensors = useMemo(
    () =>
      filterLiveMapSensors(replaySensors, {
        status: statusFilter,
        minPm25,
        lowBatteryOnly,
        batteryThreshold,
      }),
    [batteryThreshold, lowBatteryOnly, minPm25, replaySensors, statusFilter],
  );

  const clusters = useMemo(
    () => (clusterEnabled ? clusterLiveMapSensors(filteredSensors, { zoom: data.mapZoom, minClusterSize: 2 }) : []),
    [clusterEnabled, data.mapZoom, filteredSensors],
  );

  const clusteredMembers = useMemo(() => new Set(clusters.flatMap(cluster => cluster.memberUuids)), [clusters]);

  const visibleSensors = useMemo(() => {
    if (!clusterEnabled) return filteredSensors;
    return filteredSensors.filter(sensor => !clusteredMembers.has(sensor.uuid));
  }, [clusterEnabled, clusteredMembers, filteredSensors]);

  const playbackHeatmapPoints = useMemo<HeatmapPoint[]>(
    () => {
      const metricValueForSensor = (sensor: RiyadhMapSensor) => {
        switch (data.pollutant) {
          case 'pm25':
            return sensor.pm25;
          case 'battery':
            return sensor.battery;
          case 'co2':
          case 'no2':
          case 'temperature':
          case 'humidity':
          default:
            return sensor.pm25;
        }
      };

      return filteredSensors.map(sensor => ({
        lat: sensor.lat,
        lng: sensor.lng,
        intensity: heatIntensityForMetric(data.pollutant, metricValueForSensor(sensor)),
      }));
    },
    [data.pollutant, filteredSensors],
  );

  const liveMapClusters: RiyadhMapCluster[] = useMemo(
    () =>
      clusters.map(cluster => ({
        id: cluster.id,
        lat: cluster.lat,
        lng: cluster.lng,
        count: cluster.count,
        radiusMeters: cluster.radiusMeters,
        avgPm25: cluster.avgPm25,
        maxPm25: cluster.maxPm25,
        minBattery: cluster.minBattery,
      })),
    [clusters],
  );

  const activeFocusTarget = localFocusTarget ?? data.mapFocusTarget;

  const saveCurrentPreset = () => {
    const center = midpointFromBounds(data.mapBounds);
    if (!center) return;

    const next: SavedViewPreset = {
      id: `preset-${Date.now()}`,
      name: makePresetName(savedPresets),
      lat: center.lat,
      lng: center.lng,
      zoom: data.mapZoom,
      createdAt: new Date().toISOString(),
    };

    setSavedPresets(prev => [...prev, next].slice(-10));
  };

  const applyPreset = (preset: SavedViewPreset) => {
    setLocalFocusTarget(prev => ({
      lat: preset.lat,
      lng: preset.lng,
      zoom: preset.zoom,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  };

  const deletePreset = (presetId: string) => {
    setSavedPresets(prev => prev.filter(preset => preset.id !== presetId));
  };

  const setBuiltInPreset = (preset: RiyadhZoomPreset) => {
    data.setZoomPreset(preset);
    setLocalFocusTarget(null);
  };

  return (
    <div className="live-map-view">
      <div className="live-map-toolbar glass">
        <div className="live-map-toolbar-row">
          <div className="live-map-chip-group">
            <span className="eyebrow">Status</span>
            {(['all', 'online', 'offline'] as LiveMapStatusFilter[]).map(value => (
              <button
                key={value}
                className={`live-map-chip ${statusFilter === value ? 'active' : ''}`}
                onClick={() => setStatusFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="live-map-chip-group">
            <span className="eyebrow">PM2.5</span>
            {[0, 35, 75, 120].map(value => (
              <button
                key={value}
                className={`live-map-chip ${minPm25 === value ? 'active' : ''}`}
                onClick={() => setMinPm25(value)}
              >
                {value === 0 ? 'All' : `≥ ${value}`}
              </button>
            ))}
          </div>

          <div className="live-map-chip-group">
            <button className={`live-map-chip ${lowBatteryOnly ? 'active' : ''}`} onClick={() => setLowBatteryOnly(prev => !prev)}>
              <Filter size={12} />
              Battery ≤ {batteryThreshold}%
            </button>
            <input
              type="range"
              min={10}
              max={80}
              value={batteryThreshold}
              onChange={event => setBatteryThreshold(Number(event.target.value))}
              aria-label="battery threshold"
            />
          </div>

          <div className="live-map-chip-group">
            <button className={`live-map-chip ${clusterEnabled ? 'active' : ''}`} onClick={() => setClusterEnabled(prev => !prev)}>
              Clustering
            </button>
            <button className={`live-map-chip ${data.mode === 'hardware' ? 'active' : ''}`} onClick={() => data.setMode('hardware')}>
              Hardware
            </button>
            <button className={`live-map-chip ${data.mode === 'heatmap' ? 'active' : ''}`} onClick={() => data.setMode('heatmap')}>
              Heatmap
            </button>
          </div>
        </div>

        <div className="live-map-toolbar-row">
          <div className="live-map-chip-group">
            <span className="eyebrow">Playback</span>
            <button className={`live-map-chip ${playbackEnabled ? 'active' : ''}`} onClick={() => setPlaybackEnabled(prev => !prev)}>
              History scrubber
            </button>
            <button className="live-map-chip" onClick={() => setPlaybackPlaying(prev => !prev)} disabled={!playbackEnabled || frames.length < 2}>
              {playbackPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, frames.length - 1)}
              value={Math.min(playbackIndex, Math.max(0, frames.length - 1))}
              onChange={event => setPlaybackIndex(Number(event.target.value))}
              disabled={!playbackEnabled || frames.length < 2}
              aria-label="playback slider"
            />
            <span className="mono tnum live-map-playback-count">
              {frames.length === 0 ? '--' : `${Math.min(playbackIndex + 1, frames.length)}/${frames.length}`}
            </span>
          </div>

          <div className="live-map-chip-group">
            <span className="eyebrow">Built-in views</span>
            {(['city', 'sector', 'zone'] as RiyadhZoomPreset[]).map(preset => (
              <button
                key={preset}
                className={`live-map-chip ${data.zoomPreset === preset ? 'active' : ''}`}
                onClick={() => setBuiltInPreset(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="live-map-chip-group">
            <button className="live-map-chip" onClick={saveCurrentPreset} disabled={!data.mapBounds}>
              <Save size={12} /> Save current view
            </button>
            {savedPresets.map(preset => (
              <div key={preset.id} className="live-map-preset-pill">
                <button className="live-map-chip" onClick={() => applyPreset(preset)}>{preset.name}</button>
                <button className="live-map-chip danger" onClick={() => deletePreset(preset.id)} aria-label={`Delete ${preset.name}`}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="live-map-stage">
        <RiyadhGoogleMap
          mode={data.mode}
          sensors={visibleSensors as RiyadhMapSensor[]}
          hotspots={data.mapHotspots}
          clusters={data.mode === 'hardware' ? liveMapClusters : []}
          heatmapPoints={playbackHeatmapPoints}
          zoomPreset={data.zoomPreset}
          focusTarget={activeFocusTarget}
          onViewportChange={data.handleMapViewportChange}
          onPickSensor={data.handlePickSensor}
          activeMissions={data.activeMissions}
          onDispatch={setDispatchTarget}
        />

        <div className="live-map-legend glass">
          <div className="eyebrow live-map-legend-title">Live map legend</div>
          <div className="live-map-legend-row">
            <span className="sw live-map-legend-swatch live-map-legend-swatch--good" /> Good
          </div>
          <div className="live-map-legend-row">
            <span className="sw live-map-legend-swatch live-map-legend-swatch--usg" /> Elevated
          </div>
          <div className="live-map-legend-row">
            <span className="sw live-map-legend-swatch live-map-legend-swatch--unh" /> Unhealthy
          </div>
          <div className="live-map-legend-row">
            <span className="sw live-map-legend-swatch live-map-legend-swatch--haz" /> Hazard
          </div>
          <div className="divider live-map-legend-divider" />
          <div className="mono live-map-legend-meta">
            Showing {visibleSensors.length} sensors · {liveMapClusters.length} clusters
          </div>
        </div>
      </div>

      <DispatchDialog
        isOpen={!!dispatchTarget}
        onClose={() => setDispatchTarget(null)}
        onConfirm={data.handleDispatch}
        targetId={dispatchTarget?.id ?? ''}
        targetName={dispatchTarget?.name ?? ''}
        targetCoord={{ lat: dispatchTarget?.lat ?? 0, lng: dispatchTarget?.lng ?? 0 }}
      />
    </div>
  );
}
