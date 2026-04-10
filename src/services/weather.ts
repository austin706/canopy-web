// ═══════════════════════════════════════════════════════════════
// Weather Service — Edge Function preferred, direct API fallback (Web)
// ═══════════════════════════════════════════════════════════════
//
// PREFERRED: Calls the Supabase Edge Function `weather` which keeps the
// OpenWeatherMap API key server-side. Falls back to direct client-side
// API call only if the Edge Function is unavailable (dev/offline).
//
// Environment variables:
// - VITE_SUPABASE_URL: Supabase project URL (enables Edge Function routing)
// - VITE_SUPABASE_ANON_KEY: Supabase anonymous key (for auth header)
// - VITE_OPENWEATHER_API_KEY: OpenWeatherMap key (fallback only — NOT needed in production)

import type { WeatherData, WeatherAlert } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const NWS_BASE = 'https://api.weather.gov';

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  // ─── Try Edge Function first (keeps API key server-side) ───
  if (SUPABASE_URL) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(`${SUPABASE_URL}/functions/v1/weather`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ lat, lon }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        return await res.json() as WeatherData;
      }
      console.warn(`Weather Edge Function returned ${res.status}, falling back to direct API`);
    } catch (err) {
      console.warn('Weather Edge Function unreachable, falling back to direct API:', err);
    }
  }

  // ─── Fallback: direct OpenWeatherMap + NWS (exposes API key on client) ───
  if (!API_KEY) {
    console.warn(
      'VITE_OPENWEATHER_API_KEY not configured and Edge Function unavailable. ' +
      'Set OPENWEATHER_API_KEY secret on the Supabase weather Edge Function.'
    );
  }

  const [currentRes, forecastRes, nwsAlerts] = await Promise.all([
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`),
    fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`),
    fetchNWSAlerts(lat, lon),
  ]);

  if (!currentRes.ok) throw new Error(`Weather fetch failed: ${currentRes.status}`);
  if (!forecastRes.ok) throw new Error(`Forecast fetch failed: ${forecastRes.status}`);

  const current = await currentRes.json();
  const forecast = await forecastRes.json();

  const dailyMap = new Map<string, { highs: number[]; lows: number[]; description: string; icon: string; pop: number[] }>();
  for (const item of forecast.list) {
    const dateStr = new Date(item.dt * 1000).toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr === todayStr) continue;
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { highs: [], lows: [], description: '', icon: '', pop: [] });
    }
    const day = dailyMap.get(dateStr)!;
    day.highs.push(item.main.temp_max);
    day.lows.push(item.main.temp_min);
    day.pop.push(item.pop || 0);
    const hour = new Date(item.dt * 1000).getHours();
    if (hour >= 11 && hour <= 15) {
      day.description = item.weather[0].description;
      day.icon = item.weather[0].icon;
    }
    if (!day.description) {
      day.description = item.weather[0].description;
      day.icon = item.weather[0].icon;
    }
  }

  const dailyForecast = Array.from(dailyMap.entries())
    .slice(0, 5)
    .map(([dateStr, day]) => ({
      date: new Date(dateStr).toISOString(),
      high: Math.round(Math.max(...day.highs)),
      low: Math.round(Math.min(...day.lows)),
      description: day.description,
      icon: day.icon,
      precipitation_chance: Math.round(Math.max(...day.pop) * 100),
    }));

  return {
    temperature: Math.round(current.main.temp),
    feels_like: Math.round(current.main.feels_like),
    humidity: current.main.humidity,
    wind_speed: Math.round(current.wind.speed),
    wind_gust: current.wind.gust ? Math.round(current.wind.gust) : undefined,
    description: current.weather[0].description,
    icon: current.weather[0].icon,
    high: Math.round(current.main.temp_max),
    low: Math.round(current.main.temp_min),
    alerts: nwsAlerts,
    forecast: dailyForecast,
  };
};

// ─── NWS Alerts (free, US-only, no API key required) ───

