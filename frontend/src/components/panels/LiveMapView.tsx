import { useEffect, useMemo, useState } from 'react';
import { Filter, Pause, Play, Camera } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { HeatmapPoint } from '../map/HeatmapLayer';
import {
  RiyadhGoogleMap,
  type RiyadhMapCluster,
  type RiyadhMapSensor,
  type RiyadhZoomPreset,
} from '../map/RiyadhGoogleMap';
import { heatIntensityForMetric, bandForMetricValue } from '../../lib/mapMetrics';
import {
  clusterLiveMapSensors,
  filterLiveMapSensors,
  nextReplayHistory,
  type LiveMapStatusFilter,
  type ReplayFrame,
} from '../../lib/liveMap';
import type { useDashboardData } from '../../hooks/useDashboardData';


const LIVE_MAP_POLLUTANTS = ['pm25', 'pm10', 'o3', 'no2', 'co', 'so2', 'dust'] as const;

type DashboardData = ReturnType<typeof useDashboardData>;
type LiveMapPollutant = (typeof LIVE_MAP_POLLUTANTS)[number];

interface LiveMapViewProps {
  data: DashboardData;
}



function isLiveMapPollutant(value: string | undefined): value is LiveMapPollutant {
  return LIVE_MAP_POLLUTANTS.includes(value as LiveMapPollutant);
}

