import { useState, useEffect } from 'react';

export interface OpenMeteoCurrent {
  time: string;
  pm10: number;
  pm2_5: number;
  carbon_monoxide: number;
  nitrogen_dioxide: number;
  sulphur_dioxide: number;
  ozone: number;
  aerosol_optical_depth: number;
  dust: number;
  uv_index: number;
  european_aqi: number;
  us_aqi: number;
}

export interface OpenMeteoData {
  current: OpenMeteoCurrent;
  current_units: Record<string, string>;
}

const CACHE_KEY = 'climence_open_meteo_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function useOpenMeteoAirQuality(lat = 24.7136, lng = 46.6753) {
  const [data, setData] = useState<OpenMeteoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function fetchOM() {
      try {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            setData(cached.data);
            setLoading(false);
            return;
          }
        }

        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,aerosol_optical_depth,dust,uv_index,european_aqi,us_aqi&timezone=Asia/Riyadh`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
        
        const json = await res.json();
        
        if (mounted) {
          setData(json);
          setLoading(false);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: json }));
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    fetchOM();

    return () => {
      mounted = false;
    };
  }, [lat, lng]);

  return { data, loading, error };
}
