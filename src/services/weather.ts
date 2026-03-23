// ═══════════════════════════════════════════════════════════════
// Weather Service — OpenWeatherMap Integration (Web)
// ═══════════════════════════════════════════════════════════════
import type { WeatherData, WeatherAlert } from '@/types';

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  // Fetch current weather and 5-day forecast in parallel
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`),
    fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`),
  ]);

  if (!currentRes.ok) throw new Error(`Weather fetch failed: ${currentRes.status}`);
  if (!forecastRes.ok) throw new Error(`Forecast fetch failed: ${forecastRes.status}`);

  const current = await currentRes.json();
  const forecast = await forecastRes.json();

  // Extract daily summaries from 3-hour forecast data
  const dailyMap = new Map<string, { highs: number[]; lows: number[]; description: string; icon: string; pop: number[] }>();
  for (const item of forecast.list) {
    const dateStr = new Date(item.dt * 1000).toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr === todayStr) continue; // skip today (we have current weather)
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { highs: [], lows: [], description: '', icon: '', pop: [] });
    }
    const day = dailyMap.get(dateStr)!;
    day.highs.push(item.main.temp_max);
    day.lows.push(item.main.temp_min);
    day.pop.push(item.pop || 0);
    // Use the midday entry's description/icon if available
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
    .slice(0, 7)
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
    alerts: [], // Free tier 2.5 API doesn't include alerts; would need One Call 3.0
    forecast: dailyForecast,
  };
};

// ─── Alert Type Classification (for future use with One Call 3.0) ───
const classifyAlertType = (event: string): WeatherAlert['type'] => {
  const lower = event.toLowerCase();
  if (lower.includes('freeze') || lower.includes('frost') || lower.includes('cold')) return 'freeze';
  if (lower.includes('wind')) return 'wind';
  if (lower.includes('hail')) return 'hail';
  if (lower.includes('heat')) return 'heat';
  if (lower.includes('tornado')) return 'tornado';
  if (lower.includes('flood')) return 'flood';
  return 'storm';
};

const classifySeverity = (event: string): WeatherAlert['severity'] => {
  const lower = event.toLowerCase();
  if (lower.includes('warning')) return 'warning';
  if (lower.includes('watch')) return 'watch';
  return 'advisory';
};

// ─── Action Items by Alert Type ───
// These are the specific "what to do" instructions shown to homeowners
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
  };
  return actions[type] || actions.storm;
};