export function LiveMapView({ data }: LiveMapViewProps) {
  const [statusFilter, setStatusFilter] = useState<LiveMapStatusFilter>('all');
  const [selectedPollutant, setSelectedPollutant] = useState<LiveMapPollutant>('pm25');
  const [minPollutant, setMinPollutant] = useState(0);
  const [lowBatteryOnly, setLowBatteryOnly] = useState(false);
  const [batteryThreshold, setBatteryThreshold] = useState(30);
  const clusterEnabled = true;

  const isStationary = data.dataSource === 'stationary';

  const THRESHOLDS: Record<LiveMapPollutant, number[]> = {
    pm25: [0, 35, 75, 120],
    pm10: [0, 50, 100, 150],
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

  const [localFocusTarget, setLocalFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; nonce: number; uuid?: string } | null>(null);
  const [temporaryHighlight, setTemporaryHighlight] = useState<{ lat: number; lng: number; nonce: number } | null>(null);

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
    if (!temporaryHighlight) return;
    const timer = window.setTimeout(() => {
      setTemporaryHighlight(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [temporaryHighlight]);

  const liveMapFocusRequest = data.liveMapFocusRequest;
  const clearLiveMapFocusRequest = data.clearLiveMapFocusRequest;
  const handlePickSensor = data.handlePickSensor;
  const sensors = data.sensors;

  useEffect(() => {
    const request = liveMapFocusRequest;
    if (!request) return;

    const timer = window.setTimeout(() => {
      if (isLiveMapPollutant(request.focusPollutant)) {
        setSelectedPollutant(request.focusPollutant);
        setMinPollutant(0);
      }

      if (request.focusSensorId) {
        const sensor = sensors.find(item => item.uuid === request.focusSensorId || item.id === request.focusSensorId);
        if (sensor) {
          handlePickSensor(sensor);
          setLocalFocusTarget({ lat: sensor.lat, lng: sensor.lng, zoom: 16, nonce: request.nonce, uuid: sensor.uuid });
          setTemporaryHighlight(null);
          clearLiveMapFocusRequest();
          return;
        }

        if (!request.focusCoords) {
          if (sensors.length === 0) return;
          clearLiveMapFocusRequest();
          return;
        }
      }

      if (request.focusCoords) {
        setLocalFocusTarget({ ...request.focusCoords, zoom: 16, nonce: request.nonce });
        setTemporaryHighlight({ ...request.focusCoords, nonce: request.nonce });
        clearLiveMapFocusRequest();
        return;
      }

      clearLiveMapFocusRequest();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [clearLiveMapFocusRequest, handlePickSensor, liveMapFocusRequest, sensors]);

  useEffect(() => {
    if (!temporaryHighlight) return;
    const timer = window.setTimeout(() => {
      setTemporaryHighlight(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [temporaryHighlight]);

  const replaySensors = playbackEnabled ? frames[playbackIndex]?.sensors ?? data.sensors : data.sensors;

  const filteredSensors = useMemo(
    () =>
      filterLiveMapSensors(replaySensors, {
        status: statusFilter,
        pollutant: selectedPollutant,
        minPollutant,
        lowBatteryOnly,
        batteryThreshold,
      }),
    [batteryThreshold, lowBatteryOnly, minPollutant, replaySensors, selectedPollutant, statusFilter],
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

  const focusUuid = localFocusTarget?.uuid;
  const mapSensorsRaw = useMemo(() => {
    if (!focusUuid) return visibleSensors;
    if (visibleSensors.some(sensor => sensor.uuid === focusUuid)) return visibleSensors;

    const focusedSensor = replaySensors.find(sensor => sensor.uuid === focusUuid);
    return focusedSensor ? [...visibleSensors, focusedSensor] : visibleSensors;
  }, [focusUuid, replaySensors, visibleSensors]);

  const mapSensors = useMemo(() => {
    return mapSensorsRaw.map(sensor => {
      let val = sensor.pm25;
      if (selectedPollutant === 'pm10') val = sensor.pm10;
      else if (selectedPollutant === 'o3') val = sensor.o3;
      else if (selectedPollutant === 'no2') val = sensor.no2;
      else if (selectedPollutant === 'co') val = sensor.co;
      else if (selectedPollutant === 'so2') val = sensor.so2;
      else if (selectedPollutant === 'dust') val = sensor.dust;
      
      return { ...sensor, band: bandForMetricValue(selectedPollutant, val) };
    });
  }, [mapSensorsRaw, selectedPollutant]);

  const playbackHeatmapPoints = useMemo<HeatmapPoint[]>(
    () => {
      const metricValueForSensor = (sensor: RiyadhMapSensor) => {
        if (selectedPollutant === 'pm25') return sensor.pm25;
        if (selectedPollutant === 'pm10') return sensor.pm10;
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
    [filteredSensors, selectedPollutant],
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

  const [captureLoading, setCaptureLoading] = useState(false);
  const captureMapImage = async () => {
    const mapElement = document.querySelector('.live-map-stage') as HTMLElement;
    if (!mapElement) return;
    try {
      setCaptureLoading(true);
      const dataUrl = await toPng(mapElement, {
        cacheBust: true,
        backgroundColor: '#111318',
        pixelRatio: window.devicePixelRatio || 1,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `climence-map-${selectedPollutant}-${Date.now()}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to capture map screenshot:', err);
      alert('Failed to capture screenshot. The map tiles might be blocking it.');
    } finally {
      setCaptureLoading(false);
    }
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

          <div className="live-map-chip-group">
            <span className="eyebrow">Pollutant</span>
            {LIVE_MAP_POLLUTANTS.map(poll => (
              <button
                key={poll}
                className={`live-map-chip ${selectedPollutant === poll ? 'active' : ''}`}
                onClick={() => {
                  setSelectedPollutant(poll);
                  setMinPollutant(0);
                }}
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
            <button className="live-map-chip" onClick={captureMapImage} disabled={captureLoading}>
              <Camera size={12} /> {captureLoading ? 'Saving...' : 'Save map as Image'}
            </button>
          </div>
        </div>
      </div>

      <div className="live-map-stage">
        <RiyadhGoogleMap
          mode={data.mode}
          sensors={mapSensors as RiyadhMapSensor[]}
          hotspots={data.mapHotspots}
          clusters={liveMapClusters}
          heatmapPoints={playbackHeatmapPoints}
          zoomPreset={data.zoomPreset}
          focusTarget={activeFocusTarget}
          focusHighlight={temporaryHighlight}
          onViewportChange={data.handleMapViewportChange}
          onPickSensor={data.handlePickSensor}
          dataSource={data.dataSource}
        />
      </div>
    </div>
  );
}
