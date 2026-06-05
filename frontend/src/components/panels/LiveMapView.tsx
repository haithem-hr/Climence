import { useEffect, useMemo, useState } from 'react';
import { Filter, Pause, Play, Save, Trash2 } from 'lucide-react';
import type { HeatmapPoint } from '../map/HeatmapLayer';
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
  const [selectedPollutant, setSelectedPollutant] = useState<'pm25' | 'o3' | 'no2' | 'co' | 'so2' | 'dust'>('pm25');
  const [minPollutant, setMinPollutant] = useState(0);
  const [lowBatteryOnly, setLowBatteryOnly] = useState(false);
  const [batteryThreshold, setBatteryThreshold] = useState(30);
  const clusterEnabled = true;

  const isStationary = data.dataSource === 'stationary';

  const THRESHOLDS: Record<string, number[]> = {
    pm25: [0, 35, 75, 120],
    o3: [0, 60, 100, 160],
    no2: [0, 40, 70, 200],
    co: [0, 4, 9, 15],
    so2: [0, 40, 100, 350],
    dust: [0, 50, 150, 300]
  };

  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);

  const [savedPresets, setSavedPresets] = useState<SavedViewPreset[]>(() => {
    if (typeof window === 'undefined') return [];
    return parseSavedViewPresets(window.localStorage.getItem(LIVE_MAP_PRESETS_KEY));
  });
  const [localFocusTarget, setLocalFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; nonce: number } | null>(null);

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
        pollutant: selectedPollutant,
        minPollutant: minPollutant,
        lowBatteryOnly,
        batteryThreshold,
      }),
    [batteryThreshold, lowBatteryOnly, minPollutant, selectedPollutant, replaySensors, statusFilter],
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
        if (selectedPollutant === 'pm25') return sensor.pm25;
        if (selectedPollutant === 'o3') return sensor.o3;
        if (selectedPollutant === 'no2') return sensor.no2;
        if (selectedPollutant === 'co') return sensor.co;
        if (selectedPollutant === 'so2') return sensor.so2;
        if (selectedPollutant === 'dust') return sensor.dust;
        return sensor.pm25;
      };

      return filteredSensors.map(sensor => ({
        lat: sensor.lat,
        lng: sensor.lng,
        intensity: heatIntensityForMetric(selectedPollutant, metricValueForSensor(sensor)),
      }));
    },
    [selectedPollutant, filteredSensors],
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
          {!isStationary && (
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
          )}

          <div className="live-map-chip-group" title={isStationary ? "Switch to Live mode to change pollutants" : undefined}>
            <span className="eyebrow">Pollutant</span>
            {(['pm25', 'o3', 'no2', 'co', 'so2', 'dust'] as const).map(poll => (
              <button
                key={poll}
                className={`live-map-chip ${selectedPollutant === poll ? 'active' : ''}`}
                onClick={() => {
                  if (!isStationary) {
                    setSelectedPollutant(poll);
                    setMinPollutant(0);
                  }
                }}
                disabled={isStationary}
                style={isStationary ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {poll.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="live-map-chip-group">
            <span className="eyebrow">{selectedPollutant.toUpperCase()}</span>
            {THRESHOLDS[selectedPollutant].map(value => (
              <button
                key={value}
                className={`live-map-chip ${minPollutant === value ? 'active' : ''}`}
                onClick={() => setMinPollutant(value)}
              >
                {value === 0 ? 'All' : `≥ ${value}`}
              </button>
            ))}
          </div>

          {!isStationary && (
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
          )}
        </div>

        <div className="live-map-toolbar-row">
          {!isStationary && (
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
          )}

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
          dataSource={data.dataSource}
        />
      </div>
    </div>
  );
}
