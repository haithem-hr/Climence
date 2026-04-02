import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Wind, Layers, X, Activity, BarChart3, MapPin, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// Fix leaflet default icon in React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface TelemetryData {
  uuid: string;
  state: string;
  batteryLevel: number;
  lat: number;
  lng: number;
  pm25: number;
  co2: number;
  no2: number;
  temperature: number;
  humidity: number;
  rssi: number;
  client_timestamp: string;
  server_timestamp: string;
}

// Spatial Hazard Alerts Component
function AlertLayer() {
  const [alerts, setAlerts] = useState<TelemetryData[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/alerts/active');
        if (res.ok) setAlerts(await res.json());
      } catch (err) {
        console.error("Alerts fetching failed:", err);
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  if (alerts.length === 0) return null;

  return (
    <>
      {alerts.map(alert => (
        <Circle 
          key={`alert-${alert.uuid}`}
          center={[alert.lat, alert.lng]} 
          radius={500} 
          pathOptions={{ color: '#ef4444', fillColor: '#f87171', fillOpacity: 0.5, className: 'danger-pulse' }}
        >
          <Popup>
            <div className="p-2 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <h3 className="font-bold text-gray-800 uppercase tracking-tight text-sm mb-1">
                ⚠️ Critical Hazard
              </h3>
              <p className="text-xs text-gray-600 leading-tight border-b border-gray-200 pb-2 mb-2">
                <strong className="text-rose-500 text-sm">{alert.pm25} µg/m³</strong> PM2.5 detected.
              </p>
              <p className="text-[10px] text-gray-500 uppercase font-bold">Residents are advised to stay indoors.</p>
            </div>
          </Popup>
        </Circle>
      ))}
    </>
  );
}

// Custom Heatmap Component 
function HeatmapLayer({ drones }: { drones: TelemetryData[] }) {
  const map = useMap();

  useEffect(() => {
    if (!drones || drones.length === 0) return;
    const heatData = drones.map(d => [d.lat, d.lng, d.pm25]);
    const heatLayer = (L as any).heatLayer(heatData, {
      radius: 70,
      blur: 60,
      max: 200, 
      maxZoom: 13,
      gradient: { 0.2: '#10b981', 0.5: '#f59e0b', 1.0: '#ef4444' }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, drones]);

  return null;
}

export default function App() {
  const [drones, setDrones] = useState<TelemetryData[]>([]);
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap'>('heatmap');
  
  // Historical & Macro Analytics State
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<TelemetryData[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  const [cityTrend, setCityTrend] = useState<any[]>([]);
  const [hotspots, setHotspots] = useState<any[]>([]);

  // Poll Latest Drone Locations every 5 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/telemetry/latest');
        if (res.ok) setDrones(await res.json());
      } catch (err) {
        console.error("Drone telemetry failing:", err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll Macro Analytics (Command Center) every 15 seconds
  useEffect(() => {
    const fetchMacroAnalytics = async () => {
      try {
        const trendRes = await fetch('http://localhost:3000/api/analytics/city-trend');
        if (trendRes.ok) setCityTrend(await trendRes.json());

        const hotRes = await fetch('http://localhost:3000/api/analytics/hotspots');
        if (hotRes.ok) setHotspots(await hotRes.json());
      } catch (err) {
        console.error("Macro analytics failing:", err);
      }
    };
    fetchMacroAnalytics();
    const interval = setInterval(fetchMacroAnalytics, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Drone History explicitly when selectedDroneId changes
  useEffect(() => {
    if (!selectedDroneId) return;
    const fetchHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const res = await fetch(`http://localhost:3000/api/telemetry/history/${selectedDroneId}`);
        if (!res.ok) { setHistoryData([]); return; }
        const data = await res.json();
        const formattedData = data.map((d: any) => ({
            ...d,
            displayTime: new Date(d.server_timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })
        }));
        setHistoryData(formattedData);
      } catch (err) {
        setHistoryData([]);
      } finally {
        setIsHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [selectedDroneId]);

  return (
    <div className="relative w-full h-screen bg-gray-950 text-gray-100 flex overflow-hidden font-sans">
      
      {/* MACRO ANALYTICS LEFT SIDEBAR (COMMAND CENTER) */}
      <div className="w-[450px] h-full bg-gray-900 border-r border-gray-800 flex flex-col z-20 shadow-2xl shrink-0">
        
        {/* Header Block */}
        <div className="p-6 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Activity className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Climence</h1>
              <p className="text-xs text-indigo-400 font-bold tracking-widest uppercase">Command Center</p>
            </div>
          </div>
        </div>

        {/* Scrollable Aggregations */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            
            {/* View Toggle */}
            <div className="bg-gray-800/80 p-1 rounded-lg flex shadow-inner border border-gray-700/50">
              <button 
                onClick={() => setViewMode('markers')}
                className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all ${viewMode === 'markers' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                Hardware Grid
              </button>
              <button 
                onClick={() => setViewMode('heatmap')}
                className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all flex items-center justify-center space-x-1 ${viewMode === 'heatmap' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                <Layers className="w-3 h-3 mr-1" /> AQI Heatmap
              </button>
            </div>

            {/* City Trend Chart */}
            <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-indigo-400" /> City-Wide Trend (30m)
                </h3>
                <div className="w-full h-48 -ml-5">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cityTrend} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                            <XAxis dataKey="minute_label" stroke="#6b7280" fontSize={10} minTickGap={20} />
                            <YAxis yAxisId="left" stroke="#ef4444" fontSize={10} width={40} />
                            <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={10} width={40} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', fontSize: '12px' }}
                            />
                            <Line yAxisId="left" type="monotone" dataKey="avg_pm25" name="PM2.5 Avg" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line yAxisId="right" type="monotone" dataKey="avg_co2" name="CO2 Avg" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Hotspots Leaderboard */}
            <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-rose-400" /> Active Pollution Hotspots (5m)
                </h3>
                <div className="space-y-3">
                    {hotspots.map((spot, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-xl border border-gray-800">
                            <div className="flex items-center space-x-3">
                                <div className="text-xs font-bold text-gray-500 w-4">#{i+1}</div>
                                <div>
                                    <div className="text-sm font-semibold text-gray-200">Zone Grid</div>
                                    <div className="text-[10px] text-gray-500 font-mono tracking-tighter">[{spot.lat_zone}, {spot.lng_zone}]</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-rose-500">{Math.round(spot.avg_pm25)}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold">µg/m³</div>
                            </div>
                        </div>
                    ))}
                    {hotspots.length === 0 && <div className="text-center text-xs text-indigo-400/50 py-4 font-mono uppercase tracking-widest animate-pulse">Aggregating Grid Data...</div>}
                </div>
            </div>

        </div>
      </div>

      {/* MAP COMPONENT (Fills remaining space) */}
      <div className="flex-1 relative z-10 h-full">
        <MapContainer center={[24.7136, 46.6753]} zoom={11} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          
          {<AlertLayer />}

          {viewMode === 'markers' && drones.map(drone => (
            <Marker key={drone.uuid} position={[drone.lat, drone.lng]} eventHandlers={{ click: () => setSelectedDroneId(drone.uuid) }} />
          ))}

          {viewMode === 'heatmap' && <HeatmapLayer drones={drones} />}
        </MapContainer>

        {/* Floating Drone Overlay (If a drone is clicked) */}
        {selectedDroneId && (
            <div className="absolute top-6 right-6 w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 p-4 rounded-2xl z-[400] shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-white">Device Diagnostics</h3>
                        <div className="text-[10px] font-mono text-gray-400">ID: {selectedDroneId}</div>
                    </div>
                    <button onClick={() => setSelectedDroneId(null)} className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                {isHistoryLoading && historyData.length === 0 ? (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                    </div>
                ) : historyData.length > 0 ? (
                    <div className="w-full h-32 -ml-2 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={historyData}>
                                <XAxis dataKey="displayTime" hide />
                                <YAxis yAxisId="left" hide />
                                <YAxis yAxisId="right" orientation="right" hide />
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', fontSize: '10px' }} />
                                <Line yAxisId="left" type="monotone" dataKey="pm25" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                        <div className="text-center text-[10px] text-gray-500 uppercase mt-2 font-bold tracking-widest">PM2.5 Trajectory</div>
                    </div>
                ) : (
                    <div className="text-center py-6 text-xs text-gray-500">No data available.</div>
                )}
            </div>
        )}
      </div>

    </div>
  );
}