const fetchNWSAlerts = async (lat: number, lon: number): Promise<WeatherAlert[]> => {
  try {
    const res = await fetch(
      `${NWS_BASE}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: { 'User-Agent': '(Canopy Home App, support@canopyhome.app)' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.features || data.features.length === 0) return [];

    return data.features.map((f: any) => {
      const p = f.properties;
      const type = classifyAlertType(p.event || '');
      return {
        id: p.id || `${p.event}-${p.onset}`,
        type,
        severity: classifySeverity(p.event || ''),
        title: p.headline || p.event,
        description: (p.description || '').slice(0, 500),
        action_items: getActionItems(type),
        start_time: p.onset || p.effective,
        end_time: p.expires || p.ends,
        source: p.senderName || 'NWS',
      } as WeatherAlert;
    });
  } catch (err) {
    console.warn('NWS alerts fetch failed (non-US location?):', err);
    return [];
  }
};

// ─── Alert Classification ───

const classifyAlertType = (event: string): WeatherAlert['type'] => {
  const lower = event.toLowerCase();
  if (lower.includes('fire') || lower.includes('red flag')) return 'fire';
  if (lower.includes('freeze') || lower.includes('frost') || lower.includes('cold') || lower.includes('winter') || lower.includes('ice') || lower.includes('blizzard')) return 'freeze';
  if (lower.includes('wind') && !lower.includes('fire')) return 'wind';
  if (lower.includes('hail')) return 'hail';
  if (lower.includes('heat') || lower.includes('excessive')) return 'heat';
  if (lower.includes('tornado')) return 'tornado';
  if (lower.includes('flood') || lower.includes('flash')) return 'flood';
  if (lower.includes('hurricane') || lower.includes('tropical')) return 'storm';
  return 'storm';
};

const classifySeverity = (event: string): WeatherAlert['severity'] => {
  const lower = event.toLowerCase();
  if (lower.includes('warning')) return 'warning';
  if (lower.includes('watch')) return 'watch';
  return 'advisory';
};

export const getActionItems = (type: WeatherAlert['type']): string[] => {
  const actions: Record<string, string[]> = {
    freeze: [
      'Disconnect and drain all garden hoses',
      'Cover exposed hose bibs with insulated covers',
      'Open cabinet doors under sinks on exterior walls',
      'Let faucets drip slightly to prevent pipe freezing',
      'Set thermostat no lower than 55°F',
      'Check that attic insulation covers pipes',
      'Bring in potted plants and cover sensitive landscaping',
    ],
    wind: [
      'Secure patio furniture, grills, and decorations',
      'Close and latch all windows and exterior doors',
      'Trim any dead branches near your home',
      'Move vehicles into the garage if possible',
      'Check for loose shingles or siding after the storm',
      'Secure trash cans and recycling bins',
    ],
    hail: [
      'Move vehicles under cover or into the garage',
      'Close blinds and curtains to protect from broken glass',
      'Cover exposed outdoor equipment and AC condensers',
      'Stay away from windows and skylights during the storm',
      'Document any damage with photos for insurance',
      'Inspect roof, siding, and gutters after the storm passes',
    ],
    heat: [
      'Check that your AC filter is clean — replace if dirty',
      'Close blinds on sun-facing windows to reduce heat load',
      'Run ceiling fans counterclockwise for a cooling breeze',
      'Check your AC condenser — clear debris from around the unit',
      'Water lawn and plants early morning or late evening only',
      'Ensure attic ventilation is working properly',
    ],
    tornado: [
      'Move to your interior safe room or basement immediately',
      'Stay away from windows, doors, and exterior walls',
      'Cover yourself with blankets or a mattress',
      'After the storm: check for gas leaks and structural damage',
      'Document any damage with photos before cleanup',
      'Do not enter damaged buildings until cleared as safe',
    ],
    storm: [
      'Charge devices and flashlights in case of power outage',
      'Know the location of your breaker panel and main water shutoff',
      'Clear gutters and downspouts for proper drainage',
      'Secure outdoor furniture and loose items',
      'Check sump pump operation if you have a basement',
    ],
    flood: [
      'Move valuables to upper floors',
      'Do not walk or drive through floodwater',
      'Turn off utilities if instructed by authorities',
      'Check sump pump and ensure backup battery is charged',
      'Clear storm drains near your property if safe to do so',
      'Document water levels and damage for insurance',
    ],
    fire: [
      'Clear dry brush and debris at least 30 feet from your home',
      'Move firewood and propane tanks away from structures',
      'Close all windows, doors, and vents to prevent ember entry',
      'Shut off gas at the meter if evacuation seems likely',
      'Connect garden hoses and fill any pools or large containers',
      'Have an evacuation bag packed with documents and essentials',
      'Keep car backed into driveway with windows closed and keys accessible',
      'Monitor local fire department and emergency alerts continuously',
    ],
  };
  return actions[type] || actions.storm;
};
